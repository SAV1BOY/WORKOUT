import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { guardarPropostaDeSaltos, reconciliarCopiasDoCardio } from "@/lib/espelhos-dos-saltos";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { conferirSaltosRemotos } from "@/lib/recuperacao-de-saltos-remota";
import { enviarItem } from "@/lib/outbox-supabase";
import { confirmarSaltosPendentes, listarSaltosPendentes, listarConciliacoesDeSaltos, resolverConciliacaoDeSaltos } from "@/lib/saltos-pendentes";

vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));
vi.mock("@/lib/espelhos-dos-saltos", () => ({ guardarPropostaDeSaltos: vi.fn(), reconciliarCopiasDoCardio: vi.fn() }));
vi.mock("@/lib/recuperacao-de-saltos-remota", async importar => ({
  ...await importar<typeof import("@/lib/recuperacao-de-saltos-remota")>(), conferirSaltosRemotos: vi.fn(),
}));
vi.mock("@/lib/outbox", async importar => ({ ...await importar<typeof import("@/lib/outbox")>(), processar: vi.fn(async () => 0) }));

const ana = "ana", bia = "bia";
const corda = { id: "cardio-a", user_id: ana, tipo: "corda", data: "2026-11-18", concluida: true, saltos: 42.5,
  duracao_min: 7.5, notas: "Ao sol", feito: { blocos: [1, 2] }, esforco: "facil" };
type Linha = Record<string, unknown>;
const fila = () => bd().outbox.toArray();
async function enfileirar(linhas: Linha | Linha[]) {
  return bd().outbox.add({ tipo: "cardio", criadoEm: 20, proximaTentativa: 50, tentativas: 2, erro: "22P02",
    payload: { tabela: "cardio_sessions", onConflict: "id", op: "upsert", ...(Array.isArray(linhas) ? {linhas} : {linha: linhas}) } });
}
const pendente = async () => (await listarSaltosPendentes(ana))[0]!;
const escolha = async () => (await listarConciliacoesDeSaltos(ana))[0]!;
const protegido = async () => (await fila()).find(i => Object.hasOwn(i.payload as object, "conciliacaoDosSaltos"))!;

beforeEach(async () => {
  await Promise.all([bd().cache.clear(), bd().outbox.clear()]);
  vi.resetAllMocks();
  vi.mocked(confirmarContaDoTreino).mockResolvedValue();
  vi.stubGlobal("navigator", { onLine: false });
});
afterEach(() => vi.unstubAllGlobals());

describe("recuperação de saltos da corda", () => {
  it.each([0, 43, null])("reúne apenas as escritas do UUID, aceita %s offline e preserva os vizinhos e a outra conta", async valor => {
    const vizinha = { ...corda, id: "outra", saltos: 15 };
    const estrangeira = { ...corda, user_id: bia };
    const corrida = { ...corda, id: "corrida", tipo: "corrida", distancia_km: 4.25 };
    await enfileirar(corda); await enfileirar([vizinha, { ...corda, notas: "Hoje no terraço" }, corrida]); await enfileirar(estrangeira);
    const aberta = await pendente();
    expect(aberta).toMatchObject({ cardioId: corda.id, fracionario: 42.5, posterior: undefined });
    for (const invalido of [9.5, -1, Number.MAX_SAFE_INTEGER, NaN]) {
      await expect(confirmarSaltosPendentes(ana, aberta, invalido)).rejects.toThrow();
    }
    await confirmarSaltosPendentes(ana, aberta, valor);
    expect(await listarSaltosPendentes(ana)).toEqual([]);
    expect(await listarSaltosPendentes(bia)).toMatchObject([{ conta: bia, fracionario: 42.5 }]);
    expect(await listarConciliacoesDeSaltos(bia)).toEqual([]);
    const captura = await protegido();
    expect(captura.payload).not.toHaveProperty("op");
    const local = { ...corda, saltos: valor, notas: "Hoje no terraço" };
    expect(captura.payload).toMatchObject({ tabela: "cardio_sessions", linha: local });
    expect((await fila()).map(i => i.payload)).toMatchObject([
      { op: "upsert", linhas: [vizinha, corrida] }, { op: "upsert", linha: estrangeira }, { linha: local },
    ]);
    expect(await escolha()).toMatchObject({ estado: "aguardando", local });
    vi.mocked(conferirSaltosRemotos).mockResolvedValueOnce({ estado: "confirmada", linha: local });
    expect(await enviarItem(captura)).toBe("fila-reconciliada");
    expect(conferirSaltosRemotos).toHaveBeenCalledWith(ana, local, undefined, undefined);
    expect(reconciliarCopiasDoCardio).toHaveBeenCalledWith(ana, local, local);
    expect(await fila()).toHaveLength(2);
  });

  it.each([0, 28, null])("a edição posterior com %s no mesmo dia é explícita, inclusive depois de um backup parcial", async posterior => {
    await enfileirar(corda); const antiga = await pendente();
    await enfileirar({ id: corda.id, user_id: ana, saltos: posterior });
    await enfileirar({ id: corda.id, user_id: ana, notas: "Última nota" });
    await expect(confirmarSaltosPendentes(ana, antiga, 29)).rejects.toThrow("mudou");
    const atual = await pendente();
    expect(atual.posterior).toBe(posterior);
    await expect(confirmarSaltosPendentes(bia, atual, posterior)).rejects.toThrow();
    await expect(confirmarSaltosPendentes(ana, atual, 29)).rejects.toThrow();
    await confirmarSaltosPendentes(ana, atual, posterior);
    expect((await protegido()).payload).toMatchObject({ linha: { ...corda, saltos: posterior, notas: "Última nota" } });
    expect((await fila()).map(i => i.payload)).toMatchObject([
      { op: "update", linha: { notas: "Última nota" }, filtro: { user_id: ana, id: corda.id, tipo: "corda", data: corda.data } },
      { linha: { saltos: posterior } },
    ]);
  });

  it("leva as duas versões a Mais, reconhece uma conta que mudou e mantém a proposta e as escritas novas após erro de disco", async () => {
    await enfileirar(corda);
    const resultados = await Promise.allSettled([1, 2].map(async () => confirmarSaltosPendentes(ana, await pendente(), 44)));
    expect(resultados.map(r => r.status).sort()).toEqual(["fulfilled","rejected"]);
    const remota = { ...corda, saltos: 60, notas: "Outro aparelho", duracao_min: 12.5 };
    vi.mocked(conferirSaltosRemotos).mockResolvedValueOnce({ estado: "conflito", linha: remota });
    expect(await enviarItem(await protegido())).toBe("aguarda-conciliacao");
    const anterior = await escolha();
    expect(anterior).toMatchObject({ estado: "conflito", mesmaIdentidade: true, remota, local: { saltos: 44 } });
    expect(await enviarItem(await protegido())).toBe("aguarda-conciliacao");
    expect(conferirSaltosRemotos).toHaveBeenCalledOnce();
    await resolverConciliacaoDeSaltos(ana, anterior, "aparelho");
    await expect(resolverConciliacaoDeSaltos(ana, anterior, "historico")).rejects.toThrow();
    vi.mocked(confirmarContaDoTreino).mockRejectedValueOnce(new Error("conta mudou"));
    await expect(enviarItem(await protegido())).rejects.toThrow("conta mudou");
    const corrigida = { ...remota, saltos: 44 };
    vi.mocked(conferirSaltosRemotos).mockResolvedValue({ estado: "confirmada", linha: corrigida });
    vi.mocked(reconciliarCopiasDoCardio).mockRejectedValueOnce(new Error("quota"));
    await expect(enviarItem(await protegido())).rejects.toThrow("quota");
    expect(await escolha()).toMatchObject({ estado: "aguardando" });
    await enfileirar({ ...corrigida, notas: "Edição posterior confirmada no aparelho" });
    expect(await enviarItem(await protegido())).toBe("fila-reconciliada");
    expect((await fila()).map(i=>i.payload)).toMatchObject([{ op:"upsert", linha:{notas:"Edição posterior confirmada no aparelho"} }]);
    expect(conferirSaltosRemotos).toHaveBeenLastCalledWith(ana, { ...corda, saltos: 44 },
      { usar: "aparelho", observada: remota }, { insercao: { ...corda, saltos: 44 }, confirmada: false, manterAusencia: false });
  });

  it("backup de corrida continua como corrida, e a recuperação não autoriza recriar a corda sobre o mesmo UUID", async () => {
    await enfileirar(corda);
    const corrida = { id: corda.id, user_id: ana, data: corda.data, tipo: "corrida", concluida:true,
      distancia_km: 4.25, notas:"Mudou para corrida" };
    await enfileirar([corrida]);
    await confirmarSaltosPendentes(ana, await pendente(), 43);
    expect((await fila())[0]!.payload).toMatchObject({ op: "upsert", linhas: [corrida] });
    vi.mocked(conferirSaltosRemotos).mockResolvedValueOnce({ estado: "conflito", linha: corrida });
    expect(await enviarItem(await protegido())).toBe("aguarda-conciliacao");
    expect(await escolha()).toMatchObject({ mesmaIdentidade: false, remota: corrida, insercao: corrida, permiteCriar: false });
    await expect(resolverConciliacaoDeSaltos(ana, await escolha(), "aparelho")).rejects.toThrow();
    await resolverConciliacaoDeSaltos(ana, await escolha(), "historico");
    vi.mocked(conferirSaltosRemotos).mockResolvedValueOnce({ estado:"confirmada", linha: corrida });
    await enviarItem(await protegido()); expect(await fila()).toHaveLength(1);
  });

  it("outro dia exige confirmação própria da criação e não herda o timer ou a nota anteriores", async () => {
    await enfileirar(corda);
    const outroDia = { user_id: ana, id: corda.id, data:"2026-11-19", tipo:"corda" };
    await enfileirar(outroDia);
    await confirmarSaltosPendentes(ana, await pendente(), null);
    vi.mocked(conferirSaltosRemotos).mockResolvedValueOnce({ estado:"confirmar-insercao", linha:outroDia });
    expect(await enviarItem(await protegido())).toBe("aguarda-conciliacao");
    expect((await escolha()).insercao).toEqual(outroDia);
    expect(await escolha()).toMatchObject({ estado:"ausente", permiteCriar:true });
    await resolverConciliacaoDeSaltos(ana, await escolha(), "manter-ausencia");
    vi.mocked(conferirSaltosRemotos).mockResolvedValueOnce({estado:"ausencia-mantida",linha:outroDia});
    await enviarItem(await protegido());
    expect(reconciliarCopiasDoCardio).toHaveBeenCalledWith(ana,{...corda,saltos:null},null);
    expect(await fila()).toHaveLength(0);
  });

  it("falha de quota ao guardar a proposta preserva inclusive as linhas anteriores do backup", async () => {
    await enfileirar([corda, {...corda,id:"vizinha",saltos:8}]); await enfileirar(corda);
    const antes = await fila();
    vi.mocked(guardarPropostaDeSaltos).mockRejectedValueOnce(new Error("quota"));
    await expect(confirmarSaltosPendentes(ana, await pendente(), null)).rejects.toThrow("quota");
    expect(await fila()).toEqual(antes);
    expect(await listarConciliacoesDeSaltos(ana)).toEqual([]);
  });
});

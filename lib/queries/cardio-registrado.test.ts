import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { guardarPropostaDeSaltos, reconciliarCopiasDoCardio } from "@/lib/espelhos-dos-saltos";
import { enviarItem } from "@/lib/outbox-supabase";
import type { LinhaSessaoCardio } from "@/lib/types";
import { lerCardioRegistrado } from "./cardio-registrado";
import { lerFonteDoRelatorio } from "./lista-do-relatorio";

const select = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  clienteNavegador: () => ({ from: () => ({ upsert: () => ({ select }) }) }),
}));
vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));

const conta = "ana";
const corda: LinhaSessaoCardio = { id: "uuid-1", user_id: conta, data: "2026-09-14", tipo: "corda",
  saltos: 42.5, notas: "Primeiro bloco", duracao_min: 12, semana_plano: 2, planejado: {}, feito: {},
  concluida: true, distancia_km: null, esforco: "facil" };
const corrida = { ...corda, tipo: "corrida" as const, saltos: null, duracao_min: 28.5, distancia_km: 4.25,
  data: "2026-09-16", notas: "Corrida restaurada." };
const banco = bd();
const sessao = ["cardio-sessao", corda.id, conta];
const semana = ["cardio", "2026-09-13", "2026-09-20", conta];
const semRede = vi.fn(async (): Promise<LinhaSessaoCardio[]> => { throw new Error("leitura de rede inesperada"); });
const ler = (chave: string[], buscar = semRede, dono = conta) =>
  lerCardioRegistrado(new QueryClient(), dono, chave, buscar, new AbortController().signal);
const relatorio = (dono = conta) =>
  lerFonteDoRelatorio<LinhaSessaoCardio>(new QueryClient(), dono, "cardio", ["cardio-todos"], semRede);
const enfileirar = (payload: unknown) => banco.outbox.add({ tipo: "cardio", payload,
  tentativas: 1, criadoEm: Date.now(), proximaTentativa: Date.now() });
const conciliar = (registro: Partial<LinhaSessaoCardio> | null) => banco.transaction("rw", banco.cache, banco.outbox,
  () => reconciliarCopiasDoCardio(conta, { ...corda }, registro && { ...registro }));
beforeEach(async () => {
  await Promise.all([banco.outbox.clear(), banco.cache.clear()]);
  vi.resetAllMocks();
  vi.stubGlobal("navigator", { onLine: false });
});
afterEach(() => vi.unstubAllGlobals());

it("guarda o cardio devolvido pelo backup quando só a corda antiga fica na fila, mesmo na primeira abertura do histórico sem rede", async () => {
  await enfileirar({ tabela: "cardio_sessions", op: "upsert", linha: corda });
  // As colunas ausentes na importação vêm da representação confirmada pelo Postgres.
  const lote = [{ user_id: conta, id: corda.id, tipo: "corrida", data: corrida.data, distancia_km: 4.25 }];
  const id = await enfileirar({ tabela: "cardio_sessions", op: "upsert", linhas: lote, onConflict: "id" });
  select.mockResolvedValue({ data: [corrida], error: null });
  expect(await enviarItem((await banco.outbox.get(id))!)).toBe("fila-reconciliada");
  expect(select).toHaveBeenCalledWith("*");
  expect(await banco.outbox.count()).toBe(1);
  expect(await banco.cache.get("cardio-do-historico:" + conta)).toBeUndefined();
  for (const chave of [sessao, semana, ["cardio-desde", "2026-09-01", conta]]) expect(await ler(chave)).toEqual([corrida]);
  expect(await relatorio()).toEqual({ completa: false, linhas: [corrida] });
  expect(await ler(["cardio", corda.data, corda.data, conta])).toEqual([]);
  expect(await ler(["cardio-sessao", corda.id, "bia"], semRede, "bia")).toEqual([]);
  expect((await relatorio("bia")).linhas).toEqual([]);
  await guardarPropostaDeSaltos(conta, { ...corda }, { ...corda, saltos: 42 });
  expect(await ler(sessao)).toEqual([corrida]);
  expect(semRede).not.toHaveBeenCalled();
});

it("uma leitura online mais nova prevalece sobre o comprovante, inclusive quando a aba que consultou fecha imediatamente", async () => {
  const confirmada = { ...corda, saltos: 42 };
  await conciliar(confirmada);
  const posterior = { ...confirmada, saltos: 72, notas: "Mais dois blocos" };
  vi.stubGlobal("navigator", { onLine: true });
  const consultar = vi.fn(async () => [posterior]);
  expect(await ler(sessao, consultar)).toEqual([posterior]);
  vi.stubGlobal("navigator", { onLine: false });
  expect(await ler(sessao)).toEqual([posterior]);
  expect((await relatorio()).linhas).toEqual([posterior]);
});

it("uma resposta atrasada da semana cede ao novo dono do UUID na mesma conta, sem incluir um treino fora do período", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const entrou = Promise.withResolvers<void>();
  const liberar = Promise.withResolvers<void>();
  const fora = { ...corrida, data: "2026-10-01" };
  const consultar = vi.fn<() => Promise<LinhaSessaoCardio[]>>()
    .mockImplementationOnce(async () => { entrou.resolve(); await liberar.promise; return [{ ...corda, saltos: 19 }]; })
    .mockResolvedValue([]);
  const leitura = ler(semana, consultar);
  await entrou.promise;
  await conciliar(fora);
  liberar.resolve();
  expect(await leitura).toEqual([]);
  vi.stubGlobal("navigator", { onLine: false });
  expect(await ler(semana)).toEqual([]);
  expect(await ler(sessao)).toEqual([fora]);
});

it("uma conta diferente na resposta não entra na cópia do backup nem retira o lote da fila", async () => {
  await enfileirar({ tabela: "cardio_sessions", op: "upsert", linha: corda });
  const id = await enfileirar({ tabela: "cardio_sessions", op: "upsert", linhas: [corrida] });
  select.mockResolvedValue({ data: [{ ...corrida, user_id: "bia" }], error: null });
  await expect(enviarItem((await banco.outbox.get(id))!)).rejects.toThrow("resposta do backup");
  expect(await banco.outbox.count()).toBe(2);
  expect(await banco.cache.count()).toBe(0);
});

it("esvaziar um período não apaga o registro de outro dia, mas a ausência confirmada pelo UUID não ressuscita a corda recusada offline", async () => {
  await conciliar(corrida);
  await enfileirar({ tabela: "cardio_sessions", op: "upsert", linha: corda });
  vi.stubGlobal("navigator", { onLine: true });
  const vazio = vi.fn(async (): Promise<LinhaSessaoCardio[]> => []);
  expect(await ler(["cardio", corda.data, corda.data, conta], vazio)).toEqual([]);
  vi.stubGlobal("navigator", { onLine: false });
  expect(await ler(sessao)).toEqual([corrida]);
  vi.stubGlobal("navigator", { onLine: true });
  expect(await ler(sessao, vazio)).toEqual([]);
  vi.stubGlobal("navigator", { onLine: false });
  expect(await ler(sessao)).toEqual([]);
  expect((await relatorio()).linhas).toEqual([]);
  expect(await banco.outbox.count()).toBe(1);
});

it("uma resposta de outra conta é recusada antes de modificar a cópia confirmada", async () => {
  await conciliar(corrida);
  vi.stubGlobal("navigator", { onLine: true });
  const buscar = vi.fn(async () => [{ ...corrida, user_id: "bia" }]);
  await expect(ler(sessao, buscar)).rejects.toThrow("conta");
  await expect(lerFonteDoRelatorio(new QueryClient(), conta, "cardio", ["cardio-todos"], buscar)).rejects.toThrow("conta");
  vi.stubGlobal("navigator", { onLine: false });
  expect((await relatorio()).linhas).toEqual([corrida]);
});

it("mesmo sem espaço para atualizar o disco, o resumo mostra os saltos da resposta atual", async () => {
  await conciliar({ ...corda, saltos: 42 });
  vi.stubGlobal("navigator", { onLine: true });
  const semEspaco = vi.spyOn(banco.cache, "bulkPut").mockRejectedValueOnce(new Error("quota"));
  try {
    const atual = { ...corda, saltos: 80 };
    expect(await ler(sessao, vi.fn(async () => [atual]))).toEqual([atual]);
  } finally {
    semEspaco.mockRestore();
  }
});

it("o #53 pode regravar a fração depois da importação, mas a corrida já confirmada continua no resumo e no histórico offline", async () => {
  await conciliar(corrida);
  const atualizadoEm = Date.now() + 50;
  await banco.cache.put({ chave: "cardio-do-historico:" + conta, valor: [corda], atualizadoEm });
  expect(await ler(sessao)).toEqual([corrida]);
  expect(await relatorio()).toEqual({ completa: true, linhas: [corrida] });
  const posterior = { ...corrida, distancia_km: 5.25 };
  await banco.cache.put({ chave: "cardio-do-historico:" + conta, valor: [posterior], atualizadoEm });
  expect(await ler(sessao)).toEqual([posterior]);
  expect((await relatorio()).linhas).toEqual([posterior]);
});

it("o update da nota tem o mesmo filtro do servidor quando outra atividade passa a usar o UUID", async () => {
  const filtro = { id: corda.id, user_id: conta, data: corda.data, tipo: "corda", concluida: true };
  await enfileirar({ tabela: "cardio_sessions", op: "update", filtro, linha: { notas: "Ajuste dos saltos" } });
  const original = { ...corda, saltos: 88 };
  await conciliar(original);
  expect(await ler(sessao)).toEqual([{ ...original, notas: "Ajuste dos saltos" }]);
  const novo = { ...corrida, data: corda.data };
  await conciliar(novo);
  expect(await ler(sessao)).toEqual([novo]);
  expect((await relatorio()).linhas).toEqual([novo]);
  await enfileirar({ tabela: "cardio_sessions", op: "delete", filtro });
  expect(await ler(sessao)).toEqual([novo]);
});

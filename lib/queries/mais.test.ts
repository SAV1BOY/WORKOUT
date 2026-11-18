import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarCache } from "@/lib/db";
import { chaves } from "@/lib/queries/dados";
import { salvarIncremento, salvarPrefsOuDesfazer } from "@/lib/queries/mais";
import type { LinhaEstadoExercicio, LinhaPerfil, Prefs } from "@/lib/types";

const enfileirada = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  temIndexedDB: () => true,
  guardarCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/outbox-supabase", () => ({
  enfileirarEscrita: enfileirada,
}));

const IDS = ["agachamento-livre", "supino-reto-com-barra"] as const;

function linhaExistente(): LinhaEstadoExercicio {
  return {
    user_id: "u1",
    exercise_id: "supino-reto-com-barra",
    carga_atual_kg: 30,
    reps_alvo: null,
    tempo_alvo_s: null,
    assistencia: null,
    incremento_kg: null,
    falhas_seguidas: 0,
    incremento_reduzido: false,
    exigir_rep_extra: false,
    semana_leve: false,
    carga_antes_leve: null,
    sessoes_graca: 0,
    desativado: false,
    notas: null,
  };
}

describe("salvarIncremento (SPEC §3.9)", () => {
  beforeEach(() => {
    enfileirada.mockClear();
  });

  it("a confirmação de uma alteração já inclui a cópia usada na próxima recarga", async () => {
    const cliente = new QueryClient();
    await salvarIncremento({
      userId: "u1", exercicioId: "agachamento-livre", incrementoKg: 6, cliente, idsEmTela: IDS,
    });

    expect(guardarCache).toHaveBeenLastCalledWith("react-query-v1", expect.objectContaining({
      estado: expect.objectContaining({
        queries: [expect.objectContaining({
          queryKey: chaves.estados(IDS),
          state: expect.objectContaining({
            data: [expect.objectContaining({ exercise_id: "agachamento-livre", incremento_kg: 6 })],
          }),
        })],
      }),
    }));
  });

  it("atualiza a linha que já existe no cache", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.estados(IDS), [linhaExistente()]);

    await salvarIncremento({
      userId: "u1",
      exercicioId: "supino-reto-com-barra",
      incrementoKg: 3,
      cliente,
      idsEmTela: IDS,
    });

    const linhas = cliente.getQueryData<LinhaEstadoExercicio[]>(
      chaves.estados(IDS),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas?.[0]?.incremento_kg).toBe(3);
    expect(linhas?.[0]?.carga_atual_kg).toBe(30);
    expect(enfileirada).toHaveBeenCalledTimes(1);
  });

  it("cria no cache a linha do exercício que ainda não tem estado", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.estados(IDS), [linhaExistente()]);

    await salvarIncremento({
      userId: "u1",
      exercicioId: "agachamento-livre",
      incrementoKg: 6,
      cliente,
      idsEmTela: IDS,
    });

    const linhas = cliente.getQueryData<LinhaEstadoExercicio[]>(
      chaves.estados(IDS),
    );
    expect(linhas).toHaveLength(2);
    const nova = linhas?.find((l) => l.exercise_id === "agachamento-livre");
    // a linha sintética tem que ser a mesma que o upsert cria no banco:
    // os defaults de `exercise_state` em supabase/schema.sql
    expect(nova).toEqual({
      user_id: "u1",
      exercise_id: "agachamento-livre",
      carga_atual_kg: null,
      reps_alvo: null,
      tempo_alvo_s: null,
      assistencia: null,
      incremento_kg: 6,
      falhas_seguidas: 0,
      incremento_reduzido: false,
      exigir_rep_extra: false,
      semana_leve: false,
      carga_antes_leve: null,
      sessoes_graca: 0,
      desativado: false,
      notas: null,
    });
    // e o upsert vai para a fila com a chave real (§8)
    expect(enfileirada).toHaveBeenCalledWith("estado_exercicio", {
      tabela: "exercise_state",
      op: "upsert",
      linha: {
        user_id: "u1",
        exercise_id: "agachamento-livre",
        incremento_kg: 6,
      },
      onConflict: "user_id,exercise_id",
    });
  });

  it("voltar ao incremento do programa (null) também fica no cache", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.estados(IDS), []);

    await salvarIncremento({
      userId: "u1",
      exercicioId: "agachamento-livre",
      incrementoKg: null,
      cliente,
      idsEmTela: IDS,
    });

    const linhas = cliente.getQueryData<LinhaEstadoExercicio[]>(
      chaves.estados(IDS),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas?.[0]?.incremento_kg).toBeNull();
  });
});

describe("salvarPrefsOuDesfazer (SPEC §23.15, aceite 6)", () => {
  const PREFS_ANTES: Prefs = { tema: "auto", lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: false, hora: "07:00" } } };
  const PREFS_NOVAS: Prefs = { tema: "auto", lembretes: { treino: { ligado: true, hora: "06:15" }, corrida: { ligado: false, hora: "07:00" } } };

  function comPerfil(): QueryClient {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.perfil(), { user_id: "u1", fase_atual: "fase1", prefs: PREFS_ANTES } as unknown as LinhaPerfil);
    return cliente;
  }

  beforeEach(() => {
    enfileirada.mockReset();
  });

  it("gravou: o cache fica com as prefs novas", async () => {
    const cliente = comPerfil();
    await salvarPrefsOuDesfazer({ userId: "u1", prefs: PREFS_NOVAS, cliente });
    expect(cliente.getQueryData<LinhaPerfil>(chaves.perfil())?.prefs).toEqual(PREFS_NOVAS);
    expect(enfileirada).toHaveBeenCalledTimes(1);
  });

  it("o IndexedDB recusou: o erro sobe e o cache volta às prefs de antes", async () => {
    enfileirada.mockRejectedValueOnce(new Error("QuotaExceededError"));
    const cliente = comPerfil();
    await expect(salvarPrefsOuDesfazer({ userId: "u1", prefs: PREFS_NOVAS, cliente })).rejects.toThrow(
      "QuotaExceededError",
    );
    const perfil = cliente.getQueryData<LinhaPerfil>(chaves.perfil());
    expect(perfil?.prefs).toEqual(PREFS_ANTES);
    // o resto do perfil não mexe
    expect(perfil?.fase_atual).toBe("fase1");
  });

  // a segunda nasce das prefs que a primeira pôs no cache e as leva junto para a fila
  const PREFS_DA_SEGUNDA: Prefs = {
    tema: "auto",
    lembretes: { treino: { ligado: true, hora: "06:15" }, corrida: { ligado: true, hora: "18:30" } },
  };

  /** Duas gravações na fila falsa, cada uma resolvida à mão, na ordem que o teste quiser. */
  function duasNaMao() {
    const maos: { passar: () => void; recusar: (erro: Error) => void }[] = [];
    const naMao = () =>
      new Promise<void>((passar, recusar) => {
        maos.push({ passar: () => passar(), recusar });
      });
    enfileirada.mockImplementationOnce(naMao).mockImplementationOnce(naMao);
    return maos;
  }

  async function sobrepostas(cliente: QueryClient) {
    const maos = duasNaMao();
    const primeira = salvarPrefsOuDesfazer({ userId: "u1", prefs: PREFS_NOVAS, cliente });
    await vi.waitFor(() => expect(enfileirada).toHaveBeenCalledTimes(1));
    const segunda = salvarPrefsOuDesfazer({ userId: "u1", prefs: PREFS_DA_SEGUNDA, cliente });
    await vi.waitFor(() => expect(enfileirada).toHaveBeenCalledTimes(2));
    // as duas em curso: o cache mostra a última tentada
    expect(cliente.getQueryData<LinhaPerfil>(chaves.perfil())?.prefs).toEqual(PREFS_DA_SEGUNDA);
    const [um, dois] = maos;
    if (!um || !dois) throw new Error("a fila falsa não recebeu as duas");
    return { primeira, segunda, um, dois };
  }

  const prefsNoCache = (cliente: QueryClient) => cliente.getQueryData<LinhaPerfil>(chaves.perfil())?.prefs;

  it("sobrepostas, a segunda passa antes e a primeira falha: a mudança da primeira foi na segunda — as duas terminam bem", async () => {
    const cliente = comPerfil();
    const { primeira, segunda, um, dois } = await sobrepostas(cliente);
    dois.passar();
    await segunda;
    um.recusar(new Error("QuotaExceededError"));
    await expect(primeira).resolves.toBeUndefined();
    expect(prefsNoCache(cliente)).toEqual(PREFS_DA_SEGUNDA);
  });

  it("sobrepostas, a primeira falha antes e a segunda passa: a primeira espera e termina bem (a tela diz salvo)", async () => {
    const cliente = comPerfil();
    const { primeira, segunda, um, dois } = await sobrepostas(cliente);
    let primeiraTerminou = false;
    void primeira.then(
      () => (primeiraTerminou = true),
      () => (primeiraTerminou = true),
    );
    um.recusar(new Error("QuotaExceededError"));
    await new Promise((r) => setTimeout(r, 10));
    // não decide antes de saber da segunda, nem mexe no cache
    expect(primeiraTerminou).toBe(false);
    expect(prefsNoCache(cliente)).toEqual(PREFS_DA_SEGUNDA);
    dois.passar();
    await expect(segunda).resolves.toBeUndefined();
    await expect(primeira).resolves.toBeUndefined();
    expect(prefsNoCache(cliente)).toEqual(PREFS_DA_SEGUNDA);
  });

  it("sobrepostas e as duas falham (a primeira antes): o cache volta às prefs de antes das duas (auditoria r30)", async () => {
    const cliente = comPerfil();
    const { primeira, segunda, um, dois } = await sobrepostas(cliente);
    um.recusar(new Error("x"));
    dois.recusar(new Error("y"));
    await expect(primeira).rejects.toThrow("x");
    await expect(segunda).rejects.toThrow("y");
    // nem 06:15 (a da primeira, que nunca entrou na fila) nem 18:30
    expect(prefsNoCache(cliente)).toEqual(PREFS_ANTES);
  });

  it("sobrepostas e as duas falham (a segunda antes): o cache também volta às de antes", async () => {
    const cliente = comPerfil();
    const { primeira, segunda, um, dois } = await sobrepostas(cliente);
    dois.recusar(new Error("y"));
    um.recusar(new Error("x"));
    await expect(segunda).rejects.toThrow("y");
    await expect(primeira).rejects.toThrow("x");
    expect(prefsNoCache(cliente)).toEqual(PREFS_ANTES);
  });

  it("sobrepostas, a segunda falha antes e a primeira passa depois: o cache volta à primeira (a que entrou na fila)", async () => {
    const cliente = comPerfil();
    const { primeira, segunda, um, dois } = await sobrepostas(cliente);
    dois.recusar(new Error("y"));
    await new Promise((r) => setTimeout(r, 10));
    // a primeira ainda pode entrar: nada de voltar às de antes agora
    expect(prefsNoCache(cliente)).toEqual(PREFS_DA_SEGUNDA);
    um.passar();
    await expect(primeira).resolves.toBeUndefined();
    await expect(segunda).rejects.toThrow("y");
    expect(prefsNoCache(cliente)).toEqual(PREFS_NOVAS);
  });

  it("sobrepostas, a primeira passa e a segunda falha: o cache volta à primeira", async () => {
    const cliente = comPerfil();
    const { primeira, segunda, um, dois } = await sobrepostas(cliente);
    um.passar();
    await primeira;
    dois.recusar(new Error("y"));
    await expect(segunda).rejects.toThrow("y");
    expect(prefsNoCache(cliente)).toEqual(PREFS_NOVAS);
  });

  it("depois de um grupo que falhou, a gravação seguinte parte do cache confirmado", async () => {
    enfileirada.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(undefined);
    const cliente = comPerfil();
    await expect(salvarPrefsOuDesfazer({ userId: "u1", prefs: PREFS_NOVAS, cliente })).rejects.toThrow("x");
    expect(prefsNoCache(cliente)).toEqual(PREFS_ANTES);
    await salvarPrefsOuDesfazer({ userId: "u1", prefs: PREFS_DA_SEGUNDA, cliente });
    expect(prefsNoCache(cliente)).toEqual(PREFS_DA_SEGUNDA);
    enfileirada.mockRejectedValueOnce(new Error("z"));
    await expect(salvarPrefsOuDesfazer({ userId: "u1", prefs: PREFS_NOVAS, cliente })).rejects.toThrow("z");
    expect(prefsNoCache(cliente)).toEqual(PREFS_DA_SEGUNDA);
  });
});

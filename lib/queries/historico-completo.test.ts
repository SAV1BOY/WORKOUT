import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_DA_TABELA, type Linha } from "@/lib/backup";
import { lerTabelaCompleta } from "@/lib/queries/ler";
import { exportarBackup, lerChavesExistentes } from "@/lib/queries/mais";
import { useSeriesTodas, useSessoesTodas } from "@/lib/queries/progresso";
import { useCardioTodos, useSoltasTodas } from "@/lib/queries/dados";
import { clienteNavegador } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: (opcoes: { queryFn: (ctx: { client: QueryClient; signal: AbortSignal }) => Promise<unknown> }) =>
    opcoes.queryFn({ client: new QueryClient(), signal: new AbortController().signal }),
}));

const uid = "pessoa";
const dia = "2026-11-18";
function gerar(quantidade: number): Linha[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: String(i + 1).padStart(6, "0"), user_id: uid, data: dia, registrada_em: dia,
  }));
}
const trocas = [
  ["A1", "agachamento-livre", "agachamento-frontal"],
  ["A1", "supino-reto-com-barra", "flexao-de-braco"],
  ["SA", "puxada-alta-na-polia", "barra-fixa-pronada"],
  ["SA", "supino-inclinado-com-halteres", "flexao-de-braco"],
  ["SA", "supino-reto-com-barra", "flexao-de-braco"],
].map(([workout_id, exercicio_original_id, substituto_id]) => ({ user_id: uid, workout_id, exercicio_original_id, substituto_id }));
const series = gerar(5007);
const ultimoRegistro = {
  id: series.at(-1)!.id, user_id: uid, registrada_em: dia, exercise_id: "levantamento-terra", session_id: "livre-antigo", ordem_ex: 6,
  set_index: 3, tipo: "aquecimento", reps: 8, reps_lado2: 7, carga_kg: 2.5,
  tempo_s: 16, tempo_s_lado2: 14, passos: 12, assistencia: "media", concluida: true,
};
series[series.length - 1] = ultimoRegistro;
const dados: Record<string, Linha[]> = {
  trocas_do_programa: [...trocas].reverse().concat({ ...trocas[0]!, user_id: "outra-conta" }),
  sessions: gerar(501),
  session_sets: series,
  cardio_sessions: [{ id: "000000", user_id: uid, data: "2026-11-19" }, ...gerar(802),
    { id: "zzz", user_id: uid, data: "2026-11-17" }],
  pullup_singles: gerar(2002),
  exercise_state: Array.from({ length: 1200 }, (_, i) => ({
    user_id: uid, exercise_id: String(i).padStart(5, "0"),
  })),
};
let falhar = false;
const limiteServidor = 120;
let limiteTrocas = limiteServidor;
let consultasTrocas = 0;

beforeEach(() => {
  falhar = false;
  limiteTrocas = limiteServidor;
  consultasTrocas = 0;
  const servidor: typeof fetch = async (input, opcoes) => {
    const url = new URL(String(input));
    const tabela = url.pathname.split("/").at(-1)!;
    const chave = CHAVE_DA_TABELA[tabela as keyof typeof CHAVE_DA_TABELA].at(-1)!;
    const campos = tabela === "trocas_do_programa" ? ["workout_id", chave] : [chave];
    expect(url.searchParams.get("order")).toBe(campos.map((c) => `${c}.asc`).join(","));
    if (falhar && url.searchParams.has(chave) && tabela === "session_sets") {
      return Response.json({ message: "leitura interrompida" }, { status: 400 });
    }
    const linhas = (dados[tabela] ?? []).filter((linha) => {
      for (const [coluna, filtro] of url.searchParams) {
        if (filtro.startsWith("eq.") && linha[coluna] !== filtro.slice(3)) return false;
        if (filtro.startsWith("gte.") && String(linha[coluna]) < filtro.slice(4)) return false;
        if (filtro.startsWith("lte.") && String(linha[coluna]) > filtro.slice(4)) return false;
        if (filtro.startsWith("gt.") && String(linha[coluna]) <= filtro.slice(3)) return false;
      }
      return true;
    }).sort((a, b) => {
      for (const campo of campos) {
        const ordem = String(a[campo]).localeCompare(String(b[campo]));
        if (ordem) return ordem;
      }
      return 0;
    });
    if (tabela === "trocas_do_programa") consultasTrocas++;
    const limite = tabela === "trocas_do_programa" ? limiteTrocas : limiteServidor;
    const select = url.searchParams.get("select")!;
    const corpo = linhas.slice(0, limite).map((l) =>
      select === "*" ? l : Object.fromEntries(select.split(",").map((c) => [c, l[c]])),
    );
    const headers = new Headers();
    if (new Headers(opcoes?.headers).get("Prefer")?.includes("count=exact")) {
      headers.set("content-range", `*/${linhas.length}`);
    }
    return Response.json(corpo, { headers });
  };
  vi.mocked(clienteNavegador).mockReturnValue(
    createClient("https://supabase.test", "teste", {
      global: { fetch: servidor }, auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
});

describe("histórico maior que uma página do servidor", () => {
  it("exporta mais de 5.000 séries e procura também as chaves da última página na importação", async () => {
    const backup = await exportarBackup({ userId: uid, agora: dia });
    expect(backup.tabelas.session_sets).toEqual(dados.session_sets);
    expect(backup.tabelas.trocas_do_programa).toEqual(trocas);
    expect(consultasTrocas).toBe(1);
    expect(backup.tabelas.exercise_state).toEqual(dados.exercise_state);
    const chaves = await lerChavesExistentes(uid);
    expect(chaves.session_sets).toEqual(dados.session_sets!.map(({ id }) => ({ id })));
    expect(chaves.exercise_state).toEqual(dados.exercise_state);
  });

  it("exporta e encontra as chaves de todos os treinos mesmo se o servidor cortar o mesmo exercício entre páginas", async () => {
    limiteTrocas = 2;
    const exportadas = await lerTabelaCompleta("trocas_do_programa", "*", "trocas", uid);
    expect(exportadas).toEqual(trocas);
    const chaves = await lerChavesExistentes(uid);
    expect(chaves.trocas_do_programa).toEqual(trocas.map(({ user_id, workout_id, exercicio_original_id }) => ({
      user_id, workout_id, exercicio_original_id,
    })));
  });

  it("inclui no relatório toda a força, cardio e barra, mesmo com a mesma data em páginas diferentes", async () => {
    const sessoes = await (useSessoesTodas() as unknown as Promise<Linha[]>);
    expect(sessoes.map(s => s.id)).toEqual(dados.sessions!.map(s => s.id));
    for (const [consulta, tabela] of [
      [useSeriesTodas, "session_sets"],
      [useCardioTodos, "cardio_sessions"], [useSoltasTodas, "pullup_singles"],
    ] as const) {
      const lista = await (consulta(uid) as unknown as Promise<{linhas: Linha[]; completa: boolean}>);
      expect(lista.completa).toBe(true);
      expect(lista.linhas.map((linha) => linha.id)).toEqual(dados[tabela]!.map((linha) => linha.id));
      if (tabela === "session_sets") expect(lista.linhas.at(-1)).toEqual(ultimoRegistro);
    }
  });

  it("pagina o cardio do calendário por UUID conservando a data e a conta em todas as páginas", async () => {
    const cardios = await lerTabelaCompleta<Linha>("cardio_sessions", "*", "o período", uid, undefined, { de: dia, ate: dia });
    expect(cardios).toEqual(gerar(802));
  });

  it("interrompe a exportação se uma leitura falhar no meio", async () => {
    falhar = true;
    await expect(exportarBackup({ userId: uid, agora: dia })).rejects.toThrow("leitura interrompida");
  });
});

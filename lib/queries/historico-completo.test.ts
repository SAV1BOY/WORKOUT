import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_DA_TABELA, type Linha } from "@/lib/backup";
import { exportarBackup, lerChavesExistentes } from "@/lib/queries/mais";
import { useSeriesTodas, useSessoesTodas } from "@/lib/queries/progresso";
import { useCardioTodos, useSoltasTodas } from "@/lib/queries/dados";
import { clienteNavegador } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: (opcoes: { queryFn: () => Promise<unknown> }) => opcoes.queryFn(),
}));

const uid = "pessoa";
const dia = "2026-11-18";
function gerar(quantidade: number): Linha[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: String(i + 1).padStart(6, "0"), user_id: uid, data: dia, registrada_em: dia,
  }));
}
const dados: Record<string, Linha[]> = {
  sessions: gerar(501),
  session_sets: gerar(5007),
  cardio_sessions: gerar(802),
  pullup_singles: gerar(2002),
  exercise_state: Array.from({ length: 1200 }, (_, i) => ({
    user_id: uid, exercise_id: String(i).padStart(5, "0"),
  })),
};
let falhar = false;
const limiteServidor = 120;

beforeEach(() => {
  falhar = false;
  const servidor: typeof fetch = async (input, opcoes) => {
    const url = new URL(String(input));
    const tabela = url.pathname.split("/").at(-1)!;
    const [campo, sentido] = url.searchParams.get("order")!.split(".");
    expect(campo).toBe(CHAVE_DA_TABELA[tabela as keyof typeof CHAVE_DA_TABELA].at(-1));
    expect(sentido).toBe("asc");
    const cursor = url.searchParams.get(campo!)?.replace(/^gt\./, "");
    if (falhar && cursor && tabela === "session_sets") {
      return Response.json({ message: "leitura interrompida" }, { status: 400 });
    }
    const linhas = (dados[tabela] ?? []).filter((l) => !cursor || String(l[campo!]) > cursor);
    const select = url.searchParams.get("select")!;
    const corpo = linhas.slice(0, limiteServidor).map((l) =>
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
    expect(backup.tabelas.exercise_state).toEqual(dados.exercise_state);
    const chaves = await lerChavesExistentes(uid);
    expect(chaves.session_sets).toEqual(dados.session_sets!.map(({ id }) => ({ id })));
    expect(chaves.exercise_state).toEqual(dados.exercise_state);
  });

  it("inclui no relatório toda a força, cardio e barra, mesmo com a mesma data em páginas diferentes", async () => {
    for (const [consulta, tabela] of [
      [useSessoesTodas, "sessions"], [useSeriesTodas, "session_sets"],
      [useCardioTodos, "cardio_sessions"], [useSoltasTodas, "pullup_singles"],
    ] as const) {
      const linhas = await (consulta() as unknown as Promise<Linha[]>);
      expect(linhas.map((linha) => linha.id)).toEqual(dados[tabela]!.map((linha) => linha.id));
    }
  });

  it("interrompe a exportação se uma leitura falhar no meio", async () => {
    falhar = true;
    await expect(exportarBackup({ userId: uid, agora: dia })).rejects.toThrow("leitura interrompida");
  });
});

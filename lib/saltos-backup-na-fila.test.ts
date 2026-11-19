import "fake-indexeddb/auto";
import { createClient, type Session } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { linhasParaImportar, montarBackup } from "@/lib/backup";
import { bd } from "@/lib/db";
import { definirEnviador, processar } from "@/lib/outbox";
import { enfileirarEscrita, enviarItem } from "@/lib/outbox-supabase";
import { confirmarSaltosPendentes, listarConciliacoesDeSaltos, listarSaltosPendentes, resolverConciliacaoDeSaltos } from "@/lib/saltos-pendentes";
import { clienteNavegador } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));

const conta = "e2020000-1234-4000-9000-aaaaaaaaaaaa";
const id = "e2020000-1234-4000-9000-bbbbbbbbbbbb";
const original = { id, user_id: conta, tipo: "corda", data: "2026-11-11", concluida: true, semana_plano: 1,
  duracao_min: 8.5, distancia_km: null, saltos: 42.5, notas: "Antes da recuperação.", esforco: "moderado",
  planejado: { repeticoes: 6 }, feito: { repeticoes_cumpridas: 2 } };

afterEach(async () => {
  await bd().outbox.clear();
  await bd().cache.clear();
  vi.unstubAllGlobals();
});

type Linha = Record<string, unknown>;

function servidor(inicial: Linha | null, usuaria = conta) {
  let remota = inicial;
  const chamadas: { metodo: string; dados: unknown; filtro: Record<string, string> }[] = [];
  const client = createClient("https://supabase.test", "anon", { auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: async (recurso, init) => {
      const url = new URL(String(recurso));
      expect(url.pathname).toBe("/rest/v1/cardio_sessions");
      const metodo = init!.method!;
      const dados = init!.body ? JSON.parse(String(init!.body)) : null;
      const filtro = Object.fromEntries(url.searchParams);
      chamadas.push({ metodo, dados, filtro });
      if (metodo === "GET") return Response.json(remota ? [remota] : []);
      if (metodo === "PATCH") {
        if (remota && Object.entries(filtro).every(([k, v]) => k === "select" || v === "eq." + remota![k])) {
          remota = { ...remota, ...dados };
        }
      } else {
        expect(metodo).toBe("POST");
        const linha = Array.isArray(dados) ? dados[0] : dados;
        if (!remota || !new Headers(init!.headers).get("Prefer")?.includes("resolution=ignore-duplicates")) {
          remota = { concluida: false, saltos: null, ...remota, ...linha };
        }
      }
      return filtro.select ? Response.json(remota ? [remota] : []) : new Response(null, { status: 201 });
    } },
  });
  vi.spyOn(client.auth, "getSession").mockResolvedValue({ data: { session: { user: { id: usuaria } } as Session }, error: null });
  vi.mocked(clienteNavegador).mockReturnValue(client);
  return { atual: () => remota, chamadas };
}

async function importarECorrigir(importada: Linha, valor: number) {
  definirEnviador(enviarItem);
  vi.stubGlobal("navigator", { onLine: false });
  await enfileirarEscrita("cardio", { tabela: "cardio_sessions", op: "upsert", onConflict: "id", linha: original });
  const backup = montarBackup({ userId: conta, exportadoEm: original.data, tabelas: { cardio_sessions: [importada] } });
  const [lote] = linhasParaImportar(backup, conta);
  await enfileirarEscrita("cardio", { ...lote!, op: "upsert" });
  const [pendencia] = await listarSaltosPendentes(conta);
  await confirmarSaltosPendentes(conta, pendencia!, valor);
  vi.stubGlobal("navigator", { onLine: true });
  await processar();
}

it("a importação válida da mesma corda conserva também a nota e os blocos quando a fila esvazia", async () => {
  const importada = { ...original, notas: "Anotação corrigida no backup.", duracao_min: 15.5, saltos: 70,
    esforco: "facil", feito: { repeticoes_cumpridas: 6 } };
  const api = servidor({ ...original, saltos: 70 });
  await importarECorrigir(importada, 70);
  expect(api.atual()).toEqual(importada);
  expect(await bd().outbox.toArray()).toEqual([]);
  expect(api.chamadas.map(c => c.metodo)).toEqual(["PATCH", "GET"]);
  expect(api.chamadas[0]?.dados).not.toHaveProperty("saltos");
});

it.each([false, true])("uma importação parcial aplica sua nota e mantém os campos omitidos, registro ausente: %s", async ausente => {
  const anterior = { ...original, saltos: 75, duracao_min: 15.5, feito: { repeticoes_cumpridas: 4 } };
  const api = servidor(ausente ? null : anterior);
  const nota = { id, user_id: conta, data: original.data, tipo: "corda", notas: "Anotação posterior do arquivo." };
  await importarECorrigir(nota, 75);
  expect(api.atual()).toEqual({ ...(ausente ? original : anterior), notas: nota.notas, saltos: 75 });
  expect(await bd().outbox.toArray()).toEqual([]);
  expect(api.chamadas[0]?.dados).toEqual({ notas: nota.notas });
  expect(api.chamadas.filter(c => c.metodo === "POST")).toHaveLength(ausente ? 1 : 0);
});

it("uma corrida inserida pelo outro aparelho conserva o treino mesmo enquanto o backup da corda aguarda", async () => {
  const corrida = { ...original, tipo: "corrida", data: "2026-11-12", distancia_km: 4.25, saltos: null,
    notas: "Nota da corrida.", duracao_min: 22.5 };
  const api = servidor(corrida);
  await importarECorrigir({ ...original, saltos: 70, duracao_min: 15.5, notas: "Nota da corda." }, 70);
  expect(api.atual()).toEqual(corrida);
  expect(api.chamadas.map(c => c.metodo)).toEqual(["PATCH", "GET"]);
  expect(api.chamadas[0]?.filtro).toEqual({ user_id: "eq." + conta, id: "eq." + id, tipo: "eq.corda",
    data: "eq." + original.data, concluida: "eq.true" });
  const [conflito] = await listarConciliacoesDeSaltos(conta);
  expect(conflito).toMatchObject({ estado: "conflito", mesmaIdentidade: false, remota: corrida });
  vi.stubGlobal("navigator", { onLine: false });
  await resolverConciliacaoDeSaltos(conta, conflito!, "historico");
  vi.stubGlobal("navigator", { onLine: true });
  await processar();
  expect(await bd().outbox.toArray()).toEqual([]);
  expect(api.atual()).toEqual(corrida);
  expect(api.chamadas.filter(c => c.metodo === "POST")).toHaveLength(0);
});

it("o login de outra pessoa não confirma nem envia a edição do backup que está na fila", async () => {
  const api = servidor(null, "e2020000-1234-4000-9000-cccccccccccc");
  await expect(enviarItem({ tipo: "cardio", id: 7, tentativas: 0, criadoEm: 0, proximaTentativa: 0,
    payload: { tabela: "cardio_sessions", op: "update", filtro: { user_id: conta, id, tipo: "corda", data: original.data },
      linha: { notas: "Anotação do arquivo." } },
  })).rejects.toThrow("Aguardando a conta");
  expect(api.chamadas).toEqual([]);
});

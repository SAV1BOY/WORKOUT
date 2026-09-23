/**
 * `POST /api/lembretes/teste` (SPEC §23.5, aceite §23.7 item 8): as respostas
 * que não dependem do serviço de push — sem configuração, sem sessão, sem a
 * tabela, erro do banco, nenhum aparelho e endpoint fora da lista.
 *
 * O cliente do Supabase do servidor é trocado por um de mentira (o e2e alcança
 * só o navegador; o `PGRST205` do banco, visto pela rota, só se prova aqui).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEM_CONFIGURACAO, SEM_TABELA, textoDoResultado } from "@/lib/lembretes";
import { publicaDaPrivada } from "@/lib/web-push";

/** O que o banco de mentira devolve: a sessão e a leitura da tabela. */
const banco = vi.hoisted(() => ({
  usuario: null as { id: string } | null,
  leitura: { data: null, error: null } as { data: unknown; error: { code?: string; message?: string } | null },
  tabelas: [] as string[],
  apagados: 0,
}));

vi.mock("@/lib/supabase/server", () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: banco.usuario } }) },
    from: (tabela: string) => {
      banco.tabelas.push(tabela);
      return {
        select: async () => banco.leitura,
        delete: () => ({
          eq: async () => {
            banco.apagados += 1;
            return { error: null };
          },
        }),
      };
    },
  }),
}));

const { POST } = await import("@/app/api/lembretes/teste/route");

// a chave privada de exemplo da RFC 8291 (Apêndice A), usada aqui só como par VAPID de teste
const PRIVADA = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";

async function pedir(): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const resposta = await POST();
  return { status: resposta.status, corpo: (await resposta.json()) as Record<string, unknown> };
}

describe("POST /api/lembretes/teste", () => {
  let buscar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicaDaPrivada(PRIVADA));
    vi.stubEnv("VAPID_PRIVATE_KEY", PRIVADA);
    vi.stubEnv("VAPID_SUBJECT", "mailto:dono@example.com");
    vi.stubEnv("LEMBRETES_PUSH_DE_TESTE", "");
    banco.usuario = { id: "00000000-0000-4000-8000-000000000001" };
    banco.leitura = { data: [], error: null };
    banco.tabelas = [];
    banco.apagados = 0;
    buscar = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("nenhum push deveria sair neste teste"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    buscar.mockRestore();
  });

  it("sem as variáveis VAPID: 503 com o texto da tela, sem nem abrir o banco", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(await pedir()).toEqual({ status: 503, corpo: { erro: SEM_CONFIGURACAO } });
    expect(banco.tabelas).toEqual([]);
  });

  it("a pública que não é a do par também é 'não configurado'", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicaDaPrivada("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"));
    expect(await pedir()).toEqual({ status: 503, corpo: { erro: SEM_CONFIGURACAO } });
  });

  it("sem sessão: 401, sem ler a tabela", async () => {
    banco.usuario = null;
    const { status } = await pedir();
    expect(status).toBe(401);
    expect(banco.tabelas).toEqual([]);
  });

  it.each(["PGRST205", "42P01"])("sem a tabela no banco (%s): 503 com o texto de SEM_TABELA", async (code) => {
    banco.leitura = { data: null, error: { code, message: "Could not find the table" } };
    expect(await pedir()).toEqual({ status: 503, corpo: { erro: SEM_TABELA } });
    expect(banco.tabelas).toEqual(["lembretes_inscricoes"]);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("outro erro do banco: 502, nunca o texto de SEM_TABELA", async () => {
    banco.leitura = { data: null, error: { code: "PGRST301", message: "JWT expired" } };
    const { status, corpo } = await pedir();
    expect(status).toBe(502);
    expect(corpo.erro).toBe("Não deu para ler os aparelhos agora. Tente de novo.");
  });

  it("nenhum aparelho: 409 com o texto da tela", async () => {
    expect(await pedir()).toEqual({ status: 409, corpo: { erro: textoDoResultado([]) } });
  });

  it("endpoint fora dos serviços de push: não é chamado e conta como não enviado", async () => {
    banco.leitura = {
      data: [
        {
          id: "a1",
          endpoint: "https://mal.example/push/1",
          p256dh: "x",
          auth: "y",
          aparelho: "Chrome · Android",
          criado_em: "2026-09-23T12:00:00Z",
        },
      ],
      error: null,
    };
    const { status, corpo } = await pedir();
    expect(status).toBe(200);
    expect(buscar).not.toHaveBeenCalled();
    expect(corpo.texto).toBe("Não deu para enviar agora.");
    expect(corpo.resultados).toEqual([
      { id: "a1", aparelho: "Chrome · Android", destino: "recusado", status: null },
    ]);
    expect(banco.apagados).toBe(0);
  });
});

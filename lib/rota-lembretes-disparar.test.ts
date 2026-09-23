/**
 * `POST /api/lembretes/disparar` (SPEC §23.11, aceite §23.14 item 3): a porta
 * (segredo), o formato do corpo, o envio pelo `lib/web-push.ts` e a marcação
 * pela RPC `lembretes_resultado` — com o cliente do Supabase e o `fetch`
 * trocados (nenhuma rede de verdade).
 */
import { createECDH, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEM_CONFIGURACAO } from "@/lib/lembretes";
import { decifrarNoAparelho, publicaDaPrivada } from "@/lib/web-push";

const banco = vi.hoisted(() => ({
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  erro: null as { code: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  criarClienteServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      banco.rpcs.push({ nome, args });
      return { data: 1, error: banco.erro };
    },
  }),
}));

const { POST } = await import("@/app/api/lembretes/disparar/route");

// a chave privada de exemplo da RFC 8291 (Apêndice A), usada aqui só como par VAPID de teste
const PRIVADA = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const SEGREDO = "segredo-de-teste-que-nao-e-de-producao";
const PUSH = "http://127.0.0.1:9";
const USUARIO = "0b6f1c2e-1111-4222-8333-944445555666";

function aparelho() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString("base64url"),
    privada: ecdh.getPrivateKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

/** Segunda 21/09/2026, dia de força; o lembrete do treino às 07:00 (10:00Z). */
function corpo(agora: string, extra: Record<string, unknown> = {}, inscricoes: unknown[] = []) {
  return {
    agora,
    usuarios: [
      {
        user_id: USUARIO,
        perfil: {
          data_inicio: "2026-09-01",
          fase_atual: "fase1",
          fase_desde: "2026-09-01",
          ultimo_treino: null,
          semana_corrida: 3,
          semana_corda: 1,
          semana_fixa: 1,
          prefs: { lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: false, hora: "07:00" } } },
        },
        overrides: [],
        sessoes: [],
        cardios: [],
        enviados: [],
        inscricoes,
        ...extra,
      },
    ],
  };
}

async function pedir(dados: unknown, segredo: string | null = SEGREDO) {
  const cabecalhos: Record<string, string> = { "content-type": "application/json" };
  if (segredo !== null) cabecalhos["x-lembretes-segredo"] = segredo;
  const r = await POST(
    new Request("http://localhost/api/lembretes/disparar", {
      method: "POST",
      headers: cabecalhos,
      body: typeof dados === "string" ? dados : JSON.stringify(dados),
    }),
  );
  return { status: r.status, corpo: (await r.json()) as Record<string, unknown> };
}

describe("POST /api/lembretes/disparar", () => {
  let buscar: ReturnType<typeof vi.spyOn>;
  let pushes: { url: string; corpo: Buffer; cabecalhos: Record<string, string> }[];
  let statusDoPush: (url: string) => number;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicaDaPrivada(PRIVADA));
    vi.stubEnv("VAPID_PRIVATE_KEY", PRIVADA);
    vi.stubEnv("VAPID_SUBJECT", "mailto:dono@example.com");
    vi.stubEnv("LEMBRETES_SEGREDO", SEGREDO);
    vi.stubEnv("LEMBRETES_PUSH_DE_TESTE", PUSH);
    banco.rpcs = [];
    banco.erro = null;
    pushes = [];
    statusDoPush = () => 201;
    buscar = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opcoes) => {
      const u = String(url);
      pushes.push({
        url: u,
        corpo: Buffer.from(opcoes?.body as Uint8Array),
        cabecalhos: opcoes?.headers as Record<string, string>,
      });
      return new Response(null, { status: statusDoPush(u) });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    buscar.mockRestore();
  });

  it("sem LEMBRETES_SEGREDO no servidor: 503 SEM_CONFIGURACAO, sem nada sair", async () => {
    vi.stubEnv("LEMBRETES_SEGREDO", "");
    expect(await pedir(corpo("2026-09-21T10:00:00Z"))).toEqual({
      status: 503,
      corpo: { erro: SEM_CONFIGURACAO, codigo: "SEM_CONFIGURACAO" },
    });
    expect(pushes).toEqual([]);
    expect(banco.rpcs).toEqual([]);
  });

  it("segredo errado ou ausente: 401, sem ler o corpo nem enviar", async () => {
    const a = aparelho();
    const dados = corpo("2026-09-21T10:00:00Z", {}, [{ endpoint: `${PUSH}/__push/201/a`, p256dh: a.p256dh, auth: a.auth }]);
    expect((await pedir(dados, "outro")).status).toBe(401);
    expect((await pedir(dados, `${SEGREDO}x`)).status).toBe(401);
    expect((await pedir(dados, null)).status).toBe(401);
    expect(pushes).toEqual([]);
    expect(banco.rpcs).toEqual([]);
  });

  it("sem as variáveis VAPID: 503", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect((await pedir(corpo("2026-09-21T10:00:00Z"))).status).toBe(503);
  });

  it("corpo fora do formato: 400", async () => {
    expect((await pedir("não é json")).status).toBe(400);
    expect((await pedir({ agora: "ontem", usuarios: [] })).status).toBe(400);
    expect((await pedir({ ...corpo("2026-09-21T10:00:00Z"), usuarios: [{ user_id: "x" }] })).status).toBe(400);
  });

  it("na hora: envia o aviso do treino cifrado para cada aparelho e marca pela RPC", async () => {
    const a = aparelho();
    const b = aparelho();
    const dados = corpo("2026-09-21T10:05:00.123456+00:00", {}, [
      { endpoint: `${PUSH}/__push/201/a`, p256dh: a.p256dh, auth: a.auth },
      { endpoint: `${PUSH}/__push/201/b`, p256dh: b.p256dh, auth: b.auth },
    ]);
    const r = await pedir(dados);
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ contas: 1, avisos: 1, entregas: 2, marcados: 1, expirados: 0, gravado: true });
    expect(pushes.map((p) => p.url)).toEqual([`${PUSH}/__push/201/a`, `${PUSH}/__push/201/b`]);
    const aviso = JSON.parse(decifrarNoAparelho(pushes[0]!.corpo, a.privada, a.auth)) as Record<string, string>;
    expect(aviso.titulo).toBe("Hora do treino");
    expect(aviso.corpo).toMatch(/^Treino [AB] · \d+ exercícios · \d+ min$/);
    expect(aviso.url).toBe("/");
    expect(pushes[0]!.cabecalhos.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect(pushes[0]!.cabecalhos.Topic).toBe("lembrete-treino");
    expect(banco.rpcs).toEqual([
      {
        nome: "lembretes_resultado",
        args: { segredo: SEGREDO, enviados: [{ user_id: USUARIO, tipo: "treino", dia: "2026-09-21" }], expirados: [] },
      },
    ]);
  });

  it("já enviado hoje: não reenvia nem chama a RPC", async () => {
    const a = aparelho();
    const dados = corpo(
      "2026-09-21T10:10:00Z",
      { enviados: [{ tipo: "treino", dia: "2026-09-21" }] },
      [{ endpoint: `${PUSH}/__push/201/a`, p256dh: a.p256dh, auth: a.auth }],
    );
    const r = await pedir(dados);
    expect(r.corpo).toMatchObject({ avisos: 0, entregas: 0, marcados: 0 });
    expect(pushes).toEqual([]);
    expect(banco.rpcs).toEqual([]);
  });

  it("fora da hora (antes, ou depois dos 30 min) e em dia de descanso: nada", async () => {
    const a = aparelho();
    const inscricao = [{ endpoint: `${PUSH}/__push/201/a`, p256dh: a.p256dh, auth: a.auth }];
    for (const agora of ["2026-09-21T09:55:00Z", "2026-09-21T10:35:00Z", "2026-09-24T10:00:00Z"]) {
      expect((await pedir(corpo(agora, {}, inscricao))).corpo).toMatchObject({ avisos: 0 });
    }
    expect(pushes).toEqual([]);
  });

  it("410 do serviço de push: a inscrição vai como expirada; nenhum chegou, nada marcado", async () => {
    const a = aparelho();
    statusDoPush = () => 410;
    const dados = corpo("2026-09-21T10:00:00Z", {}, [{ endpoint: `${PUSH}/__push/410/a`, p256dh: a.p256dh, auth: a.auth }]);
    const r = await pedir(dados);
    expect(r.corpo).toMatchObject({ avisos: 1, entregas: 0, marcados: 0, expirados: 1 });
    expect(banco.rpcs[0]?.args).toEqual({ segredo: SEGREDO, enviados: [], expirados: [`${PUSH}/__push/410/a`] });
  });

  it("falha do serviço (500): nada marcado nem chamado — o próximo tick tenta de novo", async () => {
    const a = aparelho();
    statusDoPush = () => 500;
    const r = await pedir(corpo("2026-09-21T10:00:00Z", {}, [{ endpoint: `${PUSH}/__push/500/a`, p256dh: a.p256dh, auth: a.auth }]));
    expect(r.corpo).toMatchObject({ avisos: 1, entregas: 0, marcados: 0 });
    expect(banco.rpcs).toEqual([]);
  });

  it("endpoint fora da lista de serviços de push: não é chamado", async () => {
    const a = aparelho();
    const r = await pedir(corpo("2026-09-21T10:00:00Z", {}, [{ endpoint: "https://intranet.example/push", p256dh: a.p256dh, auth: a.auth }]));
    expect(r.corpo).toMatchObject({ avisos: 1, entregas: 0 });
    expect(pushes).toEqual([]);
  });

  it("a RPC recusou (segredo do Vault diferente): 502", async () => {
    const a = aparelho();
    banco.erro = { code: "28000" };
    const r = await pedir(corpo("2026-09-21T10:00:00Z", {}, [{ endpoint: `${PUSH}/__push/201/a`, p256dh: a.p256dh, auth: a.auth }]));
    expect(r.status).toBe(502);
    expect(r.corpo.gravado).toBe(false);
  });
});

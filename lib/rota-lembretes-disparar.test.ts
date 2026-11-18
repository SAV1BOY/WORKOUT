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
  /** O `AbortSignal` de cada chamada da RPC, na mesma ordem. */
  sinais: [] as AbortSignal[],
  erro: null as { code: string } | null,
  /** A RPC só responde quando o sinal aborta (o Supabase travado, §23.16). */
  travada: false,
}));

/** A conta cuja regra lança (a guarda por conta da rota, §23.16): marcada pela data de início. */
const regra = vi.hoisted(() => ({ lancarComInicio: null as string | null }));

vi.mock("@/lib/lembretes-regra", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/lembretes-regra")>();
  return {
    ...original,
    lembretesDevidos: (...args: Parameters<typeof original.lembretesDevidos>) => {
      if (regra.lancarComInicio && args[0].perfil.data_inicio === regra.lancarComInicio) {
        throw new Error("a regra não fechou com esta conta");
      }
      return original.lembretesDevidos(...args);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  criarClienteServidor: async () => ({
    // o builder do supabase-js: `.abortSignal()` e depois o resultado
    rpc: (nome: string, args: Record<string, unknown>) => {
      banco.rpcs.push({ nome, args });
      return {
        abortSignal(sinal: AbortSignal) {
          banco.sinais.push(sinal);
          if (!banco.travada) return Promise.resolve({ data: 1, error: banco.erro });
          return new Promise((_, recusar) =>
            sinal.addEventListener("abort", () => recusar(new DOMException("abortado", "AbortError"))),
          );
        },
      };
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
    banco.sinais = [];
    banco.erro = null;
    banco.travada = false;
    regra.lancarComInicio = null;
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

  it("corpo fora do formato (não é JSON, sem agora/usuarios): 400", async () => {
    expect((await pedir("não é json")).status).toBe(400);
    expect((await pedir({ agora: "ontem", usuarios: [] })).status).toBe(400);
    expect((await pedir({ agora: "2026-09-21T10:00:00Z" })).status).toBe(400);
    expect((await pedir({ agora: "2026-09-21T10:00:00Z", usuarios: {} })).status).toBe(400);
  });

  it("conta fora do formato no meio (§23.15): é pulada e contada, as outras recebem", async () => {
    const a = aparelho();
    const c = aparelho();
    const base = corpo("2026-09-21T10:00:00Z");
    const boa = base.usuarios[0]!;
    const primeira = {
      ...boa,
      inscricoes: [{ endpoint: `${PUSH}/__push/201/primeira`, p256dh: a.p256dh, auth: a.auth }],
    };
    const ultima = {
      ...boa,
      user_id: "0b6f1c2e-1111-4222-8333-944445555777",
      inscricoes: [{ endpoint: `${PUSH}/__push/201/ultima`, p256dh: c.p256dh, auth: c.auth }],
    };
    // uma sem formato nenhum, uma com user_id inválido e uma "gigante" com a fase errada
    const gigante = {
      ...boa,
      user_id: "0b6f1c2e-1111-4222-8333-944445555888",
      perfil: { ...boa.perfil, fase_atual: "fase9", prefs: { lixo: "x".repeat(100_000) } },
    };
    const r = await pedir({
      agora: base.agora,
      usuarios: [primeira, { user_id: "x" }, gigante, "nem objeto", ultima],
    });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ contas: 2, invalidas: 3, avisos: 2, entregas: 2, marcados: 2 });
    expect(pushes.map((p) => p.url).sort()).toEqual([`${PUSH}/__push/201/primeira`, `${PUSH}/__push/201/ultima`]);
    expect(banco.rpcs[0]?.args).toEqual({
      segredo: SEGREDO,
      enviados: [
        { user_id: USUARIO, tipo: "treino", dia: "2026-09-21" },
        { user_id: "0b6f1c2e-1111-4222-8333-944445555777", tipo: "treino", dia: "2026-09-21" },
      ],
      expirados: [],
    });
  });

  it("a regra lança numa conta (§23.16): ela é contada como inválida e as outras recebem", async () => {
    const a = aparelho();
    const c = aparelho();
    const base = corpo("2026-09-21T10:00:00Z");
    const boa = base.usuarios[0]!;
    const primeira = {
      ...boa,
      inscricoes: [{ endpoint: `${PUSH}/__push/201/primeira`, p256dh: a.p256dh, auth: a.auth }],
    };
    // válida pelo schema, mas a regra (forçada) lança com ela
    const quebra = {
      ...boa,
      user_id: "0b6f1c2e-1111-4222-8333-944445555999",
      perfil: { ...boa.perfil, data_inicio: "2026-09-02" },
      inscricoes: [{ endpoint: `${PUSH}/__push/201/quebra`, p256dh: a.p256dh, auth: a.auth }],
    };
    const ultima = {
      ...boa,
      user_id: "0b6f1c2e-1111-4222-8333-944445555777",
      inscricoes: [{ endpoint: `${PUSH}/__push/201/ultima`, p256dh: c.p256dh, auth: c.auth }],
    };
    regra.lancarComInicio = "2026-09-02";
    const r = await pedir({ agora: base.agora, usuarios: [primeira, quebra, ultima] });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ contas: 2, invalidas: 1, avisos: 2, entregas: 2, marcados: 2 });
    expect(pushes.map((p) => p.url).sort()).toEqual([`${PUSH}/__push/201/primeira`, `${PUSH}/__push/201/ultima`]);
  });

  it("a marcação leva um AbortSignal; o Supabase travado aborta no prazo e nada fica marcado (§23.16)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const a = aparelho();
      const base = corpo("2026-09-21T10:00:00Z", {}, [
        { endpoint: `${PUSH}/__push/201/um`, p256dh: a.p256dh, auth: a.auth },
      ]);
      banco.travada = true;
      const pedido = pedir(base);
      await vi.waitFor(() => expect(banco.rpcs).toHaveLength(1));
      const sinal = banco.sinais[0];
      expect(sinal).toBeInstanceOf(AbortSignal);
      expect(sinal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(20_000);
      const r = await pedido;
      expect(sinal?.aborted).toBe(true);
      expect(r.status).toBe(502);
      expect(r.corpo).toMatchObject({ entregas: 1, marcados: 1, gravado: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("corpo maior que 512 KiB em bytes (não em caracteres): 413, sem enviar", async () => {
    // 300 mil "ç" = 300 mil caracteres (< 512 Ki) mas 600 mil bytes em UTF-8 (> 512 KiB)
    const grande = JSON.stringify({ ...corpo("2026-09-21T10:00:00Z"), sobra: "ç".repeat(300_000) });
    expect(grande.length).toBeLessThan(512 * 1024);
    expect(Buffer.byteLength(grande, "utf8")).toBeGreaterThan(512 * 1024);
    expect(await pedir(grande)).toEqual({ status: 413, corpo: { erro: "Corpo grande demais." } });
    // logo abaixo do limite em bytes ainda é lido (e aqui recusado pelo formato)
    expect((await pedir(JSON.stringify({ sobra: "a".repeat(500_000) }))).status).toBe(400);
    expect(pushes).toEqual([]);
    expect(banco.rpcs).toEqual([]);
  });

  it("o limite é inclusivo: 512 KiB exatos são lidos; 1 byte a mais, 413", async () => {
    const LIMITE = 512 * 1024;
    const exato = (bytes: number) => {
      const casca = JSON.stringify({ sobra: "" });
      return JSON.stringify({ sobra: "a".repeat(bytes - Buffer.byteLength(casca, "utf8")) });
    };
    expect(Buffer.byteLength(exato(LIMITE), "utf8")).toBe(LIMITE);
    // lido até o fim e recusado só pelo formato
    expect((await pedir(exato(LIMITE))).status).toBe(400);
    expect(await pedir(exato(LIMITE + 1))).toEqual({ status: 413, corpo: { erro: "Corpo grande demais." } });
    expect(pushes).toEqual([]);
  });

  it("content-length declarado acima do limite: 413 antes de ler o corpo", async () => {
    const pequeno = JSON.stringify(corpo("2026-09-21T10:00:00Z"));
    const pedirDeclarando = async (declarado: number) => {
      const r = await POST(
        new Request("http://localhost/api/lembretes/disparar", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": String(declarado),
            "x-lembretes-segredo": SEGREDO,
          },
          body: pequeno,
        }),
      );
      return { status: r.status, corpo: (await r.json()) as Record<string, unknown> };
    };
    // o corpo de verdade é pequeno e válido; só o cabeçalho diz que passa do limite
    expect(await pedirDeclarando(512 * 1024 + 1)).toEqual({ status: 413, corpo: { erro: "Corpo grande demais." } });
    expect(pushes).toEqual([]);
    expect(banco.rpcs).toEqual([]);
    // declarar exatamente o limite não recusa: o corpo é lido e processado
    expect((await pedirDeclarando(512 * 1024)).status).toBe(200);
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

describe("POST /api/lembretes/disparar com aparelhos lentos (§23.15, aceite 3)", () => {
  let buscar: ReturnType<typeof vi.spyOn>;
  let chamados: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:30Z"));
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicaDaPrivada(PRIVADA));
    vi.stubEnv("VAPID_PRIVATE_KEY", PRIVADA);
    vi.stubEnv("VAPID_SUBJECT", "mailto:dono@example.com");
    vi.stubEnv("LEMBRETES_SEGREDO", SEGREDO);
    vi.stubEnv("LEMBRETES_PUSH_DE_TESTE", PUSH);
    banco.rpcs = [];
    banco.erro = null;
    chamados = [];
    // "/lento/" nunca responde (só aborta pelo prazo); o resto responde 201 na hora
    buscar = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opcoes) => {
      const u = String(url);
      chamados.push(u);
      if (u.includes("/lento/")) {
        return new Promise<Response>((_, rejeitar) => {
          opcoes?.signal?.addEventListener("abort", () => rejeitar(new Error("abortado")));
        });
      }
      return new Response(null, { status: 201 });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    buscar.mockRestore();
  });

  /** `n` contas, cada uma com um aparelho; as `lentas` primeiras não respondem. */
  function contas(n: number, lentas: number) {
    const base = corpo("2026-09-21T10:00:00Z").usuarios[0]!;
    return Array.from({ length: n }, (_, i) => {
      const a = aparelho();
      const tipo = i < lentas ? "lento" : "201";
      return {
        ...base,
        user_id: `0b6f1c2e-1111-4222-8333-${String(i).padStart(12, "0")}`,
        inscricoes: [{ endpoint: `${PUSH}/__push/${tipo}/${i}`, p256dh: a.p256dh, auth: a.auth }],
      };
    });
  }

  it("30 contas, as 10 primeiras lentas: as últimas também recebem, dentro do prazo total", async () => {
    const inicio = Date.now();
    let respondeu = Number.NaN;
    const pendente = pedir({ agora: "2026-09-21T10:00:00Z", usuarios: contas(30, 10) }).then((r) => {
      respondeu = Date.now();
      return r;
    });
    await vi.advanceTimersByTimeAsync(25_000);
    const r = await pendente;
    const levou = respondeu - inicio;
    expect(r.status).toBe(200);
    // as 20 rápidas chegaram — inclusive a última conta da lista
    expect(r.corpo).toMatchObject({ contas: 30, avisos: 30, entregas: 20, marcados: 20, adiadas: 0 });
    expect(chamados).toContain(`${PUSH}/__push/201/29`);
    const marcadas = (banco.rpcs[0]?.args.enviados as { user_id: string }[]).map((e) => e.user_id);
    expect(marcadas).toContain("0b6f1c2e-1111-4222-8333-000000000029");
    // as lentas não são marcadas (o próximo tick tenta de novo)
    expect(marcadas).not.toContain("0b6f1c2e-1111-4222-8333-000000000000");
    // serial seriam 10 × 10 s = 100 s; com a fila, um prazo de envio só (10 s ≤ 20 s total)
    expect(levou).toBeGreaterThanOrEqual(10_000);
    expect(levou).toBeLessThanOrEqual(20_000);
  });

  it("aparelhos lentos demais para o prazo total: o que não começou fica adiado, sem marcar", async () => {
    // 40 lentas ocupam a fila (8 por vez, 10 s cada): em 20 s cabem 16; o resto é adiado
    const pendente = pedir({ agora: "2026-09-21T10:00:00Z", usuarios: contas(41, 40) });
    await vi.advanceTimersByTimeAsync(25_000);
    const r = await pendente;
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ contas: 41, avisos: 41, marcados: 0 });
    expect((r.corpo.adiadas as number) > 0).toBe(true);
    expect(banco.rpcs).toEqual([]);
  });
});

/**
 * Mock local do Supabase — só para os testes de ponta a ponta (e2e/).
 *
 * Imita o suficiente do GoTrue (auth), do PostgREST (/rest/v1) e do Storage
 * (/storage/v1) para o app rodar sem um projeto Supabase de verdade. Estado em
 * memória, por processo; `POST /__mock/reset` zera e `POST /__mock/seed` semeia.
 *
 * NÃO faz parte do app: nada em app/, lib/ ou components/ importa este arquivo.
 *
 *   MOCK_SUPABASE_PORT=54321   porta (padrão 54321)
 *   MOCK_LOG=1                 uma linha por requisição
 *
 * Rodar:  npx tsx scripts/mock-supabase.ts
 */
import { createHmac, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const PORTA = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const LOG = process.env.MOCK_LOG === "1";
/**
 * O e-mail do DONO, como no banco de verdade (`public.allowed_email()` de
 * `supabase/schema.sql`, SPEC §21.1). Ele sempre pode criar conta — mesmo com
 * a cota cheia — e é o único que lê `contas_cadastradas()` e escreve em
 * `app_config`.
 */
const EMAIL_DO_DONO = (
  process.env.ALLOWED_EMAIL ?? "miguelgsaviotti29@gmail.com"
)
  .trim()
  .toLowerCase();
/**
 * A cota de contas (`public.app_config.max_contas`). A mensagem é a mesma que
 * o trigger `on_auth_user_vaga` levanta — o GoTrue de produção a embrulha em
 * "Database error saving new user", e `lib/erros-auth.ts` traduz as duas para
 * "Cadastro fechado no momento…".
 */
const LIMITE_PADRAO_DE_CONTAS = 5;
const ERRO_SEM_VAGA = "Cadastro fechado: o limite de contas foi atingido.";
const SEGREDO_JWT = process.env.MOCK_JWT_SECRET ?? "mock-jwt-secret-terraco";
const EMISSOR = `http://127.0.0.1:${PORTA}/auth/v1`;
const VALIDADE_S = 3600;

// =====================================================================
//  utilidades
// =====================================================================

type Linha = Record<string, unknown>;

function agora(): string {
  return new Date().toISOString();
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function b64url(entrada: Buffer | string): string {
  return Buffer.from(entrada)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function assinar(dados: string): string {
  return b64url(createHmac("sha256", SEGREDO_JWT).update(dados).digest());
}

function criarJwt(carga: Linha): string {
  const cabecalho = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify(carga));
  return `${cabecalho}.${corpo}.${assinar(`${cabecalho}.${corpo}`)}`;
}

function lerJwt(token: string): Linha | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [cabecalho, corpo, assinatura] = partes;
  if (!cabecalho || !corpo || !assinatura) return null;
  if (assinar(`${cabecalho}.${corpo}`) !== assinatura) return null;
  try {
    const carga = JSON.parse(
      Buffer.from(corpo, "base64url").toString("utf8"),
    ) as Linha;
    const exp = typeof carga.exp === "number" ? carga.exp : 0;
    if (exp * 1000 < Date.now()) return null;
    return carga;
  } catch {
    return null;
  }
}

/** Erro com código HTTP: qualquer rota pode lançar. */
class ErroMock extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Linha = {},
  ) {
    super(message);
  }
}

// =====================================================================
//  estado
// =====================================================================

interface Usuario {
  id: string;
  email: string;
  senha: string;
  created_at: string;
  /** last_sign_in_at de auth.users — a coluna que Mais → Contas mostra. */
  ultimo_acesso: string | null;
}

interface Arquivo {
  bytes: Buffer;
  tipo: string;
  criado_em: string;
  atualizado_em: string;
}

const usuarios = new Map<string, Usuario>(); // id -> usuário
const refresh = new Map<string, string>(); // refresh_token -> user_id
/** Quando cada refresh token foi trocado pela primeira vez (ms). */
const refreshTrocadoEm = new Map<string, number>();
/**
 * `refresh_token -> session_id`. Existe para o `POST /logout?scope=local`
 * poder derrubar **só** a sessão de quem pediu: sem isto o mock revogava
 * todos os refresh da conta e o "sair local" ficava indistinguível do global
 * (SPEC §9, §21.4 e §22.11).
 */
const sessaoDoRefresh = new Map<string, string>();
/**
 * Os logouts recebidos desde o último reset, com o escopo que veio na busca
 * da URL. É o que prova, num e2e, que o app manda `?scope=local` — o corpo do
 * `signOut` não passa por lugar nenhum onde o teste possa olhar.
 */
let logouts: { scope: string; em: string }[] = [];
/**
 * Janela de reuso do refresh token, como no GoTrue de verdade
 * (`SECURITY_REFRESH_TOKEN_REUSE_INTERVAL`, 10 s por padrão). Sem ela, o
 * servidor e o navegador renovando a sessão quase ao mesmo tempo — o que o
 * `@supabase/ssr` faz em toda navegação com o token vencido — derrubariam a
 * sessão no segundo pedido.
 */
const REUSO_DO_REFRESH_MS = 10_000;
const arquivos = new Map<string, Arquivo>(); // "<bucket>/<caminho>" -> bytes
let tabelas: Record<string, Linha[]> = {};
/**
 * `public.app_config` — a linha única da cota (SPEC §21.2). Fora do ESQUEMA
 * de propósito: não tem `user_id`, então não passa pela RLS por dono das
 * outras tabelas; quem manda nela é `sou_o_dono()`.
 */
let appConfig = { max_contas: LIMITE_PADRAO_DE_CONTAS, updated_at: agora() };

// ---------------------------------------------------------------------
//  o schema (supabase/schema.sql) traduzido para defaults e chaves
// ---------------------------------------------------------------------

type Padrao = () => unknown;

interface EspecTabela {
  /** coluna -> valor padrão (todas as colunas do schema aparecem aqui) */
  colunas: Record<string, Padrao>;
  /** chave primária real */
  chave: string[];
  /** outras chaves únicas (usadas em on_conflict) */
  unicos: string[][];
  /** trigger set_updated_at */
  tocaUpdatedAt: boolean;
  /**
   * Colunas `not null` SEM default que o insert tem de trazer (o mock não
   * inventa). `user_id` aqui = a policy `with check (user_id = auth.uid())`
   * reprova o insert sem ele (42501), como no banco real; as outras dão 23502.
   * Tabelas sem esta lista seguem com o `user_id` posto pelo mock.
   */
  obrigatorias?: string[];
  /** Sem policy de update: o PATCH não altera nenhuma linha (RLS). */
  semUpdate?: boolean;
}

const nulo: Padrao = () => null;
const uuid: Padrao = () => randomUUID();
const lit =
  (v: unknown): Padrao =>
  () =>
    v;

const ESQUEMA: Record<string, EspecTabela> = {
  profiles: {
    colunas: {
      user_id: nulo,
      nome: lit(""),   // handle_new_user() põe a parte do e-mail antes do @
      altura_cm: nulo,
      data_inicio: hoje,
      fase_atual: lit("fase1"),
      fase_desde: hoje,
      objetivo: lit("forca_musculo"),
      semana_corrida: lit(1),
      semana_corda: lit(1),
      semana_fixa: lit(1),
      ultimo_treino: nulo,
      /*
       * O default do `prefs` de supabase/schema.sql, letra por letra — SEM
       * `guia_visto`. SPEC §20.1 + §21.5.1: toda conta criada pelo cadastro
       * cai no guia de uso na primeira entrada, e é assim que os e2e a veem.
       * Quem quer entrar direto semeia o perfil com a marca
       * (`usuarioComPerfil` das fixtures faz isso).
       */
      prefs: () => ({
        tema: "auto",
        descanso_som: true,
        descanso_vibra: true,
        manter_tela: true,
      }),
      created_at: agora,
      updated_at: agora,
    },
    chave: ["user_id"],
    unicos: [],
    tocaUpdatedAt: true,
  },
  exercise_state: {
    colunas: {
      user_id: nulo,
      exercise_id: nulo,
      carga_atual_kg: nulo,
      reps_alvo: nulo,
      tempo_alvo_s: nulo,
      assistencia: nulo,
      incremento_kg: nulo,
      falhas_seguidas: lit(0),
      incremento_reduzido: lit(false),
      exigir_rep_extra: lit(false),
      semana_leve: lit(false),
      carga_antes_leve: nulo,
      sessoes_graca: lit(0),
      desativado: lit(false),
      notas: nulo,
      updated_at: agora,
    },
    chave: ["user_id", "exercise_id"],
    unicos: [],
    tocaUpdatedAt: true,
  },
  sessions: {
    colunas: {
      id: uuid,
      user_id: nulo,
      data: nulo,
      workout_id: nulo,
      fase: nulo,
      status: lit("em_andamento"),
      iniciada_em: agora,
      concluida_em: nulo,
      duracao_s: nulo,
      semana_plano: nulo,
      plano: nulo,
      sensacao: nulo,
      peso_corporal: nulo,
      notas: nulo,
      created_at: agora,
    },
    chave: ["id"],
    unicos: [],
    tocaUpdatedAt: false,
  },
  session_sets: {
    colunas: {
      id: uuid,
      session_id: nulo,
      user_id: nulo,
      exercise_id: nulo,
      ordem_ex: nulo,
      set_index: nulo,
      tipo: lit("trabalho"),
      reps_alvo_min: nulo,
      reps_alvo_max: nulo,
      reps: nulo,
      reps_lado2: nulo,
      carga_kg: nulo,
      tempo_s: nulo,
      tempo_s_lado2: nulo,
      passos: nulo,
      assistencia: nulo,
      concluida: lit(false),
      ultima_firme: nulo,
      rpe: nulo,
      registrada_em: agora,
    },
    chave: ["id"],
    unicos: [],
    tocaUpdatedAt: false,
  },
  progression_events: {
    colunas: {
      id: uuid,
      user_id: nulo,
      exercise_id: nulo,
      session_id: nulo,
      data: hoje,
      de: nulo,
      para: nulo,
      motivo: nulo,
      created_at: agora,
    },
    chave: ["id"],
    unicos: [],
    tocaUpdatedAt: false,
  },
  cardio_sessions: {
    colunas: {
      id: uuid,
      user_id: nulo,
      data: nulo,
      tipo: nulo,
      semana_plano: nulo,
      planejado: nulo,
      feito: nulo,
      duracao_min: nulo,
      distancia_km: nulo,
      saltos: nulo,
      esforco: nulo,
      concluida: lit(false),
      notas: nulo,
      created_at: agora,
    },
    chave: ["id"],
    unicos: [],
    tocaUpdatedAt: false,
  },
  pullup_singles: {
    colunas: {
      id: uuid,
      user_id: nulo,
      data: hoje,
      reps: lit(1),
      assistencia: nulo,
      created_at: agora,
    },
    chave: ["id"],
    unicos: [],
    tocaUpdatedAt: false,
  },
  body_weights: {
    colunas: {
      id: uuid,
      user_id: nulo,
      data: nulo,
      peso_kg: nulo,
      notas: nulo,
      created_at: agora,
    },
    chave: ["id"],
    unicos: [["user_id", "data"]],
    tocaUpdatedAt: false,
  },
  body_measurements: {
    colunas: {
      id: uuid,
      user_id: nulo,
      data: nulo,
      cintura_cm: nulo,
      peito_cm: nulo,
      quadril_cm: nulo,
      braco_dir_cm: nulo,
      braco_esq_cm: nulo,
      coxa_dir_cm: nulo,
      coxa_esq_cm: nulo,
      panturrilha_cm: nulo,
      notas: nulo,
      created_at: agora,
    },
    chave: ["id"],
    unicos: [["user_id", "data"]],
    tocaUpdatedAt: false,
  },
  progress_photos: {
    colunas: {
      id: uuid,
      user_id: nulo,
      data: nulo,
      angulo: lit("frente"),
      storage_path: nulo,
      notas: nulo,
      created_at: agora,
    },
    chave: ["id"],
    unicos: [],
    tocaUpdatedAt: false,
  },
  // SPEC §23.2: um aparelho inscrito nos lembretes (endpoint único na tabela)
  lembretes_inscricoes: {
    colunas: {
      id: uuid,
      user_id: nulo,
      endpoint: nulo,
      p256dh: nulo,
      auth: nulo,
      aparelho: lit(""),
      criado_em: agora,
      ultimo_envio_em: nulo,
      falhas: lit(0),
    },
    chave: ["id"],
    unicos: [["endpoint"]],
    tocaUpdatedAt: false,
    // §23.2: user_id sem default (o app manda o da sessão) e nada de update
    obrigatorias: ["user_id", "endpoint", "p256dh", "auth"],
    semUpdate: true,
  },
  schedule_overrides: {
    colunas: {
      id: uuid,
      user_id: nulo,
      data: nulo,
      tipo: nulo,
      workout_id: nulo,
      sessao: nulo,
      motivo: nulo,
    },
    chave: ["id"],
    unicos: [["user_id", "data"]],
    tocaUpdatedAt: false,
  },
};

const NOMES_TABELAS = Object.keys(ESQUEMA);
/** view calculada a partir de session_sets (não aceita escrita) */
const VIEWS = ["v_records"];
/** colunas das views (as das tabelas saem do ESQUEMA) */
const COLUNAS_VIEWS: Record<string, string[]> = {
  v_records: [
    "user_id",
    "exercise_id",
    "carga_max_kg",
    "e1rm_epley",
    "reps_max",
    "tempo_max_s",
  ],
};

/** Colunas que o recurso tem de verdade — para não fingir sucesso com typo. */
function colunasDe(recurso: string): Set<string> {
  const espec = ESQUEMA[recurso];
  if (espec) return new Set(Object.keys(espec.colunas));
  const view = COLUNAS_VIEWS[recurso];
  if (view) return new Set(view);
  throw new ErroMock(400, `mock: recurso ${recurso} não implementado`, {
    code: "PGRST205",
  });
}

function exigirColuna(recurso: string, coluna: string): void {
  if (!colunasDe(recurso).has(coluna)) {
    throw new ErroMock(
      400,
      `mock: coluna ${recurso}.${coluna} não existe em supabase/schema.sql`,
      { code: "42703" },
    );
  }
}

/**
 * Requisições recebidas desde o último reset (sem contar /__mock). Serve para
 * os testes provarem o negativo: "o app NÃO chamou o Supabase".
 */
let requisicoes: { metodo: string; caminho: string }[] = [];
const LIMITE_REQUISICOES = 500;

function registrarRequisicao(metodo: string, caminho: string): void {
  if (caminho.startsWith("/__mock")) return;
  requisicoes.push({ metodo, caminho });
  if (requisicoes.length > LIMITE_REQUISICOES) requisicoes.shift();
}

/**
 * O servidor de push de mentira (SPEC §23.5): `POST /__push/<status>/<id>`
 * guarda o pedido como chegou (cabeçalhos e corpo cifrado em base64) e
 * responde `<status>` — 201 é "entregue", 410 é "inscrição vencida". É o
 * `endpoint` que o aparelho de mentira do e2e grava na tabela.
 */
interface PushRecebido {
  caminho: string;
  authorization: string;
  ttl: string;
  encoding: string;
  topic: string;
  corpo_b64: string;
}
let pushes: PushRecebido[] = [];

function rotaPush(req: IncomingMessage, url: URL, bruto: Buffer): Resposta {
  if (req.method !== "POST") throw new ErroMock(405, "mock: push só aceita POST");
  const status = Number(/^\/__push\/(\d{3})\//.exec(url.pathname)?.[1] ?? 201);
  pushes.push({
    caminho: url.pathname,
    authorization: String(req.headers.authorization ?? ""),
    ttl: String(req.headers.ttl ?? ""),
    encoding: String(req.headers["content-encoding"] ?? ""),
    topic: String(req.headers.topic ?? ""),
    corpo_b64: bruto.toString("base64"),
  });
  return { status, corpo: null, cabecalhos: {} };
}

function zerar(): void {
  pushes = [];
  usuarios.clear();
  refresh.clear();
  refreshTrocadoEm.clear();
  sessaoDoRefresh.clear();
  logouts = [];
  arquivos.clear();
  requisicoes = [];
  appConfig = { max_contas: LIMITE_PADRAO_DE_CONTAS, updated_at: agora() };
  tabelas = Object.fromEntries(NOMES_TABELAS.map((t) => [t, [] as Linha[]]));
}

zerar();

function linhas(tabela: string): Linha[] {
  const atual = tabelas[tabela];
  if (atual) return atual;
  const nova: Linha[] = [];
  tabelas[tabela] = nova;
  return nova;
}

/** v_records: melhor série por exercício (mesma conta do schema.sql). */
function calcularRecordes(userId: string): Linha[] {
  const grupos = new Map<string, Linha[]>();
  for (const s of linhas("session_sets")) {
    if (s.user_id !== userId) continue;
    if (s.concluida !== true || s.tipo !== "trabalho") continue;
    const chave = String(s.exercise_id);
    const lista = grupos.get(chave);
    if (lista) lista.push(s);
    else grupos.set(chave, [s]);
  }
  const maximo = (vs: (number | null)[]): number | null => {
    const validos = vs.filter((v): v is number => v !== null && !Number.isNaN(v));
    return validos.length === 0 ? null : Math.max(...validos);
  };
  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  return [...grupos.entries()].map(([exercise_id, series]) => ({
    user_id: userId,
    exercise_id,
    carga_max_kg: maximo(series.map((s) => num(s.carga_kg))),
    e1rm_epley: maximo(
      series.map((s) => {
        const carga = num(s.carga_kg);
        if (carga === null) return null;
        return carga * (1 + (num(s.reps) ?? 0) / 30);
      }),
    ),
    reps_max: maximo(series.map((s) => num(s.reps))),
    tempo_max_s: maximo(series.map((s) => num(s.tempo_s))),
  }));
}

// =====================================================================
//  auth (GoTrue)
// =====================================================================

function usuarioPublico(u: Usuario): Linha {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.created_at,
    phone: "",
    confirmed_at: u.created_at,
    last_sign_in_at: agora(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { email: u.email, email_verified: true },
    identities: [
      {
        identity_id: u.id,
        id: u.id,
        user_id: u.id,
        identity_data: { email: u.email, sub: u.id },
        provider: "email",
        created_at: u.created_at,
        last_sign_in_at: u.created_at,
        updated_at: u.created_at,
      },
    ],
    created_at: u.created_at,
    updated_at: u.created_at,
    is_anonymous: false,
  };
}

function sessaoDe(u: Usuario, sessaoAnterior?: string): Linha {
  u.ultimo_acesso = agora();   // last_sign_in_at de auth.users
  // trocar o refresh não abre outra sessão: o session_id atravessa a rotação
  const sessaoId = sessaoAnterior ?? randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + VALIDADE_S;
  const access_token = criarJwt({
    iss: EMISSOR,
    sub: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    phone: "",
    session_id: sessaoId,
    is_anonymous: false,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { email: u.email, email_verified: true },
    iat,
    exp,
  });
  const novoRefresh = `mock-refresh-${randomUUID()}`;
  refresh.set(novoRefresh, u.id);
  sessaoDoRefresh.set(novoRefresh, sessaoId);
  return {
    access_token,
    token_type: "bearer",
    expires_in: VALIDADE_S,
    expires_at: exp,
    refresh_token: novoRefresh,
    user: usuarioPublico(u),
  };
}

function acharPorEmail(email: string): Usuario | null {
  const alvo = email.trim().toLowerCase();
  for (const u of usuarios.values()) if (u.email === alvo) return u;
  return null;
}

/** É o dono do app? (public.sou_o_dono() do schema, SPEC §21.2) */
function ehODono(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === EMAIL_DO_DONO;
}

/**
 * Simula o trigger `on_auth_user_vaga` (`before insert on auth.users`): sem
 * vaga na cota a conta não chega a virar linha — nem usuário, nem perfil. O
 * dono passa sempre.
 */
function exigirVagaParaConta(email: string): void {
  if (ehODono(email)) return;
  if (usuarios.size >= appConfig.max_contas) {
    throw new ErroMock(403, ERRO_SEM_VAGA, { error_code: "cota_cheia" });
  }
}

/**
 * Simula os triggers de auth.users: a cota (`on_auth_user_vaga`) e o
 * `handle_new_user`, que grava o perfil com o nome vindo do e-mail.
 *
 * `semCota` é só para a semente dos testes (`POST /__mock/seed`): ali as
 * contas são o cenário, não um cadastro pela tela.
 */
function criarUsuario(
  email: string,
  senha: string,
  { semCota = false }: { semCota?: boolean } = {},
): Usuario {
  if (!semCota) exigirVagaParaConta(email);
  const u: Usuario = {
    id: randomUUID(),
    email: email.trim().toLowerCase(),
    senha,
    created_at: agora(),
    ultimo_acesso: null,
  };
  usuarios.set(u.id, u);
  linhas("profiles").push(
    novaLinha("profiles", {
      user_id: u.id,
      nome: u.email.split("@")[0] ?? "",
    }),
  );
  return u;
}

/** Usuário do Bearer da requisição (null = anônimo / chave anon). */
function usuarioDaRequisicao(req: IncomingMessage): Usuario | null {
  const cabecalho = req.headers.authorization ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const carga = lerJwt(token);
  if (!carga || typeof carga.sub !== "string") return null;
  return usuarios.get(carga.sub) ?? null;
}

async function rotaAuth(
  req: IncomingMessage,
  url: URL,
  corpo: unknown,
): Promise<{ status: number; corpo: unknown }> {
  const caminho = url.pathname.replace(/^\/auth\/v1/, "");
  const dados = (corpo ?? {}) as Linha;
  const metodo = req.method ?? "GET";

  // GoTrue expõe estes dois; o app não usa, mas supabase-js pode consultar
  if (caminho === "/settings" && metodo === "GET") {
    return {
      status: 200,
      corpo: {
        external: { email: true },
        disable_signup: false,
        mailer_autoconfirm: true,
        autoconfirm: true,
      },
    };
  }
  if (caminho === "/.well-known/jwks.json" && metodo === "GET") {
    return { status: 200, corpo: { keys: [] } };
  }
  if (caminho === "/health" && metodo === "GET") {
    return { status: 200, corpo: { name: "mock-gotrue", version: "1" } };
  }

  if (caminho === "/signup" && metodo === "POST") {
    const email = String(dados.email ?? "").trim();
    const senha = String(dados.password ?? "");
    if (!email || !senha) {
      throw new ErroMock(400, "Signup requires a valid email and password", {
        error_code: "validation_failed",
      });
    }
    if (senha.length < 6) {
      throw new ErroMock(422, "Password should be at least 6 characters", {
        error_code: "weak_password",
      });
    }
    if (acharPorEmail(email)) {
      throw new ErroMock(422, "User already registered", {
        error_code: "user_already_exists",
      });
    }
    // confirmação de e-mail desligada no mock: já devolve a sessão
    return { status: 200, corpo: sessaoDe(criarUsuario(email, senha)) };
  }

  if (caminho === "/token" && metodo === "POST") {
    const tipo = url.searchParams.get("grant_type");
    if (tipo === "password") {
      // SPEC §21.3: "entrar" não olha e-mail nenhum — quem tem conta, entra.
      // Quem não tem esbarra em "Invalid login credentials", como no GoTrue.
      const u = acharPorEmail(String(dados.email ?? ""));
      if (!u || u.senha !== String(dados.password ?? "")) {
        throw new ErroMock(400, "Invalid login credentials", {
          error_code: "invalid_credentials",
        });
      }
      return { status: 200, corpo: sessaoDe(u) };
    }
    if (tipo === "refresh_token") {
      const antigo = String(dados.refresh_token ?? "");
      const userId = refresh.get(antigo);
      const u = userId ? usuarios.get(userId) : undefined;
      if (!u) {
        throw new ErroMock(400, "Invalid Refresh Token: Refresh Token Not Found", {
          error_code: "refresh_token_not_found",
        });
      }
      const trocadoEm = refreshTrocadoEm.get(antigo);
      if (trocadoEm === undefined) {
        refreshTrocadoEm.set(antigo, Date.now());
      } else if (Date.now() - trocadoEm > REUSO_DO_REFRESH_MS) {
        refresh.delete(antigo);
        refreshTrocadoEm.delete(antigo);
        throw new ErroMock(400, "Invalid Refresh Token: Already Used", {
          error_code: "refresh_token_already_used",
        });
      }
      return { status: 200, corpo: sessaoDe(u, sessaoDoRefresh.get(antigo)) };
    }
    throw new ErroMock(400, `mock: recurso token?grant_type=${tipo} não implementado`);
  }

  if (caminho === "/user") {
    const u = usuarioDaRequisicao(req);
    if (!u) {
      throw new ErroMock(401, "Invalid Claim: missing sub claim", {
        error_code: "bad_jwt",
      });
    }
    if (metodo === "GET") return { status: 200, corpo: usuarioPublico(u) };
    if (metodo === "PUT") {
      /*
       * `supabase.auth.updateUser({ password })` — a tela `/mais/senha`
       * (SPEC §9). As duas recusas são as do GoTrue, com as mensagens dele
       * (é o que `lib/erros-auth.ts` traduz); a senha nova passa a valer no
       * `token?grant_type=password`, e a antiga deixa de valer.
       */
      if (typeof dados.password === "string") {
        const nova = dados.password;
        if (nova.length < 6) {
          throw new ErroMock(422, "Password should be at least 6 characters", {
            error_code: "weak_password",
          });
        }
        if (nova === u.senha) {
          throw new ErroMock(
            422,
            "New password should be different from the old password.",
            { error_code: "same_password" },
          );
        }
        u.senha = nova;
      }
      if (typeof dados.email === "string") u.email = dados.email.toLowerCase();
      return { status: 200, corpo: usuarioPublico(u) };
    }
  }

  /*
   * O `?scope=local` da §22.11 chega na busca da URL, e `caminho` é só o
   * `pathname`. O escopo fica registrado em `logouts` (e aparece em
   * `GET /__mock/estado`) porque é a única forma de um e2e provar o que o app
   * pediu. E ele muda o que acontece, como no GoTrue de verdade: `local`
   * derruba só a sessão de quem pediu — o outro aparelho do dono continua
   * dentro —, `global` derruba todas as da conta.
   */
  if (caminho === "/logout" && metodo === "POST") {
    const escopo = url.searchParams.get("scope") ?? "global";
    logouts.push({ scope: escopo, em: agora() });
    const u = usuarioDaRequisicao(req);
    if (u) {
      const carga = lerJwt(
        (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim(),
      );
      const daSessao = typeof carga?.session_id === "string" ? carga.session_id : null;
      for (const [t, id] of refresh) {
        if (id !== u.id) continue;
        if (escopo === "local" && sessaoDoRefresh.get(t) !== daSessao) continue;
        refresh.delete(t);
        refreshTrocadoEm.delete(t);
        sessaoDoRefresh.delete(t);
      }
    }
    return { status: 204, corpo: null };
  }

  throw new ErroMock(
    400,
    `mock: recurso auth ${metodo} ${caminho} não implementado`,
  );
}

// =====================================================================
//  PostgREST (/rest/v1)
// =====================================================================

const RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function novaLinha(tabela: string, entrada: Linha): Linha {
  const espec = ESQUEMA[tabela];
  if (!espec) throw new ErroMock(400, `mock: tabela ${tabela} não implementada`);
  const linha: Linha = {};
  for (const [coluna, padrao] of Object.entries(espec.colunas)) {
    linha[coluna] = coluna in entrada ? entrada[coluna] : padrao();
  }
  for (const coluna of Object.keys(entrada)) {
    if (!(coluna in espec.colunas)) {
      throw new ErroMock(
        400,
        `mock: coluna ${tabela}.${coluna} não existe em supabase/schema.sql`,
        { code: "PGRST204" },
      );
    }
  }
  return linha;
}

function comparar(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function converter(valor: unknown, texto: string): unknown {
  if (texto === "null") return null;
  if (typeof valor === "number") return Number(texto);
  if (typeof valor === "boolean") return texto === "true";
  return texto;
}

function comoRegex(padrao: string, sensivel: boolean): RegExp {
  const escapado = padrao.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^${escapado.replace(/\*/g, ".*").replace(/%/g, ".*").replace(/_/g, ".")}$`,
    sensivel ? "" : "i",
  );
}

function separarLista(texto: string): string[] {
  const dentro = texto.replace(/^\(/, "").replace(/\)$/, "");
  if (dentro === "") return [];
  return dentro
    .split(",")
    .map((v) => v.trim().replace(/^"(.*)"$/, "$1"));
}

const OPERADORES = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is",
  "like",
  "ilike",
]);

interface Filtro {
  op: string;
  bruto: string;
  negar: boolean;
}

/**
 * Lê `coluna=op.valor` e recusa o que o mock não sabe fazer. É separado de
 * aplicar o filtro de propósito: a tabela pode estar vazia, e um operador
 * inventado tem de falhar do mesmo jeito (senão o mock finge sucesso).
 */
function analisarFiltro(coluna: string, expressao: string): Filtro {
  let expr = expressao;
  let negar = false;
  if (expr.startsWith("not.")) {
    negar = true;
    expr = expr.slice(4);
  }
  const corte = expr.indexOf(".");
  if (corte < 0) {
    throw new ErroMock(400, `mock: filtro "${coluna}=${expressao}" não implementado`);
  }
  const op = expr.slice(0, corte);
  if (!OPERADORES.has(op)) {
    throw new ErroMock(400, `mock: operador "${op}" não implementado`);
  }
  return { op, bruto: expr.slice(corte + 1), negar };
}

function passaNoFiltro(linha: Linha, coluna: string, filtro: Filtro): boolean {
  const { op, bruto, negar } = filtro;
  const valor = linha[coluna];
  let ok: boolean;

  switch (op) {
    case "eq":
      ok = valor !== null && valor !== undefined
        ? String(valor) === String(converter(valor, bruto))
        : bruto === "null";
      break;
    case "neq":
      ok = !(valor !== null && valor !== undefined
        ? String(valor) === String(converter(valor, bruto))
        : bruto === "null");
      break;
    case "gt":
      ok = valor !== null && comparar(valor, converter(valor, bruto)) > 0;
      break;
    case "gte":
      ok = valor !== null && comparar(valor, converter(valor, bruto)) >= 0;
      break;
    case "lt":
      ok = valor !== null && comparar(valor, converter(valor, bruto)) < 0;
      break;
    case "lte":
      ok = valor !== null && comparar(valor, converter(valor, bruto)) <= 0;
      break;
    case "in":
      ok = separarLista(bruto).some(
        (v) => valor !== null && String(valor) === String(converter(valor, v)),
      );
      break;
    case "is":
      ok =
        bruto === "null"
          ? valor === null || valor === undefined
          : bruto === "true"
            ? valor === true
            : bruto === "false"
              ? valor === false
              : false;
      break;
    case "like":
      ok = valor !== null && comoRegex(bruto, true).test(String(valor));
      break;
    case "ilike":
      ok = valor !== null && comoRegex(bruto, false).test(String(valor));
      break;
    default:
      throw new ErroMock(400, `mock: operador "${op}" não implementado`);
  }
  return negar ? !ok : ok;
}


function filtrar(base: Linha[], url: URL, recurso: string): Linha[] {
  let saida = base;
  for (const [chave, valor] of url.searchParams.entries()) {
    if (RESERVADOS.has(chave)) continue;
    if (chave === "or" || chave === "and" || chave === "not.or") {
      throw new ErroMock(
        400,
        `mock: filtro composto "${chave}" não implementado`,
      );
    }
    exigirColuna(recurso, chave);
    const filtro = analisarFiltro(chave, valor);
    saida = saida.filter((l) => passaNoFiltro(l, chave, filtro));
  }
  return saida;
}

function ordenar(base: Linha[], url: URL, recurso: string): Linha[] {
  const pedido = url.searchParams.get("order");
  if (!pedido) return base;
  const regras = pedido.split(",").map((parte) => {
    const bits = parte.split(".");
    const coluna = bits[0] ?? "";
    exigirColuna(recurso, coluna);
    const desc = bits.includes("desc");
    const nullsFirst = bits.includes("nullsfirst")
      ? true
      : bits.includes("nullslast")
        ? false
        : desc; // padrão do Postgres: nulls last no asc, nulls first no desc
    return { coluna, desc, nullsFirst };
  });
  return [...base].sort((a, b) => {
    for (const { coluna, desc, nullsFirst } of regras) {
      const va = a[coluna] ?? null;
      const vb = b[coluna] ?? null;
      if (va === null && vb === null) continue;
      if (va === null) return nullsFirst ? -1 : 1;
      if (vb === null) return nullsFirst ? 1 : -1;
      const c = comparar(va, vb);
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}

function projetar(base: Linha[], url: URL, recurso: string): Linha[] {
  const select = url.searchParams.get("select");
  if (!select || select.trim() === "*" || select.trim() === "") return base;
  if (select.includes("(")) {
    throw new ErroMock(
      400,
      `mock: select com recurso embutido ("${select}") não implementado`,
    );
  }
  const colunas = select.split(",").map((c) => c.trim()).filter(Boolean);
  if (colunas.includes("*")) return base;
  for (const c of colunas) exigirColuna(recurso, c);
  return base.map((l) => {
    const saida: Linha = {};
    for (const c of colunas) saida[c] = l[c] ?? null;
    return saida;
  });
}

interface Prefer {
  representacao: boolean;
  merge: boolean;
  ignorar: boolean;
  contar: boolean;
}

function lerPrefer(req: IncomingMessage): Prefer {
  const bruto = String(req.headers.prefer ?? "");
  return {
    representacao: bruto.includes("return=representation"),
    merge: bruto.includes("resolution=merge-duplicates"),
    ignorar: bruto.includes("resolution=ignore-duplicates"),
    contar: bruto.includes("count=exact"),
  };
}

function objetoUnico(req: IncomingMessage): boolean {
  return String(req.headers.accept ?? "").includes("application/vnd.pgrst.object");
}

function chavesDeConflito(tabela: string, url: URL): string[] {
  const pedido = url.searchParams.get("on_conflict");
  if (pedido) return pedido.split(",").map((c) => c.trim());
  const espec = ESQUEMA[tabela];
  return espec ? espec.chave : ["id"];
}

function mesmaChave(a: Linha, b: Linha, chaves: string[]): boolean {
  return chaves.every((c) => String(a[c] ?? "") === String(b[c] ?? ""));
}

interface Resposta {
  status: number;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

function respostaLista(
  req: IncomingMessage,
  dados: Linha[],
  status: number,
  total: number | null,
  faixa: { de: number; ate: number } | null,
): Resposta {
  const cabecalhos: Record<string, string> = {};
  if (total !== null) {
    const fim = dados.length === 0 ? "*" : `${faixa?.de ?? 0}-${(faixa?.de ?? 0) + dados.length - 1}`;
    cabecalhos["content-range"] = `${fim}/${total}`;
  }
  if (objetoUnico(req)) {
    if (dados.length !== 1) {
      return {
        status: 406,
        corpo: {
          code: "PGRST116",
          details: `Results contain ${dados.length} rows`,
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        },
        cabecalhos,
      };
    }
    return { status, corpo: dados[0], cabecalhos };
  }
  return { status, corpo: dados, cabecalhos };
}

/**
 * As funções da cota publicadas pelo PostgREST (`/rest/v1/rpc/...`), com os
 * mesmos grants do schema (SPEC §21.2):
 *  - `vagas_para_conta` é liberada ao **anon**: a tela de login pergunta antes
 *    de qualquer sessão, e a resposta são só dois números;
 *  - `contas_cadastradas` é liberada ao authenticated, mas a condição
 *    `sou_o_dono()` está dentro da consulta — para qualquer outra conta ela
 *    devolve zero linhas.
 */
function rotaRpc(req: IncomingMessage, url: URL): Resposta {
  const nome = url.pathname.replace(/^\/rest\/v1\/rpc\//, "");
  const usuario = usuarioDaRequisicao(req);

  if (nome === "vagas_para_conta") {
    return {
      status: 200,
      corpo: { contas: usuarios.size, limite: appConfig.max_contas },
      cabecalhos: {},
    };
  }

  if (nome === "sou_o_dono") {
    return { status: 200, corpo: ehODono(usuario?.email), cabecalhos: {} };
  }

  if (nome === "contas_cadastradas") {
    if (!ehODono(usuario?.email)) return { status: 200, corpo: [], cabecalhos: {} };
    const lista = [...usuarios.values()]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((u) => ({
        email: u.email,
        criada_em: u.created_at,
        ultimo_acesso: u.ultimo_acesso,
      }));
    return { status: 200, corpo: lista, cabecalhos: {} };
  }

  throw new ErroMock(404, `mock: função ${nome} não existe`, { code: "PGRST202" });
}

/**
 * `public.app_config` — a cota. A policy `app_config_dono` do schema só dá
 * linha para o dono: para qualquer outra conta o select volta vazio e o update
 * não muda nada (é assim que a RLS se comporta, e não com um erro).
 */
function rotaAppConfig(
  req: IncomingMessage,
  corpo: unknown,
): Resposta {
  const metodo = req.method ?? "GET";
  const usuario = usuarioDaRequisicao(req);
  if (!usuario) {
    throw new ErroMock(
      401,
      "mock: sem sessão — a RLS de supabase/schema.sql exige um usuário autenticado",
      { code: "42501" },
    );
  }
  const dono = ehODono(usuario.email);
  const linha = () => ({ id: true, ...appConfig });
  const prefer = lerPrefer(req);

  if (metodo === "GET" || metodo === "HEAD") {
    return { status: 200, corpo: dono ? [linha()] : [], cabecalhos: {} };
  }

  if (metodo === "PATCH") {
    const mudancas = (corpo ?? {}) as Linha;
    for (const c of Object.keys(mudancas)) {
      if (c !== "max_contas") {
        throw new ErroMock(
          400,
          `mock: coluna app_config.${c} não existe em supabase/schema.sql`,
          { code: "PGRST204" },
        );
      }
    }
    if (dono && typeof mudancas.max_contas === "number") {
      // check (max_contas >= 1) do schema
      if (!Number.isInteger(mudancas.max_contas) || mudancas.max_contas < 1) {
        throw new ErroMock(
          400,
          'new row for relation "app_config" violates check constraint "app_config_max_contas_check"',
          { code: "23514" },
        );
      }
      appConfig = { max_contas: mudancas.max_contas, updated_at: agora() };
    }
    const alvo = dono ? [linha()] : [];
    if (!prefer.representacao) return { status: 204, corpo: null, cabecalhos: {} };
    return { status: 200, corpo: alvo, cabecalhos: {} };
  }

  throw new ErroMock(400, `mock: método ${metodo} em app_config não implementado`);
}

async function rotaRest(
  req: IncomingMessage,
  url: URL,
  corpo: unknown,
): Promise<Resposta> {
  const metodo = req.method ?? "GET";
  const recurso = url.pathname.replace(/^\/rest\/v1\//, "").split("/")[0] ?? "";

  if (recurso === "rpc") return rotaRpc(req, url);
  if (recurso === "app_config") return rotaAppConfig(req, corpo);

  if (!NOMES_TABELAS.includes(recurso) && !VIEWS.includes(recurso)) {
    throw new ErroMock(400, `mock: recurso ${recurso} não implementado`, {
      code: "PGRST205",
    });
  }

  // RLS: sem usuário no token não existe linha visível
  const usuario = usuarioDaRequisicao(req);
  if (!usuario) {
    throw new ErroMock(
      401,
      "mock: sem sessão — a RLS de supabase/schema.sql exige um usuário autenticado",
      { code: "42501" },
    );
  }

  const prefer = lerPrefer(req);
  const ehView = VIEWS.includes(recurso);

  if (metodo === "GET" || metodo === "HEAD") {
    const base = ehView
      ? calcularRecordes(usuario.id)
      : linhas(recurso).filter((l) => l.user_id === usuario.id);
    const filtradas = ordenar(filtrar(base, url, recurso), url, recurso);
    const total = filtradas.length;

    const faixaHeader = String(req.headers.range ?? "");
    let de = Number(url.searchParams.get("offset") ?? 0);
    let ate = total - 1;
    const limite = url.searchParams.get("limit");
    if (limite) ate = de + Number(limite) - 1;
    const m = /^(\d+)-(\d*)$/.exec(faixaHeader);
    if (m) {
      de = Number(m[1]);
      ate = m[2] ? Number(m[2]) : total - 1;
    }
    const pagina = filtradas.slice(de, ate + 1);
    return respostaLista(
      req,
      projetar(pagina, url, recurso),
      200,
      prefer.contar ? total : null,
      { de, ate },
    );
  }

  if (ehView) {
    throw new ErroMock(400, `mock: a view ${recurso} é somente leitura`);
  }

  if (metodo === "POST") {
    const entradas = (Array.isArray(corpo) ? corpo : [corpo]) as Linha[];
    const espec = ESQUEMA[recurso];
    if (!espec) throw new ErroMock(400, `mock: tabela ${recurso} não implementada`);
    const chaves = chavesDeConflito(recurso, url);
    const tabela = linhas(recurso);
    const gravadas: Linha[] = [];

    for (const entrada of entradas) {
      for (const c of espec.obrigatorias ?? []) {
        if (entrada[c] !== undefined && entrada[c] !== null) continue;
        if (c === "user_id") {
          throw new ErroMock(
            403,
            `new row violates row-level security policy for table "${recurso}"`,
            { code: "42501" },
          );
        }
        throw new ErroMock(
          400,
          `null value in column "${c}" of relation "${recurso}" violates not-null constraint`,
          { code: "23502" },
        );
      }
      // RLS `with check (user_id = auth.uid())`
      if (entrada.user_id !== undefined && entrada.user_id !== usuario.id) {
        throw new ErroMock(403, "mock: RLS — user_id diferente do dono da sessão", {
          code: "42501",
        });
      }
      const candidata = novaLinha(recurso, { ...entrada, user_id: usuario.id });
      const conflitos = [chaves, espec.chave, ...espec.unicos];
      const existente = tabela.find((l) =>
        conflitos.some((cs) => cs.every((c) => c in candidata) && mesmaChave(l, candidata, cs)),
      );

      if (existente) {
        if (prefer.ignorar) {
          gravadas.push(existente);
          continue;
        }
        if (!prefer.merge) {
          throw new ErroMock(409, `duplicate key value violates unique constraint`, {
            code: "23505",
          });
        }
        for (const [c, v] of Object.entries(entrada)) {
          if (c in espec.colunas) existente[c] = v;
        }
        if (espec.tocaUpdatedAt) existente.updated_at = agora();
        gravadas.push(existente);
      } else {
        tabela.push(candidata);
        gravadas.push(candidata);
      }
    }

    if (!prefer.representacao) {
      return { status: 201, corpo: null, cabecalhos: {} };
    }
    return respostaLista(
      req,
      projetar(gravadas, url, recurso),
      201,
      prefer.contar ? gravadas.length : null,
      { de: 0, ate: gravadas.length - 1 },
    );
  }

  if (metodo === "PATCH") {
    const espec = ESQUEMA[recurso];
    if (!espec) throw new ErroMock(400, `mock: tabela ${recurso} não implementada`);
    const alvo = filtrar(
      linhas(recurso).filter((l) => l.user_id === usuario.id),
      url,
      recurso,
    );
    const mudancas = (corpo ?? {}) as Linha;
    for (const c of Object.keys(mudancas)) {
      if (!(c in espec.colunas)) {
        throw new ErroMock(
          400,
          `mock: coluna ${recurso}.${c} não existe em supabase/schema.sql`,
          { code: "PGRST204" },
        );
      }
    }
    if (espec.semUpdate) alvo.length = 0; // sem policy de update: nada muda
    for (const linha of alvo) {
      Object.assign(linha, mudancas);
      linha.user_id = usuario.id;
      if (espec.tocaUpdatedAt) linha.updated_at = agora();
    }
    if (!prefer.representacao) return { status: 204, corpo: null, cabecalhos: {} };
    return respostaLista(req, projetar(alvo, url, recurso), 200, prefer.contar ? alvo.length : null, {
      de: 0,
      ate: alvo.length - 1,
    });
  }

  if (metodo === "DELETE") {
    const tabela = linhas(recurso);
    const alvo = filtrar(
      tabela.filter((l) => l.user_id === usuario.id),
      url,
      recurso,
    );
    const restantes = tabela.filter((l) => !alvo.includes(l));
    tabelas[recurso] = restantes;
    if (!prefer.representacao) return { status: 204, corpo: null, cabecalhos: {} };
    return respostaLista(req, projetar(alvo, url, recurso), 200, prefer.contar ? alvo.length : null, {
      de: 0,
      ate: alvo.length - 1,
    });
  }

  throw new ErroMock(400, `mock: método ${metodo} em /rest/v1 não implementado`);
}

// =====================================================================
//  Storage (/storage/v1)
// =====================================================================

const BUCKETS = new Set(["progresso"]);

function conferirCaminho(usuario: Usuario, bucket: string, caminho: string): void {
  if (!BUCKETS.has(bucket)) {
    throw new ErroMock(400, `mock: bucket ${bucket} não implementado`);
  }
  // política do schema: (storage.foldername(name))[1] = auth.uid()
  if (!caminho.startsWith(`${usuario.id}/`)) {
    throw new ErroMock(403, "mock: RLS do storage — o caminho tem que começar com o user_id", {
      error: "Unauthorized",
    });
  }
}

/**
 * O supabase-js manda o upload do navegador como `multipart/form-data` (um
 * campo de cacheControl e o arquivo). O Storage de verdade desembrulha e
 * guarda só o arquivo, com o tipo dele; guardar o corpo cru faria o mock
 * devolver um "JPEG" que nenhum navegador decodifica — fingir sucesso.
 */
function extrairDoMultipart(
  bruto: Buffer,
  contentType: string,
): { bytes: Buffer; tipo: string } | null {
  const marca = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const limite = (marca?.[1] ?? marca?.[2] ?? "").trim();
  if (!limite) return null;

  // latin1 preserva byte a byte: dá para fatiar texto sem estragar binário
  const texto = bruto.toString("latin1");
  for (const pedaco of texto.split(`--${limite}`)) {
    const corte = pedaco.indexOf("\r\n\r\n");
    if (corte < 0) continue;
    const cabecalhos = pedaco.slice(0, corte);
    if (!/filename=/i.test(cabecalhos)) continue;
    let corpo = pedaco.slice(corte + 4);
    if (corpo.endsWith("\r\n")) corpo = corpo.slice(0, -2);
    const tipo = /content-type:\s*([^\r\n;]+)/i.exec(cabecalhos)?.[1]?.trim();
    return {
      bytes: Buffer.from(corpo, "latin1"),
      tipo: tipo ?? "application/octet-stream",
    };
  }
  return null;
}

function infoArquivo(nome: string, arquivo: Arquivo): Linha {
  return {
    name: nome,
    id: randomUUID(),
    updated_at: arquivo.atualizado_em,
    created_at: arquivo.criado_em,
    last_accessed_at: arquivo.atualizado_em,
    metadata: { size: arquivo.bytes.length, mimetype: arquivo.tipo },
  };
}

async function rotaStorage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  bruto: Buffer,
): Promise<Resposta | "enviado"> {
  const metodo = req.method ?? "GET";
  const caminho = url.pathname.replace(/^\/storage\/v1/, "");
  const usuario = usuarioDaRequisicao(req);

  const servir = (chave: string): "enviado" => {
    const arquivo = arquivos.get(chave);
    if (!arquivo) throw new ErroMock(404, "Object not found", { error: "not_found" });
    res.writeHead(200, {
      "content-type": arquivo.tipo,
      "content-length": String(arquivo.bytes.length),
      "access-control-allow-origin": "*",
    });
    res.end(arquivo.bytes);
    return "enviado";
  };

  // GET /object/authenticated/<bucket>/<path>  ·  /object/sign/...  ·  /object/public/...
  const leitura = /^\/object\/(authenticated|sign|public)\/([^/]+)\/(.+)$/.exec(caminho);
  if (leitura && metodo === "GET") {
    const [, modo, bucket, resto] = leitura;
    if (modo === "authenticated") {
      if (!usuario) throw new ErroMock(401, "mock: storage exige sessão");
      conferirCaminho(usuario, bucket ?? "", resto ?? "");
    }
    return servir(`${bucket}/${resto}`);
  }

  // POST /object/sign/<bucket>/<path> -> URL assinada (fake)
  const assinatura = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(caminho);
  if (assinatura && metodo === "POST") {
    if (!usuario) throw new ErroMock(401, "mock: storage exige sessão");
    const [, bucket, resto] = assinatura;
    conferirCaminho(usuario, bucket ?? "", resto ?? "");
    if (!arquivos.has(`${bucket}/${resto}`)) {
      throw new ErroMock(404, "Object not found", { error: "not_found" });
    }
    return {
      status: 200,
      corpo: {
        signedURL: `/object/sign/${bucket}/${resto}?token=mock-${b64url(String(resto))}`,
      },
      cabecalhos: {},
    };
  }

  // POST /object/list/<bucket>
  const listagem = /^\/object\/list\/([^/]+)$/.exec(caminho);
  if (listagem && metodo === "POST") {
    if (!usuario) throw new ErroMock(401, "mock: storage exige sessão");
    const bucket = listagem[1] ?? "";
    if (!BUCKETS.has(bucket)) throw new ErroMock(400, `mock: bucket ${bucket} não implementado`);
    const pedido = (bruto.length ? JSON.parse(bruto.toString("utf8")) : {}) as Linha;
    const prefixo = String(pedido.prefix ?? "");
    const base = prefixo ? `${bucket}/${prefixo.replace(/\/$/, "")}/` : `${bucket}/`;
    const saida: Linha[] = [];
    for (const [chave, arquivo] of arquivos) {
      if (!chave.startsWith(base)) continue;
      const nome = chave.slice(base.length);
      if (nome.includes("/")) continue; // o Storage não desce recursivamente
      saida.push(infoArquivo(nome, arquivo));
    }
    saida.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return { status: 200, corpo: saida, cabecalhos: {} };
  }

  // DELETE /object/<bucket> com {prefixes:[...]}  (supabase-js .remove)
  const remocaoEmLote = /^\/object\/([^/]+)$/.exec(caminho);
  if (remocaoEmLote && metodo === "DELETE") {
    if (!usuario) throw new ErroMock(401, "mock: storage exige sessão");
    const bucket = remocaoEmLote[1] ?? "";
    const pedido = (bruto.length ? JSON.parse(bruto.toString("utf8")) : {}) as Linha;
    const prefixos = Array.isArray(pedido.prefixes) ? (pedido.prefixes as string[]) : [];
    const apagados: Linha[] = [];
    for (const p of prefixos) {
      conferirCaminho(usuario, bucket, p);
      const arquivo = arquivos.get(`${bucket}/${p}`);
      if (arquivo) {
        apagados.push(infoArquivo(p, arquivo));
        arquivos.delete(`${bucket}/${p}`);
      }
    }
    return { status: 200, corpo: apagados, cabecalhos: {} };
  }

  // POST/PUT/DELETE /object/<bucket>/<path>
  const objeto = /^\/object\/([^/]+)\/(.+)$/.exec(caminho);
  if (objeto && (metodo === "POST" || metodo === "PUT" || metodo === "DELETE")) {
    if (!usuario) throw new ErroMock(401, "mock: storage exige sessão");
    const bucket = objeto[1] ?? "";
    const resto = objeto[2] ?? "";
    conferirCaminho(usuario, bucket, resto);
    const chave = `${bucket}/${resto}`;

    if (metodo === "DELETE") {
      arquivos.delete(chave);
      return { status: 200, corpo: { message: "Successfully deleted" }, cabecalhos: {} };
    }
    const existente = arquivos.get(chave);
    if (existente && metodo === "POST" && req.headers["x-upsert"] !== "true") {
      throw new ErroMock(409, "The resource already exists", { error: "Duplicate" });
    }

    const tipoDaRequisicao = String(
      req.headers["content-type"] ?? "application/octet-stream",
    );
    let bytes = bruto;
    let tipo = tipoDaRequisicao;
    if (tipoDaRequisicao.startsWith("multipart/form-data")) {
      const parte = extrairDoMultipart(bruto, tipoDaRequisicao);
      if (!parte) {
        throw new ErroMock(400, "mock: upload multipart sem arquivo dentro");
      }
      bytes = parte.bytes;
      tipo = parte.tipo;
    }

    arquivos.set(chave, {
      bytes,
      tipo,
      criado_em: existente?.criado_em ?? agora(),
      atualizado_em: agora(),
    });
    return {
      status: 200,
      corpo: { Key: chave, Id: randomUUID(), path: resto },
      cabecalhos: {},
    };
  }

  if (caminho === "/bucket" && metodo === "GET") {
    return {
      status: 200,
      corpo: [...BUCKETS].map((id) => ({ id, name: id, public: false })),
      cabecalhos: {},
    };
  }

  throw new ErroMock(
    400,
    `mock: recurso storage ${metodo} ${caminho} não implementado`,
  );
}

// =====================================================================
//  controle do mock (/__mock)
// =====================================================================

function rotaMock(req: IncomingMessage, url: URL, corpo: unknown): Resposta {
  const metodo = req.method ?? "GET";
  const caminho = url.pathname.replace(/^\/__mock/, "");

  if (caminho === "/health" && metodo === "GET") {
    return { status: 200, corpo: { ok: true, porta: PORTA }, cabecalhos: {} };
  }
  if (caminho === "/reset" && metodo === "POST") {
    zerar();
    return { status: 200, corpo: { ok: true }, cabecalhos: {} };
  }
  if (caminho === "/estado" && metodo === "GET") {
    return {
      status: 200,
      corpo: {
        usuarios: [...usuarios.values()].map((u) => ({ id: u.id, email: u.email })),
        max_contas: appConfig.max_contas,
        tabelas: Object.fromEntries(
          Object.entries(tabelas).map(([t, l]) => [t, l.length]),
        ),
        arquivos: [...arquivos.keys()],
        requisicoes,
        logouts,
        ultimo_logout: logouts.length > 0 ? logouts[logouts.length - 1] : null,
        pushes,
      },
      cabecalhos: {},
    };
  }
  if (caminho === "/seed" && metodo === "POST") {
    const pedido = (corpo ?? {}) as Linha;
    const criados: Linha[] = [];
    // a cota da semente é o cenário do teste, não um cadastro pela tela
    if (typeof pedido.max_contas === "number") {
      appConfig = { max_contas: pedido.max_contas, updated_at: agora() };
    }
    const listaUsuarios = Array.isArray(pedido.usuarios) ? pedido.usuarios : [];
    for (const bruto of listaUsuarios) {
      const u = bruto as Linha;
      const email = String(u.email ?? "");
      const existente = acharPorEmail(email);
      const criado =
        existente ??
        criarUsuario(email, String(u.senha ?? "senha123"), { semCota: true });
      criados.push({ id: criado.id, email: criado.email });
    }
    const unico = usuarios.size === 1 ? [...usuarios.values()][0] : undefined;
    const contagem: Record<string, number> = {};
    const tabelasPedidas = (pedido.tabelas ?? {}) as Record<string, unknown>;
    for (const [nome, valor] of Object.entries(tabelasPedidas)) {
      if (!NOMES_TABELAS.includes(nome)) {
        throw new ErroMock(400, `mock: recurso ${nome} não implementado`);
      }
      const lista = Array.isArray(valor) ? (valor as Linha[]) : [];
      for (const entrada of lista) {
        const comDono =
          entrada.user_id === undefined && unico
            ? { ...entrada, user_id: unico.id }
            : entrada;
        linhas(nome).push(novaLinha(nome, comDono));
      }
      contagem[nome] = lista.length;
    }
    return { status: 200, corpo: { ok: true, usuarios: criados, tabelas: contagem }, cabecalhos: {} };
  }

  throw new ErroMock(400, `mock: recurso ${metodo} /__mock${caminho} não implementado`);
}

// =====================================================================
//  servidor
// =====================================================================

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
  "access-control-allow-headers":
    "authorization,apikey,content-type,prefer,range,range-unit,accept,accept-profile,content-profile,x-client-info,x-upsert,x-supabase-api-version",
  "access-control-expose-headers": "content-range,content-length,x-supabase-api-version",
  "access-control-max-age": "86400",
};

async function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const pedaco of req) partes.push(pedaco as Buffer);
  return Buffer.concat(partes);
}

const servidor = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORTA}`);
    const metodo = req.method ?? "GET";
    let status = 500;
    if (metodo !== "OPTIONS") registrarRequisicao(metodo, url.pathname);

    try {
      if (metodo === "OPTIONS") {
        status = 204;
        res.writeHead(204, CORS);
        res.end();
        return;
      }

      const bruto = await lerCorpo(req);
      const tipo = String(req.headers["content-type"] ?? "");
      const corpo =
        bruto.length && tipo.includes("json")
          ? (JSON.parse(bruto.toString("utf8")) as unknown)
          : null;

      let resposta: Resposta | "enviado";
      if (url.pathname.startsWith("/__mock")) {
        resposta = rotaMock(req, url, corpo);
      } else if (url.pathname.startsWith("/auth/v1")) {
        const r = await rotaAuth(req, url, corpo);
        resposta = { status: r.status, corpo: r.corpo, cabecalhos: {} };
      } else if (url.pathname.startsWith("/rest/v1")) {
        resposta = await rotaRest(req, url, corpo);
      } else if (url.pathname.startsWith("/__push/")) {
        resposta = rotaPush(req, url, bruto);
      } else if (url.pathname.startsWith("/storage/v1")) {
        resposta = await rotaStorage(req, res, url, bruto);
      } else {
        throw new ErroMock(400, `mock: recurso ${url.pathname} não implementado`);
      }

      if (resposta === "enviado") {
        status = res.statusCode;
        return;
      }

      status = resposta.status;
      const cabecalhos: Record<string, string> = {
        ...CORS,
        ...resposta.cabecalhos,
      };
      if (resposta.corpo === null || metodo === "HEAD") {
        res.writeHead(status, cabecalhos);
        res.end();
        return;
      }
      const texto = JSON.stringify(resposta.corpo);
      cabecalhos["content-type"] = "application/json; charset=utf-8";
      cabecalhos["content-length"] = String(Buffer.byteLength(texto));
      res.writeHead(status, cabecalhos);
      res.end(texto);
    } catch (erro) {
      const e =
        erro instanceof ErroMock
          ? erro
          : new ErroMock(500, `mock: ${(erro as Error).message}`);
      status = e.status;
      const corpo = JSON.stringify({
        message: e.message,
        msg: e.message,
        error: "mock",
        ...e.extra,
      });
      res.writeHead(e.status, {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
      });
      res.end(corpo);
    } finally {
      if (LOG) {
        console.log(`[mock] ${metodo} ${url.pathname}${url.search} -> ${status}`);
      }
    }
  })();
});

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`[mock] Supabase de mentira em http://127.0.0.1:${PORTA}`);
});

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    servidor.close(() => process.exit(0));
  });
}

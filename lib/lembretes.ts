/**
 * Lembretes no celular, parte I (SPEC §23): as decisões puras — o que o
 * service worker mostra, em que estado o aparelho está, que instrução dar,
 * que texto a tela diz depois do teste, se a configuração do servidor fecha e
 * para onde a rota pode mandar um push. Sem React, sem Supabase, sem
 * `node:crypto`: roda no worker, no navegador e no servidor.
 */

/* ------------------------------------------------------------ fonte única */

/** A linha de Mais e a do guia de uso saem daqui (SPEC §23.4). */
export const LINHA_LEMBRETES = {
  href: "/mais/lembretes",
  titulo: "Lembretes",
  descricao: "Receber avisos no celular; ative em cada aparelho.",
} as const;

export const NOME_DO_APP = "Treino do Terraço";

/** Ícone e badge da notificação: os do manifest (`app/manifest.ts`). */
export const ICONE_DA_NOTIFICACAO = "/icons/icone-192.png";

export const SEM_CONFIGURACAO = "Lembretes ainda não configurados neste servidor.";
export const SEM_TABELA =
  "Os lembretes ainda não estão disponíveis neste servidor (falta atualizar o banco).";

/* --------------------------------------------------- o que o push carrega */

export interface PayloadDoLembrete {
  titulo: string;
  corpo: string;
  url: string;
  tag: string;
}

/** O lembrete do botão "Enviar um lembrete de teste". */
export const PAYLOAD_DE_TESTE: PayloadDoLembrete = {
  titulo: "Lembrete de teste",
  corpo: "Se você está vendo isto, os lembretes chegam neste aparelho.",
  url: LINHA_LEMBRETES.href,
  tag: "lembrete-teste",
};

/** Uma origem que não existe (`.invalid`, RFC 2606): só serve de base ao parser. */
const ORIGEM_FIXA = "https://app.invalid";

/**
 * Só um caminho do próprio app (SPEC §23.3): começa com `/` e não com `//`
 * (que seria outro host) nem com `/\` (que o parser lê como `//`) **e**,
 * resolvido pelo próprio parser de URL contra uma origem fixa, continua nela.
 * O parser apaga TAB, LF e CR de qualquer ponto, então `"/\t/outro.host"`
 * vira `//outro.host` — o teste de prefixo sozinho deixava passar. Devolve o
 * caminho, a busca e a âncora como o parser os leu; o resto vira `/`.
 */
export function urlInterna(url: unknown): string {
  if (typeof url !== "string") return "/";
  const limpa = url.trim();
  if (!limpa.startsWith("/") || limpa.startsWith("//") || limpa.startsWith("/\\")) {
    return "/";
  }
  let lida: URL;
  try {
    lida = new URL(limpa, ORIGEM_FIXA);
  } catch {
    return "/";
  }
  if (lida.origin !== ORIGEM_FIXA) return "/";
  return `${lida.pathname}${lida.search}${lida.hash}`;
}

export interface NotificacaoMontada {
  titulo: string;
  opcoes: {
    body: string;
    icon: string;
    badge: string;
    tag: string;
    lang: string;
    data: { url: string };
  };
}

/**
 * O `showNotification` a partir do corpo do push (SPEC §23.3). O corpo que
 * não é JSON vira o texto; título vazio vira o nome do app; a mesma `tag`
 * substitui a notificação anterior em vez de empilhar.
 */
export function opcoesDaNotificacao(texto: string | null | undefined): NotificacaoMontada {
  let dados: Partial<Record<keyof PayloadDoLembrete, unknown>> = {};
  const bruto = (texto ?? "").trim();
  try {
    const lido: unknown = JSON.parse(bruto);
    if (typeof lido === "object" && lido !== null) dados = lido as typeof dados;
    else dados = { corpo: bruto };
  } catch {
    dados = { corpo: bruto };
  }
  const titulo = typeof dados.titulo === "string" && dados.titulo.trim() ? dados.titulo.trim() : NOME_DO_APP;
  const corpo = typeof dados.corpo === "string" ? dados.corpo : "";
  const tag = typeof dados.tag === "string" && dados.tag.trim() ? dados.tag.trim() : "lembrete";
  return {
    titulo,
    opcoes: {
      body: corpo,
      icon: ICONE_DA_NOTIFICACAO,
      badge: ICONE_DA_NOTIFICACAO,
      tag,
      lang: "pt-BR",
      data: { url: urlInterna(dados.url) },
    },
  };
}

/* ------------------------------------------------ o estado deste aparelho */

export type EstadoDoAparelho =
  | "sem-configuracao"
  | "nao-suportado"
  | "bloqueado"
  | "ativado"
  | "desativado";

export interface SinaisDoAparelho {
  /** O servidor tem as três variáveis VAPID (e o par fecha). */
  configurado: boolean;
  /** `serviceWorker`, `PushManager` e `Notification` existem. */
  suportado: boolean;
  /** `Notification.permission`. */
  permissao: "default" | "granted" | "denied";
  /** Há inscrição no navegador **e** a linha dela está na tabela. */
  inscrito: boolean;
}

/** A tabela da SPEC §23.4, na ordem em que as condições pesam. */
export function estadoDoAparelho(s: SinaisDoAparelho): EstadoDoAparelho {
  if (!s.configurado) return "sem-configuracao";
  if (!s.suportado) return "nao-suportado";
  if (s.permissao === "denied") return "bloqueado";
  if (s.inscrito && s.permissao === "granted") return "ativado";
  return "desativado";
}

export const ROTULO_DO_ESTADO: Readonly<Record<EstadoDoAparelho, string>> = {
  "sem-configuracao": SEM_CONFIGURACAO,
  "nao-suportado": "Este navegador não recebe notificações.",
  bloqueado: "Bloqueado pelo navegador.",
  ativado: "Ativado neste aparelho.",
  desativado: "Desativado neste aparelho.",
};

/* ------------------------------------------------------------ instruções */

export interface SinaisDasInstrucoes {
  estado: EstadoDoAparelho;
  /** `navigator.brave` existe. */
  brave: boolean;
  /** iPhone ou iPad (iOS/iPadOS). */
  ios: boolean;
  /** Aberto como app instalado (`display-mode: standalone`). */
  instalado: boolean;
  /** O pedido de permissão ou o `subscribe` acabou de falhar. */
  falhou: boolean;
}

export interface Instrucao {
  id: "brave" | "permissao" | "permissao-iphone" | "iphone" | "suporte" | "tentar";
  titulo: string;
  passos: string[];
}

const BRAVE: Instrucao = {
  id: "brave",
  titulo: "No Brave, os avisos só chegam com os serviços do Google ligados",
  passos: [
    "Abra as Configurações do Brave → Privacidade e segurança.",
    "Ligue “Usar os serviços do Google para mensagens push”.",
    "Feche e abra o Brave de novo e toque em “Ativar lembretes neste aparelho”.",
  ],
};

const PERMISSAO: Instrucao = {
  id: "permissao",
  titulo: "O navegador está bloqueando as notificações deste app",
  passos: [
    "Toque no cadeado (ou no ⓘ) ao lado do endereço → Permissões → Notificações → Permitir.",
    "Com o app instalado: Configurações do Android → Apps → Treino do Terraço → Notificações → ligar.",
    "Volte aqui: a tela confere de novo e mostra “Ativar lembretes neste aparelho”.",
  ],
};

/** No iPhone não há cadeado nem Configurações do Android: é nos Ajustes. */
const PERMISSAO_IPHONE: Instrucao = {
  id: "permissao-iphone",
  titulo: "O iPhone está bloqueando as notificações deste app",
  passos: [
    "Abra os Ajustes do iPhone → Notificações → Treino do Terraço.",
    "Ligue “Permitir Notificações”.",
    "Volte aqui: a tela confere de novo e mostra “Ativar lembretes neste aparelho”.",
  ],
};

const IPHONE: Instrucao = {
  id: "iphone",
  titulo: "No iPhone, os lembretes só chegam com o app instalado",
  passos: [
    "No Safari, toque em Compartilhar → Adicionar à Tela de Início.",
    "Abra o Treino do Terraço pelo ícone da tela inicial e ative os lembretes por lá (iOS 16.4 ou mais novo).",
  ],
};

const SUPORTE: Instrucao = {
  id: "suporte",
  titulo: "Este navegador não recebe notificações de sites",
  passos: [
    "No Android, abra o app no Chrome ou no Brave.",
    "No iPhone, instale o app na tela de início (Compartilhar → Adicionar à Tela de Início); precisa do iOS 16.4 ou mais novo.",
  ],
};

/** A falha sem caso especial (Chrome, app instalado no iPhone, permissão dispensada). */
const TENTAR: Instrucao = {
  id: "tentar",
  titulo: "Para tentar de novo",
  passos: [
    "Confira a internet e toque de novo em “Ativar lembretes neste aparelho”.",
    "Quando o navegador perguntar, escolha Permitir.",
    "Se ainda não ativar, veja nas configurações do celular se as notificações do navegador (ou do app instalado) estão ligadas.",
  ],
};

/**
 * O que explicar (SPEC §23.6 — a tabela das 80 combinações é o contrato, e o
 * Vitest a lê do SPEC.md). Cada instrução só aparece onde o que ela manda
 * fazer existe: o ajuste do Brave só no Brave do Android e do computador (no
 * iPhone todo navegador é WebKit) e só quando a inscrição falhou ou a
 * permissão está negada — ligar os serviços do Google não cria o
 * `PushManager` que falta num navegador sem suporte. Nada quando está tudo
 * certo; com um problema (bloqueado, sem suporte ou falha ao ativar), nunca
 * vazia.
 */
export function instrucoesDoAparelho(s: SinaisDasInstrucoes): Instrucao[] {
  if (s.estado === "sem-configuracao" || s.estado === "ativado") return [];
  const saida: Instrucao[] = [];
  const bloqueado = s.estado === "bloqueado";
  const falhouAoAtivar = s.estado === "desativado" && s.falhou;
  if (s.brave && !s.ios && (bloqueado || falhouAoAtivar)) saida.push(BRAVE);
  if (bloqueado) saida.push(s.ios ? PERMISSAO_IPHONE : PERMISSAO);
  if (s.ios && !s.instalado) saida.push(IPHONE);
  else if (s.estado === "nao-suportado") saida.push(SUPORTE);
  if ((bloqueado || falhouAoAtivar || s.estado === "nao-suportado") && saida.length === 0) {
    saida.push(TENTAR);
  }
  return saida;
}

/** iPhone/iPad pelo user agent (o iPad novo se diz Mac com toque). */
export function ehIos(userAgent: string, pontosDeToque = 0): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && pontosDeToque > 1;
}

/** O nome curto do aparelho para a lista ("Brave · Android"). */
export function nomeDoAparelho(userAgent: string, brave: boolean): string {
  const sistema = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iPhone"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "Mac"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "outro sistema";
  const navegador = brave
    ? "Brave"
    : /EdgA?\//.test(userAgent)
      ? "Edge"
      : /Firefox|FxiOS/.test(userAgent)
        ? "Firefox"
        : /SamsungBrowser/.test(userAgent)
          ? "Samsung Internet"
          : /Chrome|CriOS/.test(userAgent)
            ? "Chrome"
            : /Safari/.test(userAgent)
              ? "Safari"
              : "Navegador";
  return `${navegador} · ${sistema}`;
}

/* --------------------------------------------------------- o envio (rota) */

/** O que fazer com a resposta do serviço de push (RFC 8030 §7.3). */
export function destinoDaResposta(status: number): "enviado" | "expirada" | "erro" {
  if (status >= 200 && status < 300) return "enviado";
  if (status === 404 || status === 410) return "expirada";
  return "erro";
}

export interface ResultadoDoAparelho {
  aparelho: string;
  destino: "enviado" | "expirada" | "erro" | "recusado";
}

/** A linha `role="status"` depois do teste (SPEC §23.4). */
export function textoDoResultado(resultados: readonly ResultadoDoAparelho[]): string {
  if (resultados.length === 0) {
    return "Nenhum aparelho desta conta está com os lembretes ativados.";
  }
  const enviados = resultados.filter((r) => r.destino === "enviado").length;
  const expiradas = resultados.filter((r) => r.destino === "expirada").length;
  const partes: string[] = [];
  if (enviados > 0) {
    partes.push(`Enviado para ${enviados} ${enviados === 1 ? "aparelho" : "aparelhos"}.`);
  } else {
    partes.push("Não deu para enviar agora.");
  }
  if (expiradas > 0) {
    partes.push(
      expiradas === 1
        ? "1 aparelho tinha a inscrição vencida e saiu da lista."
        : `${expiradas} aparelhos tinham a inscrição vencida e saíram da lista.`,
    );
  }
  return partes.join(" ");
}

/**
 * Para onde a rota pode mandar um push: só `https` dos serviços conhecidos
 * (a inscrição é dado que o próprio usuário grava — sem isto a rota viraria um
 * POST para qualquer endereço, inclusive de dentro da rede do servidor). A
 * origem do servidor de push falso dos testes entra só por
 * `LEMBRETES_PUSH_DE_TESTE`, que só o `e2e/playwright.config.ts` define.
 */
const SERVICOS_DE_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function endpointAceito(endpoint: string, origemDeTeste?: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // o servidor falso dos testes só vale na própria máquina (127.0.0.1/localhost)
  if (origemDeTeste && url.origin === origemDeTeste.replace(/\/+$/, "")) {
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) {
    return false;
  }
  return SERVICOS_DE_PUSH.some((host) => host.test(url.hostname));
}

/** O PostgREST disse que a tabela não existe (migração não aplicada). */
export function tabelaAusente(erro: { code?: string | null } | null | undefined): boolean {
  return erro?.code === "PGRST205" || erro?.code === "42P01";
}

/* ------------------------------------------------- a configuração VAPID */

export type ConfiguracaoVapid =
  | { ok: true; publica: string; privada: string; sujeito: string }
  | { ok: false; motivo: string };

function bytesDeBase64Url(texto: string): number | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(texto)) return null;
  const sem = texto.replace(/=+$/, "");
  return Math.floor((sem.length * 3) / 4);
}

/**
 * As três variáveis fecham? A pública tem 65 bytes (ponto não comprimido),
 * a privada 32 e o sujeito é `mailto:` ou `https:` (RFC 8292 §2.1). Se o par
 * não bate, quem confere é `publicaDaPrivada` em `lib/web-push.ts` (servidor),
 * passado aqui como `publicaDoPar`.
 */
export function configuracaoVapid(
  env: Readonly<Record<string, string | undefined>>,
  publicaDoPar?: (privada: string) => string,
): ConfiguracaoVapid {
  const publica = (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
  const privada = (env.VAPID_PRIVATE_KEY ?? "").trim();
  const sujeito = (env.VAPID_SUBJECT ?? "").trim();
  if (!publica || !privada || !sujeito) return { ok: false, motivo: "faltam variáveis" };
  if (bytesDeBase64Url(publica) !== 65) return { ok: false, motivo: "chave pública inválida" };
  if (bytesDeBase64Url(privada) !== 32) return { ok: false, motivo: "chave privada inválida" };
  if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(sujeito)) {
    return { ok: false, motivo: "VAPID_SUBJECT inválido" };
  }
  if (publicaDoPar) {
    try {
      if (publicaDoPar(privada) !== publica.replace(/=+$/, "")) {
        return { ok: false, motivo: "a chave pública não é a do par" };
      }
    } catch {
      return { ok: false, motivo: "chave privada inválida" };
    }
  }
  return { ok: true, publica: publica.replace(/=+$/, ""), privada, sujeito };
}

/** base64url → bytes, no navegador (o `applicationServerKey`). */
export function bytesDaChave(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const completo = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const bruto = atob(completo);
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) saida[i] = bruto.charCodeAt(i);
  return saida;
}

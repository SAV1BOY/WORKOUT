/**
 * Web Push do lado do servidor (SPEC §23.5): a cifragem do corpo (RFC 8291,
 * `aes128gcm`, RFC 8188) e a assinatura VAPID (RFC 8292, JWT ES256), com
 * `node:crypto` e mais nada.
 *
 * Por que não a biblioteca `web-push`: o contrato a permitia, mas o
 * `node_modules` deste repositório é compartilhado entre as faixas de trabalho
 * e o `npm install` reescreveria dezenas de pacotes dele. As duas RFCs cabem
 * aqui, e `lib/web-push.test.ts` confere a cifragem byte a byte contra o
 * exemplo do Apêndice A da RFC 8291.
 *
 * Só roda no servidor (a rota `/api/lembretes/teste`): a chave privada VAPID
 * nunca chega ao navegador.
 */
import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
  type KeyObject,
} from "node:crypto";

/** base64url sem preenchimento (o formato das chaves de push). */
export function paraBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Aceita base64url ou base64 comum, com ou sem `=`. */
export function deBase64Url(texto: string): Buffer {
  return Buffer.from(texto.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "base64url");
}

function hmac(chave: Buffer, dados: Buffer): Buffer {
  return createHmac("sha256", chave).update(dados).digest();
}

/** HKDF de um bloco só (tudo aqui pede ≤ 32 bytes). */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, tamanho: number): Buffer {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, tamanho);
}

/** O tamanho de registro declarado no cabeçalho (o corpo cabe num registro). */
const TAMANHO_DO_REGISTRO = 4096;

export interface ChavesDoAparelho {
  /** A chave pública P-256 do navegador (65 bytes, base64url). */
  p256dh: string;
  /** O segredo de autenticação do navegador (16 bytes, base64url). */
  auth: string;
}

export interface OpcoesDaCifragem {
  /** Só nos testes (vetor da RFC): em produção, 16 bytes aleatórios. */
  salt?: Buffer;
  /** Só nos testes: a chave privada efêmera do servidor (32 bytes). */
  chavePrivadaLocal?: Buffer;
}

/**
 * Cifra `texto` para um aparelho (RFC 8291 §3.4 + RFC 8188 §2): um registro
 * só, com o delimitador `0x02` de último registro e sem preenchimento extra.
 * Devolve o corpo pronto para o POST (cabeçalho de 86 bytes + cifra).
 */
export function cifrarParaOAparelho(
  texto: string | Buffer,
  aparelho: ChavesDoAparelho,
  opcoes: OpcoesDaCifragem = {},
): Buffer {
  const publicaDoAparelho = deBase64Url(aparelho.p256dh);
  const segredo = deBase64Url(aparelho.auth);
  if (publicaDoAparelho.length !== 65 || publicaDoAparelho[0] !== 4) {
    throw new Error("p256dh inválida: esperava um ponto P-256 não comprimido");
  }
  if (segredo.length !== 16) throw new Error("auth inválido: esperava 16 bytes");

  const ecdh = createECDH("prime256v1");
  if (opcoes.chavePrivadaLocal) ecdh.setPrivateKey(opcoes.chavePrivadaLocal);
  else ecdh.generateKeys();
  const publicaLocal = ecdh.getPublicKey();
  const segredoEcdh = ecdh.computeSecret(publicaDoAparelho);

  // RFC 8291 §3.4: IKM = HKDF(auth, ecdh, "WebPush: info\0" || ua_public || as_public)
  const infoDaChave = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    publicaDoAparelho,
    publicaLocal,
  ]);
  const ikm = hkdf(segredo, segredoEcdh, infoDaChave, 32);

  const salt = opcoes.salt ?? randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const claro = Buffer.concat([
    typeof texto === "string" ? Buffer.from(texto, "utf8") : texto,
    Buffer.from([2]),
  ]);
  const cifra = createCipheriv("aes-128-gcm", cek, nonce);
  const cifrado = Buffer.concat([cifra.update(claro), cifra.final(), cifra.getAuthTag()]);

  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(TAMANHO_DO_REGISTRO);
  return Buffer.concat([
    salt,
    tamanho,
    Buffer.from([publicaLocal.length]),
    publicaLocal,
    cifrado,
  ]);
}

export interface ChavesVapid {
  /** A pública (65 bytes, base64url) — a mesma de NEXT_PUBLIC_VAPID_PUBLIC_KEY. */
  publica: string;
  /** A privada (32 bytes, base64url) — só no servidor. */
  privada: string;
  /** `mailto:` ou `https:` de quem responde pelo servidor (RFC 8292 §2.1). */
  sujeito: string;
}

/** A chave privada VAPID como `KeyObject` (JWK a partir de d, x, y). */
function chavePrivadaVapid(chaves: ChavesVapid): KeyObject {
  const publica = deBase64Url(chaves.publica);
  return createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: paraBase64Url(deBase64Url(chaves.privada)),
      x: paraBase64Url(publica.subarray(1, 33)),
      y: paraBase64Url(publica.subarray(33, 65)),
    },
    format: "jwk",
  });
}

/** Validade do JWT: a RFC 8292 §2 manda não passar de 24 h; usamos 12 h. */
export const VALIDADE_DO_JWT_S = 12 * 60 * 60;

/** O JWT VAPID (ES256) para a origem do serviço de push. */
export function jwtVapid(audiencia: string, chaves: ChavesVapid, agoraMs: number): string {
  const cabecalho = paraBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const carga = paraBase64Url(
    Buffer.from(
      JSON.stringify({
        aud: audiencia,
        exp: Math.floor(agoraMs / 1000) + VALIDADE_DO_JWT_S,
        sub: chaves.sujeito,
      }),
    ),
  );
  const assinado = `${cabecalho}.${carga}`;
  const assinatura = sign("sha256", Buffer.from(assinado), {
    key: chavePrivadaVapid(chaves),
    dsaEncoding: "ieee-p1363",
  });
  return `${assinado}.${paraBase64Url(assinatura)}`;
}

export interface InscricaoParaEnvio extends ChavesDoAparelho {
  endpoint: string;
}

export interface PedidoPush {
  url: string;
  cabecalhos: Record<string, string>;
  corpo: Buffer;
}

/** Quanto tempo o serviço de push segura o aviso se o aparelho estiver fora. */
export const TTL_DO_AVISO_S = 60 * 60;

/**
 * O POST inteiro para um aparelho: corpo cifrado e os cabeçalhos da RFC 8030
 * (`TTL`, `Urgency`, `Topic`) e da RFC 8292 (`Authorization: vapid`).
 * `topico` é a `tag` da notificação — o serviço de push troca um aviso ainda
 * não entregue pelo mais novo com o mesmo tópico.
 */
export function montarPedidoPush(
  inscricao: InscricaoParaEnvio,
  texto: string,
  chaves: ChavesVapid,
  agoraMs: number,
  topico?: string,
  opcoes: OpcoesDaCifragem = {},
): PedidoPush {
  const audiencia = new URL(inscricao.endpoint).origin;
  const cabecalhos: Record<string, string> = {
    TTL: String(TTL_DO_AVISO_S),
    Urgency: "normal",
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    Authorization: `vapid t=${jwtVapid(audiencia, chaves, agoraMs)}, k=${chaves.publica}`,
  };
  // RFC 8030 §5.4: até 32 caracteres do alfabeto base64url
  const topicoLimpo = topico?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  if (topicoLimpo) cabecalhos.Topic = topicoLimpo;
  return {
    url: inscricao.endpoint,
    cabecalhos,
    corpo: cifrarParaOAparelho(texto, inscricao, opcoes),
  };
}

/** A chave pública que corresponde a uma privada (para conferir o par). */
export function publicaDaPrivada(privada: string): string {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(deBase64Url(privada));
  return paraBase64Url(ecdh.getPublicKey());
}

/**
 * O lado do **aparelho**: decifra um corpo `aes128gcm`. O app não precisa
 * disto (quem decifra é o navegador); é o que o aparelho de mentira dos testes
 * usa para provar que o corpo cifrado aqui chega inteiro do outro lado.
 */
export function decifrarNoAparelho(
  corpo: Buffer,
  privadaDoAparelho: string,
  auth: string,
): string {
  const salt = corpo.subarray(0, 16);
  const tamanhoDaChave = corpo[20] ?? 0;
  const publicaDoServidor = corpo.subarray(21, 21 + tamanhoDaChave);
  const cifrado = corpo.subarray(21 + tamanhoDaChave);

  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(deBase64Url(privadaDoAparelho));
  const publicaDoAparelho = ecdh.getPublicKey();
  const segredoEcdh = ecdh.computeSecret(publicaDoServidor);
  const infoDaChave = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    publicaDoAparelho,
    publicaDoServidor,
  ]);
  const ikm = hkdf(deBase64Url(auth), segredoEcdh, infoDaChave, 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const decifra = createDecipheriv("aes-128-gcm", cek, nonce);
  decifra.setAuthTag(cifrado.subarray(cifrado.length - 16));
  const claro = Buffer.concat([
    decifra.update(cifrado.subarray(0, cifrado.length - 16)),
    decifra.final(),
  ]);
  // tira o delimitador de último registro (0x02) e o preenchimento (0x00)
  let fim = claro.length - 1;
  while (fim >= 0 && claro[fim] === 0) fim -= 1;
  if (claro[fim] !== 2) throw new Error("registro sem o delimitador 0x02");
  return claro.subarray(0, fim).toString("utf8");
}

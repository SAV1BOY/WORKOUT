/**
 * Prova independente de `lib/web-push.ts` (SPEC §23.7 item 4): o que um
 * serviço de push e um navegador de verdade conferem, medido **só com
 * WebCrypto** (`crypto.subtle`) e sem nenhuma função de `lib/web-push.ts` além
 * de `montarPedidoPush` — que é o que está sendo provado.
 *
 * - O JWT VAPID (RFC 8292 + RFC 7515/7518): cabeçalho `ES256`/`JWT`, `aud` =
 *   origem do endpoint, `exp` ≤ 24 h, `sub` = VAPID_SUBJECT, e a assinatura
 *   em **r‖s de 64 bytes** (JWS, RFC 7518 §3.4) que o `crypto.subtle.verify`
 *   aceita com a chave pública em formato raw. Uma assinatura em DER (o padrão
 *   do `node:crypto`) teria 70–72 bytes e o serviço de push recusaria (401/403).
 * - O corpo `aes128gcm` (RFC 8291 + RFC 8188): decifrado aqui com a chave
 *   privada do **assinante**, por uma implementação da RFC escrita neste
 *   arquivo (HKDF, ECDH e AES-GCM do WebCrypto) — a mesma que decifra o
 *   exemplo do Apêndice A da RFC 8291.
 */
import { describe, expect, it } from "vitest";
import {
  montarPedidoPush,
  TTL_DO_AVISO_S,
  type ChavesVapid,
} from "@/lib/web-push";

const subtle = globalThis.crypto.subtle;
const texto = new TextEncoder();

function b64u(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
function deB64u(t: string): Uint8Array<ArrayBuffer> {
  const b = Buffer.from(t, "base64url");
  const saida = new Uint8Array(new ArrayBuffer(b.length));
  saida.set(b);
  return saida;
}
function juntar(...partes: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const saida = new Uint8Array(new ArrayBuffer(partes.reduce((n, p) => n + p.length, 0)));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}
function utf8(t: string): Uint8Array<ArrayBuffer> {
  return juntar(texto.encode(t));
}

/* ------------------------------------------------ as chaves, pelo WebCrypto */

async function parVapid(): Promise<{ chaves: ChavesVapid; publicaCrua: Uint8Array<ArrayBuffer> }> {
  const par = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicaCrua = new Uint8Array(await subtle.exportKey("raw", par.publicKey));
  const jwk = await subtle.exportKey("jwk", par.privateKey);
  return {
    chaves: { publica: b64u(publicaCrua), privada: String(jwk.d), sujeito: "mailto:dono@example.com" },
    publicaCrua,
  };
}

interface Assinante {
  privada: CryptoKey;
  publica: Uint8Array<ArrayBuffer>;
  auth: Uint8Array<ArrayBuffer>;
}

async function assinante(): Promise<Assinante> {
  const par = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return {
    privada: par.privateKey,
    publica: new Uint8Array(await subtle.exportKey("raw", par.publicKey)),
    auth: globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))),
  };
}

/* ------------------------------ RFC 8291/8188 do lado do navegador, à mão */

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  bytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const chave = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, chave, bytes * 8));
}

interface Decifrado {
  texto: string;
  rs: number;
  idlen: number;
  tamanhoDoRegistro: number;
}

/** RFC 8291 §3.3–3.4 e RFC 8188 §2, com a chave privada do assinante. */
async function decifrar(corpo: Uint8Array<ArrayBuffer>, quem: Assinante): Promise<Decifrado> {
  const salt = corpo.slice(0, 16);
  const rs = new DataView(corpo.buffer, corpo.byteOffset + 16, 4).getUint32(0);
  const idlen = corpo[20] ?? 0;
  const publicaDoServidor = corpo.slice(21, 21 + idlen);
  const registro = corpo.slice(21 + idlen);

  const chaveDoServidor = await subtle.importKey(
    "raw",
    publicaDoServidor,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await subtle.deriveBits({ name: "ECDH", public: chaveDoServidor }, quem.privada, 256),
  );
  const infoDaChave = juntar(utf8("WebPush: info\0"), quem.publica, publicaDoServidor);
  const ikm = await hkdf(quem.auth, ecdh, infoDaChave, 32);
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  const aes = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const claro = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aes, registro));
  // o último registro termina em 0x02, seguido só de zeros (preenchimento)
  let fim = claro.length - 1;
  while (fim >= 0 && claro[fim] === 0) fim -= 1;
  if (claro[fim] !== 2) throw new Error("sem o delimitador 0x02 de último registro");
  return {
    texto: new TextDecoder().decode(claro.slice(0, fim)),
    rs,
    idlen,
    tamanhoDoRegistro: registro.length,
  };
}

/* -------------------------------------------------- o JWT, como o serviço */

interface JwtConferido {
  cabecalho: Record<string, unknown>;
  carga: Record<string, unknown>;
  assinatura: Uint8Array<ArrayBuffer>;
  confere: boolean;
}

async function conferirJwt(
  jwt: string,
  publicaCrua: Uint8Array<ArrayBuffer>,
  assinaturaTrocada?: Uint8Array<ArrayBuffer>,
): Promise<JwtConferido> {
  const partes = jwt.split(".");
  expect(partes).toHaveLength(3);
  for (const p of partes) expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
  const [h, c, a] = partes as [string, string, string];
  const assinatura = assinaturaTrocada ?? deB64u(a);
  const chave = await subtle.importKey("raw", publicaCrua, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "verify",
  ]);
  const confere = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, chave, assinatura, utf8(`${h}.${c}`));
  return {
    cabecalho: JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as Record<string, unknown>,
    carga: JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as Record<string, unknown>,
    assinatura,
    confere,
  };
}

/** r‖s (JWS) → DER (o que `node:crypto` produz por padrão): para a mutação. */
function paraDer(rs: Uint8Array): Uint8Array<ArrayBuffer> {
  const inteiro = (bytes: Uint8Array) => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i += 1;
    let v = bytes.slice(i);
    if ((v[0] ?? 0) & 0x80) v = juntar(new Uint8Array([0]), v);
    return juntar(new Uint8Array([0x02, v.length]), v);
  };
  const corpo = juntar(inteiro(rs.slice(0, 32)), inteiro(rs.slice(32)));
  return juntar(new Uint8Array([0x30, corpo.length]), corpo);
}

const ENDPOINT = "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABprova";
const AGORA = Date.UTC(2026, 8, 23, 21, 0, 0);

describe("prova independente do VAPID (RFC 8292, conferido pelo WebCrypto)", () => {
  it("cabeçalho ES256/JWT, aud = origem do endpoint, exp ≤ 24 h, sub = VAPID_SUBJECT e assinatura r‖s que confere", async () => {
    const { chaves, publicaCrua } = await parVapid();
    const quem = await assinante();
    const pedido = montarPedidoPush(
      { endpoint: ENDPOINT, p256dh: b64u(quem.publica), auth: b64u(quem.auth) },
      '{"titulo":"Lembrete de teste"}',
      chaves,
      AGORA,
      "lembrete-teste",
    );

    // Authorization: vapid t=<jwt>, k=<chave pública raw em base64url>
    const m = /^vapid t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+), k=([A-Za-z0-9_-]+)$/.exec(
      pedido.cabecalhos.Authorization ?? "",
    );
    expect(m).not.toBeNull();
    const [, jwt, k] = m as unknown as [string, string, string];
    expect(k).toBe(chaves.publica);
    expect(Buffer.from(deB64u(k)).equals(Buffer.from(publicaCrua))).toBe(true);
    expect(publicaCrua).toHaveLength(65);
    expect(publicaCrua[0]).toBe(4);

    const j = await conferirJwt(jwt, publicaCrua);
    expect(j.cabecalho.alg).toBe("ES256");
    expect(j.cabecalho.typ).toBe("JWT");
    expect(j.carga.aud).toBe(new URL(ENDPOINT).origin);
    expect(j.carga.aud).toBe("https://updates.push.services.mozilla.com");
    expect(j.carga.sub).toBe(chaves.sujeito);
    const exp = Number(j.carga.exp);
    expect(Number.isInteger(exp)).toBe(true);
    expect(exp).toBeGreaterThan(AGORA / 1000);
    expect(exp - AGORA / 1000).toBeLessThanOrEqual(24 * 60 * 60);
    // JWS ES256: r‖s, 32 + 32 bytes — não DER (0x30 …, 70–72 bytes)
    expect(j.assinatura).toHaveLength(64);
    expect(j.confere).toBe(true);
  });

  it("a mesma assinatura em DER não passa na prova (mutação)", async () => {
    const { chaves, publicaCrua } = await parVapid();
    const quem = await assinante();
    const pedido = montarPedidoPush(
      { endpoint: ENDPOINT, p256dh: b64u(quem.publica), auth: b64u(quem.auth) },
      "x",
      chaves,
      AGORA,
    );
    const jwt = /t=([^,]+),/.exec(pedido.cabecalhos.Authorization ?? "")?.[1] ?? "";
    const rs = deB64u(jwt.split(".")[2] ?? "");
    const der = paraDer(rs);
    expect(der[0]).toBe(0x30);
    expect(der.length).toBeGreaterThanOrEqual(68);
    const j = await conferirJwt(jwt, publicaCrua, der);
    expect(j.assinatura.length).not.toBe(64);
    expect(j.confere).toBe(false);
  });

  it("cabeçalhos do push: Content-Encoding aes128gcm, TTL, Urgency e Topic", async () => {
    const { chaves } = await parVapid();
    const quem = await assinante();
    const pedido = montarPedidoPush(
      { endpoint: ENDPOINT, p256dh: b64u(quem.publica), auth: b64u(quem.auth) },
      "x",
      chaves,
      AGORA,
      "lembrete-teste",
    );
    expect(pedido.url).toBe(ENDPOINT);
    expect(pedido.cabecalhos["Content-Encoding"]).toBe("aes128gcm");
    expect(pedido.cabecalhos.TTL).toBe(String(TTL_DO_AVISO_S));
    expect(Number(pedido.cabecalhos.TTL)).toBeGreaterThan(0);
    expect(["very-low", "low", "normal", "high"]).toContain(pedido.cabecalhos.Urgency);
    expect(pedido.cabecalhos.Topic).toBe("lembrete-teste");
  });
});

/** RFC 8291, Apêndice A (os espaços do texto da RFC tirados). */
const RFC = {
  claro: "When I grow up, I want to be a watermelon",
  uaPublica:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivada: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  cabecalho:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  cifra:
    "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
};

describe("prova independente da cifragem (RFC 8291, decifrada pelo WebCrypto)", () => {
  it("a implementação do teste decifra o exemplo do Apêndice A da RFC", async () => {
    const publica = deB64u(RFC.uaPublica);
    const privada = await subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        d: RFC.uaPrivada,
        x: b64u(publica.slice(1, 33)),
        y: b64u(publica.slice(33)),
      },
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    const mensagem = juntar(deB64u(RFC.cabecalho), deB64u(RFC.cifra));
    const lido = await decifrar(mensagem, { privada, publica, auth: deB64u(RFC.auth) });
    expect(lido.texto).toBe(RFC.claro);
    expect(lido.rs).toBe(4096);
    expect(lido.idlen).toBe(65);
  });

  it("ida e volta: o corpo de montarPedidoPush decifra com a chave privada do assinante", async () => {
    const { chaves } = await parVapid();
    const quem = await assinante();
    const carga = JSON.stringify({
      titulo: "Lembrete de teste",
      corpo: "Se você está vendo isto, os lembretes chegam neste aparelho.",
      url: "/mais/lembretes",
      tag: "lembrete-teste",
    });
    const pedido = montarPedidoPush(
      { endpoint: ENDPOINT, p256dh: b64u(quem.publica), auth: b64u(quem.auth) },
      carga,
      chaves,
      AGORA,
      "lembrete-teste",
    );
    const corpo = juntar(pedido.corpo);
    const lido = await decifrar(corpo, quem);
    expect(lido.texto).toBe(carga);
    expect(lido.idlen).toBe(65);
    // um registro só, que cabe no tamanho declarado (RFC 8188 §2)
    expect(lido.tamanhoDoRegistro).toBeLessThanOrEqual(lido.rs);

    // outro assinante (outra chave) não decifra: a cifra é deste aparelho
    const intruso = await assinante();
    await expect(decifrar(corpo, { ...intruso, publica: quem.publica, auth: quem.auth })).rejects.toThrow();
  });
});

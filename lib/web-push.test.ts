/**
 * `lib/web-push.ts` (SPEC §23.5): a cifragem tem de ser a da RFC 8291 — um
 * serviço de push de verdade (FCM, Mozilla, Apple) só entrega o que o
 * navegador consegue decifrar, e uma cifragem que só "fecha consigo mesma"
 * passaria num teste de ida e volta e morreria no celular. Por isso o teste
 * principal é o **exemplo do Apêndice A da RFC**, byte a byte.
 */
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cifrarParaOAparelho,
  decifrarNoAparelho,
  deBase64Url,
  jwtVapid,
  montarPedidoPush,
  paraBase64Url,
  publicaDaPrivada,
  VALIDADE_DO_JWT_S,
  type ChavesVapid,
} from "@/lib/web-push";

/** RFC 8291, Apêndice A (os espaços do texto da RFC tirados). */
const RFC = {
  claro: "When I grow up, I want to be a watermelon",
  asPrivada: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublica:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivada: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  cabecalho:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  cifra:
    "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
};

/** Um par VAPID gerado aqui, no teste (nunca uma chave do repositório). */
function parVapid(): ChavesVapid {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = publicKey.export({ format: "jwk" });
  const publica = Buffer.concat([
    Buffer.from([4]),
    deBase64Url(String(pub.x)),
    deBase64Url(String(pub.y)),
  ]);
  return {
    publica: paraBase64Url(publica),
    privada: String(jwk.d),
    sujeito: "mailto:teste@example.com",
  };
}

describe("cifragem aes128gcm (RFC 8291)", () => {
  it("reproduz o exemplo do Apêndice A byte a byte", () => {
    const corpo = cifrarParaOAparelho(
      RFC.claro,
      { p256dh: RFC.uaPublica, auth: RFC.auth },
      { salt: deBase64Url(RFC.salt), chavePrivadaLocal: deBase64Url(RFC.asPrivada) },
    );
    expect(paraBase64Url(corpo.subarray(0, 86))).toBe(RFC.cabecalho);
    expect(paraBase64Url(corpo.subarray(86))).toBe(RFC.cifra);
  });

  it("o aparelho decifra o exemplo da RFC e um corpo com salt aleatório", () => {
    const daRfc = Buffer.concat([deBase64Url(RFC.cabecalho), deBase64Url(RFC.cifra)]);
    expect(decifrarNoAparelho(daRfc, RFC.uaPrivada, RFC.auth)).toBe(RFC.claro);

    const texto = JSON.stringify({ titulo: "Lembrete de teste", corpo: "Olá, ç e ã" });
    const corpo = cifrarParaOAparelho(texto, { p256dh: RFC.uaPublica, auth: RFC.auth });
    expect(decifrarNoAparelho(corpo, RFC.uaPrivada, RFC.auth)).toBe(texto);
    // salt e chave efêmera novos a cada envio
    const outro = cifrarParaOAparelho(texto, { p256dh: RFC.uaPublica, auth: RFC.auth });
    expect(outro.subarray(0, 16).equals(corpo.subarray(0, 16))).toBe(false);
  });

  it("recusa chaves do aparelho com tamanho errado", () => {
    expect(() =>
      cifrarParaOAparelho("x", { p256dh: RFC.uaPublica.slice(0, 40), auth: RFC.auth }),
    ).toThrow(/p256dh/);
    expect(() =>
      cifrarParaOAparelho("x", { p256dh: RFC.uaPublica, auth: "AAAA" }),
    ).toThrow(/auth/);
  });
});

describe("VAPID (RFC 8292)", () => {
  it("o JWT é ES256, assinado pela privada e conferível pela pública", () => {
    const chaves = parVapid();
    const agora = Date.UTC(2026, 8, 23, 18, 0, 0);
    const jwt = jwtVapid("https://fcm.googleapis.com", chaves, agora);
    const [cab, carga, assinatura] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(deBase64Url(cab).toString())).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(deBase64Url(carga).toString())).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: agora / 1000 + VALIDADE_DO_JWT_S,
      sub: "mailto:teste@example.com",
    });
    const publica = deBase64Url(chaves.publica);
    const chave = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: paraBase64Url(publica.subarray(1, 33)),
        y: paraBase64Url(publica.subarray(33)),
      },
      format: "jwk",
    });
    const confere = verify(
      "sha256",
      Buffer.from(`${cab}.${carga}`),
      { key: chave, dsaEncoding: "ieee-p1363" },
      deBase64Url(assinatura),
    );
    expect(confere).toBe(true);
    expect(VALIDADE_DO_JWT_S).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it("publicaDaPrivada devolve a pública do par", () => {
    const chaves = parVapid();
    expect(publicaDaPrivada(chaves.privada)).toBe(chaves.publica);
    expect(publicaDaPrivada(RFC.asPrivada)).toBe(
      paraBase64Url(deBase64Url(RFC.cabecalho).subarray(21, 86)),
    );
  });
});

describe("montarPedidoPush", () => {
  it("cabeçalhos da RFC 8030/8292, aud = origem do endpoint e corpo que decifra", () => {
    const chaves = parVapid();
    const pedido = montarPedidoPush(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc:def",
        p256dh: RFC.uaPublica,
        auth: RFC.auth,
      },
      '{"titulo":"t"}',
      chaves,
      Date.UTC(2026, 8, 23),
      "lembrete-teste",
    );
    expect(pedido.url).toBe("https://fcm.googleapis.com/fcm/send/abc:def");
    expect(pedido.cabecalhos["Content-Encoding"]).toBe("aes128gcm");
    expect(pedido.cabecalhos.TTL).toMatch(/^\d+$/);
    expect(pedido.cabecalhos.Topic).toBe("lembrete-teste");
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(pedido.cabecalhos.Authorization ?? "");
    expect(m?.[2]).toBe(chaves.publica);
    const carga = JSON.parse(deBase64Url(m?.[1]?.split(".")[1] ?? "").toString()) as {
      aud: string;
    };
    expect(carga.aud).toBe("https://fcm.googleapis.com");
    expect(decifrarNoAparelho(pedido.corpo, RFC.uaPrivada, RFC.auth)).toBe('{"titulo":"t"}');
  });

  it("tópico só com o alfabeto base64url, no máximo 32", () => {
    const pedido = montarPedidoPush(
      { endpoint: "https://x.push.apple.com/a", p256dh: RFC.uaPublica, auth: RFC.auth },
      "x",
      parVapid(),
      0,
      "lembrete de teste: com acentuação e muito mais que trinta e dois",
    );
    expect(pedido.cabecalhos.Topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
  });
});

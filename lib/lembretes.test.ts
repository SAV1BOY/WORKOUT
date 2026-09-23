/**
 * `lib/lembretes.ts` (SPEC §23.3–§23.6): as decisões puras dos lembretes.
 */
import { describe, expect, it } from "vitest";
import {
  configuracaoVapid,
  bytesDaChave,
  destinoDaResposta,
  ehIos,
  endpointAceito,
  estadoDoAparelho,
  ICONE_DA_NOTIFICACAO,
  instrucoesDoAparelho,
  nomeDoAparelho,
  opcoesDaNotificacao,
  PAYLOAD_DE_TESTE,
  tabelaAusente,
  textoDoResultado,
  urlInterna,
  type EstadoDoAparelho,
  type SinaisDasInstrucoes,
  type SinaisDoAparelho,
} from "@/lib/lembretes";
import { publicaDaPrivada } from "@/lib/web-push";

describe("opcoesDaNotificacao (o push vira notificação)", () => {
  it("título, corpo, ícone, badge, tag, pt-BR e url do payload", () => {
    const n = opcoesDaNotificacao(JSON.stringify(PAYLOAD_DE_TESTE));
    expect(n.titulo).toBe("Lembrete de teste");
    expect(n.opcoes).toEqual({
      body: PAYLOAD_DE_TESTE.corpo,
      icon: ICONE_DA_NOTIFICACAO,
      badge: ICONE_DA_NOTIFICACAO,
      tag: "lembrete-teste",
      lang: "pt-BR",
      data: { url: "/mais/lembretes" },
    });
  });

  it("título vazio vira o nome do app; sem tag, 'lembrete'", () => {
    const n = opcoesDaNotificacao(JSON.stringify({ titulo: "  ", corpo: "oi" }));
    expect(n.titulo).toBe("Treino do Terraço");
    expect(n.opcoes.tag).toBe("lembrete");
    expect(n.opcoes.data.url).toBe("/");
  });

  it("corpo que não é JSON vira o texto; vazio não quebra", () => {
    expect(opcoesDaNotificacao("Hora do treino").opcoes.body).toBe("Hora do treino");
    expect(opcoesDaNotificacao('"só uma string"').opcoes.body).toBe('"só uma string"');
    expect(opcoesDaNotificacao(null).titulo).toBe("Treino do Terraço");
    expect(opcoesDaNotificacao("").opcoes.body).toBe("");
  });

  it("url de fora do app vira /", () => {
    for (const fora of ["https://mal.example", "//mal.example/x", "/\\mal.example", "javascript:alert(1)", 3, null]) {
      expect(urlInterna(fora), String(fora)).toBe("/");
    }
    expect(urlInterna("/relatorio?aba=numeros#x")).toBe("/relatorio?aba=numeros#x");
    expect(opcoesDaNotificacao(JSON.stringify({ url: "https://mal.example" })).opcoes.data.url).toBe("/");
  });
});

describe("estadoDoAparelho (tabela da §23.4)", () => {
  const base: SinaisDoAparelho = { configurado: true, suportado: true, permissao: "default", inscrito: false };
  it.each<[string, Partial<SinaisDoAparelho>, EstadoDoAparelho]>([
    ["sem variáveis", { configurado: false, suportado: false, permissao: "denied" }, "sem-configuracao"],
    ["sem PushManager", { suportado: false, permissao: "denied" }, "nao-suportado"],
    ["permissão negada", { permissao: "denied", inscrito: true }, "bloqueado"],
    ["inscrito e permitido", { permissao: "granted", inscrito: true }, "ativado"],
    ["permitido sem inscrição", { permissao: "granted" }, "desativado"],
    ["inscrito sem permissão", { permissao: "default", inscrito: true }, "desativado"],
    ["nada ainda", {}, "desativado"],
  ])("%s", (_n, sinais, esperado) => {
    expect(estadoDoAparelho({ ...base, ...sinais })).toBe(esperado);
  });
});

describe("instrucoesDoAparelho (§23.6)", () => {
  const base: SinaisDasInstrucoes = {
    estado: "desativado",
    brave: false,
    ios: false,
    instalado: false,
    falhou: false,
  };
  const ids = (s: Partial<SinaisDasInstrucoes>) => instrucoesDoAparelho({ ...base, ...s }).map((i) => i.id);

  it("Brave com a inscrição falhando → ligar os serviços do Google", () => {
    expect(ids({ brave: true, falhou: true })).toEqual(["brave"]);
    const [brave] = instrucoesDoAparelho({ ...base, brave: true, falhou: true });
    expect(brave?.passos.join(" ")).toContain("Usar os serviços do Google para mensagens push");
    expect(brave?.passos.join(" ")).toContain("Privacidade e segurança");
  });
  it("Brave sem problema nenhum: nada a explicar", () => {
    expect(ids({ brave: true })).toEqual([]);
  });
  it("permissão negada → como liberar nas configurações do site", () => {
    expect(ids({ estado: "bloqueado" })).toEqual(["permissao"]);
    expect(ids({ estado: "bloqueado", brave: true })).toEqual(["brave", "permissao"]);
    const [p] = instrucoesDoAparelho({ ...base, estado: "bloqueado" });
    expect(p?.passos.join(" ")).toMatch(/Notificações → Permitir/);
  });
  it("iPhone fora da tela inicial → instalar; instalado, não", () => {
    expect(ids({ ios: true, estado: "nao-suportado" })).toEqual(["iphone"]);
    expect(ids({ ios: true })).toEqual(["iphone"]);
    expect(ids({ ios: true, instalado: true })).toEqual([]);
    const [i] = instrucoesDoAparelho({ ...base, ios: true });
    expect(i?.passos.join(" ")).toContain("Adicionar à Tela de Início");
  });
  it("sem suporte e sem caso especial → Chrome/Brave ou instalar", () => {
    expect(ids({ estado: "nao-suportado" })).toEqual(["suporte"]);
    expect(ids({ estado: "nao-suportado", brave: true })).toEqual(["brave"]);
  });
  it("ativado ou sem configuração: nenhuma instrução", () => {
    expect(ids({ estado: "ativado", ios: true, brave: true, falhou: true })).toEqual([]);
    expect(ids({ estado: "sem-configuracao", ios: true })).toEqual([]);
  });
});

describe("aparelho", () => {
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  it("nome curto", () => {
    expect(nomeDoAparelho(ANDROID, false)).toBe("Chrome · Android");
    expect(nomeDoAparelho(ANDROID, true)).toBe("Brave · Android");
    expect(nomeDoAparelho(IPHONE, false)).toBe("Safari · iPhone");
    expect(nomeDoAparelho("", false)).toBe("Navegador · outro sistema");
  });
  it("iOS, inclusive o iPad que se diz Mac", () => {
    expect(ehIos(IPHONE)).toBe(true);
    expect(ehIos(IPAD, 5)).toBe(true);
    expect(ehIos(IPAD, 0)).toBe(false);
    expect(ehIos(ANDROID, 5)).toBe(false);
  });
});

describe("envio", () => {
  it("404 e 410 = inscrição vencida; 2xx enviado; o resto erro", () => {
    expect(destinoDaResposta(201)).toBe("enviado");
    expect(destinoDaResposta(410)).toBe("expirada");
    expect(destinoDaResposta(404)).toBe("expirada");
    expect(destinoDaResposta(403)).toBe("erro");
    expect(destinoDaResposta(429)).toBe("erro");
  });

  it("texto da tela, com singular e plural", () => {
    expect(textoDoResultado([{ aparelho: "a", destino: "enviado" }])).toBe("Enviado para 1 aparelho.");
    expect(
      textoDoResultado([
        { aparelho: "a", destino: "enviado" },
        { aparelho: "b", destino: "enviado" },
      ]),
    ).toBe("Enviado para 2 aparelhos.");
    expect(
      textoDoResultado([
        { aparelho: "a", destino: "enviado" },
        { aparelho: "b", destino: "expirada" },
      ]),
    ).toBe("Enviado para 1 aparelho. 1 aparelho tinha a inscrição vencida e saiu da lista.");
    expect(textoDoResultado([{ aparelho: "a", destino: "erro" }])).toBe("Não deu para enviar agora.");
    expect(textoDoResultado([])).toMatch(/Nenhum aparelho/);
  });

  it("só os serviços de push conhecidos, em https", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/QGx",
      "https://wns2-by3p.notify.windows.com/w/?token=x",
    ]) {
      expect(endpointAceito(ok), ok).toBe(true);
    }
    for (const nao of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://169.254.169.254/latest/meta-data",
      "https://fcm.googleapis.com.mal.example/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "http://127.0.0.1:54321/__push/201/x",
      "não é url",
    ]) {
      expect(endpointAceito(nao), nao).toBe(false);
    }
    expect(endpointAceito("http://127.0.0.1:54321/__push/201/x", "http://127.0.0.1:54321")).toBe(true);
    expect(endpointAceito("http://127.0.0.1:9/x", "http://127.0.0.1:54321")).toBe(false);
    // a origem de teste só vale na própria máquina
    expect(endpointAceito("http://10.0.0.5:80/x", "http://10.0.0.5:80")).toBe(false);
  });

  it("tabela ausente pelo código do PostgREST/Postgres", () => {
    expect(tabelaAusente({ code: "PGRST205" })).toBe(true);
    expect(tabelaAusente({ code: "42P01" })).toBe(true);
    expect(tabelaAusente({ code: "42501" })).toBe(false);
    expect(tabelaAusente(null)).toBe(false);
  });
});

describe("configuracaoVapid", () => {
  // um par qualquer, gerado a partir de uma privada fixa só neste teste
  const privada = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
  const publica = publicaDaPrivada(privada);
  const env = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: publica,
    VAPID_PRIVATE_KEY: privada,
    VAPID_SUBJECT: "mailto:dono@example.com",
  };
  it("as três certas e o par fechando", () => {
    expect(configuracaoVapid(env, publicaDaPrivada)).toEqual({
      ok: true,
      publica,
      privada,
      sujeito: "mailto:dono@example.com",
    });
  });
  it("falta qualquer uma → não configurado", () => {
    for (const falta of Object.keys(env)) {
      expect(configuracaoVapid({ ...env, [falta]: "" }).ok, falta).toBe(false);
    }
    expect(configuracaoVapid({}).ok).toBe(false);
  });
  it("tamanhos, sujeito e par", () => {
    expect(configuracaoVapid({ ...env, NEXT_PUBLIC_VAPID_PUBLIC_KEY: publica.slice(0, 50) }).ok).toBe(false);
    expect(configuracaoVapid({ ...env, VAPID_PRIVATE_KEY: privada.slice(0, 20) }).ok).toBe(false);
    expect(configuracaoVapid({ ...env, VAPID_SUBJECT: "dono@example.com" }).ok).toBe(false);
    expect(configuracaoVapid({ ...env, VAPID_SUBJECT: "https://treino.example" }).ok).toBe(true);
    const outra = publicaDaPrivada("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94");
    expect(configuracaoVapid({ ...env, NEXT_PUBLIC_VAPID_PUBLIC_KEY: outra }, publicaDaPrivada)).toEqual({
      ok: false,
      motivo: "a chave pública não é a do par",
    });
  });
  it("bytesDaChave devolve os 65 bytes da pública", () => {
    const bytes = bytesDaChave(publica);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});

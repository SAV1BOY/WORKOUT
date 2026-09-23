/**
 * `lib/lembretes.ts` (SPEC §23.3–§23.6): as decisões puras dos lembretes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("TAB, LF ou CR não abrem outro host (o parser os apaga e sobra //host)", () => {
    for (const fora of ["/\t/mal.example", "/\n/mal.example", "/\r/mal.example", "/\t\\mal.example", "/\t/\t/mal.example/x?y#z"]) {
      expect(urlInterna(fora), JSON.stringify(fora)).toBe("/");
      // e o que o service worker faria com ela fica no app
      expect(new URL(urlInterna(fora), "https://treino.example").origin).toBe("https://treino.example");
    }
    expect(opcoesDaNotificacao(JSON.stringify({ url: "/\n/mal.example" })).opcoes.data.url).toBe("/");
  });

  it("caminho interno volta como o parser leu (caminho, busca e âncora)", () => {
    expect(urlInterna("/mais/lembretes")).toBe("/mais/lembretes");
    expect(urlInterna("  /relatorio  ")).toBe("/relatorio");
    expect(urlInterna("/rel\tatorio")).toBe("/relatorio");
    expect(urlInterna("/a/../mais")).toBe("/mais");
  });

  it("pontos antes da barra dupla não abrem outro host (a saída também é conferida)", () => {
    // o parser desfaz `.`, `..` e `%2e` DEPOIS da conferência da entrada
    for (const fora of [
      "/.//mal.example/x",
      "/..//mal.example",
      "/a/..//mal.example",
      "/%2e//mal.example",
      "/.%2e//mal.example",
      "/%2E%2E//mal.example",
      "/./\\mal.example",
      "/..\\/mal.example/x",
      "\t/.//mal.example",
      "/.\t//mal.example",
      "/.//",
    ]) {
      expect(urlInterna(fora), JSON.stringify(fora)).toBe("/");
      expect(opcoesDaNotificacao(JSON.stringify({ url: fora })).opcoes.data.url, JSON.stringify(fora)).toBe("/");
    }
    // um ponto que não deixa `//` no começo continua sendo caminho do app
    expect(urlInterna("/./mais/lembretes")).toBe("/mais/lembretes");
    expect(urlInterna("/a/./b/../c?x=1#y")).toBe("/a/c?x=1#y");
  });

  it("varredura: pedaços hostis 3 a 3 — toda saída fica na origem, sem // nem /\\, e é idempotente", () => {
    const origem = "https://treino.example";
    const pedacos = [
      "/", "//", "\\", "/\\", "\\/", "%2f", "%5c", "\t", "\n", "\r", " ", "\u0000", "\u000b", "\u000c",
      " ", " ", "﻿", "mal.example", "@mal.example", ":", "..", "#", "?",
      "javascript:alert(1)", "https://mal.example", "/./", "/../", ".", "%2e", "%2E%2e",
    ];
    let entradas = 0;
    const ruins: string[] = [];
    for (const a of pedacos)
      for (const b of pedacos)
        for (const c of pedacos)
          for (const fim of ["", "mal.example/x"]) {
            const entrada = a + b + c + fim;
            entradas++;
            const saida = urlInterna(entrada);
            let final: URL | null = null;
            try {
              final = new URL(saida, origem);
            } catch {
              final = null;
            }
            if (
              !saida.startsWith("/") ||
              saida.startsWith("//") ||
              saida.startsWith("/\\") ||
              final?.origin !== origem ||
              urlInterna(saida) !== saida
            ) {
              ruins.push(`${JSON.stringify(entrada)} → ${JSON.stringify(saida)}`);
            }
          }
    expect(entradas).toBe(pedacos.length ** 3 * 2);
    expect(ruins.slice(0, 10)).toEqual([]);
  });

  it("idempotente nos caminhos que valem", () => {
    for (const x of ["/mais/lembretes", "/relatorio?aba=numeros#x", "/a/../mais", "/rel\tatorio", "/%2e/x", "/a b?c d#e f"]) {
      const uma = urlInterna(x);
      expect(uma.startsWith("/") && !uma.startsWith("//"), JSON.stringify(x)).toBe(true);
      expect(urlInterna(uma), JSON.stringify(x)).toBe(uma);
    }
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

/* A tabela de §23.6 do SPEC.md, entre os marcadores `tabela-instrucoes`. */
interface LinhaDaTabela {
  estado: string;
  brave: boolean | null;
  ios: boolean | null;
  instalado: boolean | null;
  falhou: boolean | null;
  instrucoes: string[];
}

function tabelaDaSpec(): LinhaDaTabela[] {
  const spec = readFileSync(resolve(__dirname, "..", "SPEC.md"), "utf8");
  const inicio = spec.indexOf("<!-- tabela-instrucoes:inicio -->");
  const fim = spec.indexOf("<!-- tabela-instrucoes:fim -->");
  if (inicio < 0 || fim < inicio) throw new Error("SPEC.md sem a tabela de §23.6");
  const sim = (c: string): boolean | null => (c === "·" ? null : c === "sim" ? true : c === "não" ? false : (() => { throw new Error(`célula inválida: ${c}`); })());
  return spec
    .slice(inicio, fim)
    .split("\n")
    .filter((l) => l.startsWith("| ") && !l.startsWith("| estado") && !l.startsWith("|---"))
    .map((l) => {
      const c = l.split("|").slice(1, -1).map((x) => x.trim());
      if (c.length !== 6) throw new Error(`linha com ${c.length} colunas: ${l}`);
      return {
        estado: c[0] ?? "",
        brave: sim(c[1] ?? ""),
        ios: sim(c[2] ?? ""),
        instalado: sim(c[3] ?? ""),
        falhou: sim(c[4] ?? ""),
        instrucoes: c[5] === "—" ? [] : (c[5] ?? "").split(",").map((x) => x.trim().replace(/`/g, "")),
      };
    });
}

function casa(l: LinhaDaTabela, s: SinaisDasInstrucoes): boolean {
  const ok = (v: boolean | null, x: boolean) => v === null || v === x;
  return l.estado === s.estado && ok(l.brave, s.brave) && ok(l.ios, s.ios) && ok(l.instalado, s.instalado) && ok(l.falhou, s.falhou);
}

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
    // a volta é conferida pela tela (§23.4): o passo não manda recarregar
    expect(p?.passos.at(-1)).toBe("Volte aqui: a tela confere de novo e mostra “Ativar lembretes neste aparelho”.");
  });
  it("permissão negada no iPhone → os Ajustes do iPhone, nunca o cadeado nem o Android", () => {
    expect(ids({ estado: "bloqueado", ios: true, instalado: true })).toEqual(["permissao-iphone"]);
    expect(ids({ estado: "bloqueado", ios: true, instalado: true, brave: true })).toEqual(["permissao-iphone"]);
    // fora da tela inicial, instalar primeiro: a entrada nos Ajustes só existe com o app instalado
    expect(ids({ estado: "bloqueado", ios: true, instalado: false })).toEqual(["iphone", "permissao-iphone"]);
    const [p] = instrucoesDoAparelho({ ...base, estado: "bloqueado", ios: true, instalado: true });
    const texto = `${p?.titulo} ${p?.passos.join(" ")}`;
    expect(texto).toContain("Ajustes do iPhone → Notificações → Treino do Terraço");
    expect(texto).toContain("“Permitir Notificações”");
    expect(texto).not.toMatch(/Android|cadeado|Brave/);
  });
  it("o ajuste do Brave nunca aparece no iPhone nem em navegador sem suporte", () => {
    expect(ids({ brave: true, ios: true, falhou: true })).toEqual(["iphone"]);
    expect(ids({ brave: true, ios: true, instalado: true, falhou: true })).toEqual(["tentar"]);
    expect(ids({ brave: true, estado: "nao-suportado" })).toEqual(["suporte"]);
    expect(ids({ brave: true, estado: "nao-suportado", falhou: true })).toEqual(["suporte"]);
    expect(ids({ brave: true, ios: true, estado: "nao-suportado" })).toEqual(["iphone"]);
  });
  it("iPhone fora da tela inicial → instalar; instalado, não", () => {
    expect(ids({ ios: true, estado: "nao-suportado" })).toEqual(["iphone"]);
    expect(ids({ ios: true })).toEqual(["iphone"]);
    expect(ids({ ios: true, instalado: true })).toEqual([]);
    const [i] = instrucoesDoAparelho({ ...base, ios: true });
    expect(i?.passos.join(" ")).toContain("Adicionar à Tela de Início");
  });
  it("sem suporte e sem caso especial → Chrome/Brave ou instalar (iOS 16.4+)", () => {
    expect(ids({ estado: "nao-suportado" })).toEqual(["suporte"]);
    expect(ids({ estado: "nao-suportado", ios: true, instalado: true })).toEqual(["suporte"]);
    const [s] = instrucoesDoAparelho({ ...base, estado: "nao-suportado" });
    expect(s?.passos.join(" ")).toContain("iOS 16.4 ou mais novo");
  });
  it("falha sem caso especial (Chrome, iPhone instalado, permissão dispensada) → tentar de novo", () => {
    expect(ids({ falhou: true })).toEqual(["tentar"]);
    expect(ids({ falhou: true, ios: true, instalado: true })).toEqual(["tentar"]);
    const [t] = instrucoesDoAparelho({ ...base, falhou: true });
    expect(t?.titulo).toBe("Para tentar de novo");
    expect(t?.passos.join(" ")).toContain("escolha Permitir");
    // o caso especial continua sozinho: não empilha a genérica
    expect(ids({ falhou: true, brave: true })).toEqual(["brave"]);
    expect(ids({ falhou: true, ios: true })).toEqual(["iphone"]);
    // sem falha, nada a explicar
    expect(ids({})).toEqual([]);
  });
  it("as 80 combinações batem com a tabela da SPEC §23.6 (o oráculo)", () => {
    const tabela = tabelaDaSpec();
    const estados: SinaisDasInstrucoes["estado"][] = ["sem-configuracao", "nao-suportado", "bloqueado", "ativado", "desativado"];
    const divergencias: string[] = [];
    let conferidas = 0;
    for (const estado of estados) {
      for (const brave of [false, true]) {
        for (const ios of [false, true]) {
          for (const instalado of [false, true]) {
            for (const falhou of [false, true]) {
              conferidas += 1;
              const sinais = { estado, brave, ios, instalado, falhou };
              const linhas = tabela.filter((l) => casa(l, sinais));
              // cada combinação cai em exatamente uma linha da tabela
              expect(linhas.length, JSON.stringify(sinais)).toBe(1);
              const esperado = linhas[0]?.instrucoes ?? [];
              const obtido = ids(sinais);
              if (JSON.stringify(obtido) !== JSON.stringify(esperado)) {
                divergencias.push(`${JSON.stringify(sinais)}: código=${obtido.join(",")} SPEC=${esperado.join(",")}`);
              }
            }
          }
        }
      }
    }
    expect(conferidas).toBe(80);
    expect(tabela.length).toBeGreaterThanOrEqual(10);
    expect(divergencias).toEqual([]);
  });
  it("com problema, a lista nunca sai vazia (as 80 combinações)", () => {
    const estados: SinaisDasInstrucoes["estado"][] = ["sem-configuracao", "nao-suportado", "bloqueado", "ativado", "desativado"];
    let conferidas = 0;
    for (const estado of estados) {
      for (const brave of [false, true]) {
        for (const ios of [false, true]) {
          for (const instalado of [false, true]) {
            for (const falhou of [false, true]) {
              conferidas += 1;
              const lista = ids({ estado, brave, ios, instalado, falhou });
              const problema = falhou || estado === "bloqueado" || estado === "nao-suportado";
              const mudo = estado === "sem-configuracao" || estado === "ativado";
              if (problema && !mudo) expect(lista.length, JSON.stringify({ estado, brave, ios, instalado, falhou })).toBeGreaterThan(0);
              if (mudo) expect(lista).toEqual([]);
            }
          }
        }
      }
    }
    expect(conferidas).toBe(80);
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
    expect(endpointAceito("http://10.0.0.5:8080/x", "http://10.0.0.5:8080")).toBe(false);
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

describe("fonte única: Mais e o guia de uso (§23.4)", () => {
  it("o guia tem a linha Lembretes com o título, a descrição e a rota de LINHA_LEMBRETES", async () => {
    const { LINHA_LEMBRETES } = await import("@/lib/lembretes");
    const { secaoDoGuia } = await import("@/lib/guia");
    const funcao = secaoDoGuia("mais")?.funcoes.find((f) => f.id === "lembretes");
    expect(funcao?.nome).toBe(LINHA_LEMBRETES.titulo);
    expect(funcao?.href).toBe("/mais/lembretes");
    expect(funcao?.oQueFaz.startsWith(LINHA_LEMBRETES.descricao)).toBe(true);
    expect(funcao?.caminho).toEqual(["Mais", "Lembretes"]);
  });

  it("a tela Mais monta a linha a partir de LINHA_LEMBRETES (sem redigitar)", async () => {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync(new URL("../app/(app)/mais/page.tsx", import.meta.url), "utf8");
    expect(fonte).toContain("...LINHA_LEMBRETES");
    expect(fonte).not.toContain("Receber avisos no celular");
  });
});

/**
 * Ultraloop — Rodada 12, Lote 13 (SPEC §22.13): ficha — mídia e interação;
 * coleções do Explorar. Tudo a 360×740, contra o mock, pelo caminho que o
 * dedo faz, nos dois temas onde o aceite pede.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { ALTURA_MAXIMA_DA_ILUSTRACAO } from "../lib/midia";
import {
  abrirVisaoGeral,
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026: dia de treino (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];

const GOBLET = "agachamento-goblet";
const SUPINO = "supino-reto-com-barra";

/*
 * O config roda um worker só, em série (`workers: 1`, `fullyParallel: false`):
 * cada teste começa do mock limpo, como os outros specs do ultraloop.
 */
test.beforeEach(async () => {
  await resetarMock();
});

async function preparar(
  page: Page,
  tema: Tema = "light",
  ajustes: Record<string, unknown> = {},
): Promise<void> {
  await usuarioComPerfil(ajustes);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await fixarData(page, SEGUNDA);
  await entrarNoApp(page);
}

/** A ficha em folha, pelo "?" do player (o "Como fazer" do exercício). */
async function abrirFichaNoPlayer(page: Page): Promise<void> {
  await esperarAbaTreino(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: /^Como fazer: / }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Qualquer cor de CSS (oklch, color-mix…) em sRGB, pintada sobre `fundo`. */
const CORES = `
  const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const pintar = (cor, fundo) => {
    const tela = document.createElement('canvas');
    tela.width = 1; tela.height = 1;
    const ctx = tela.getContext('2d');
    ctx.fillStyle = 'rgb(' + fundo.map(Math.round).join(',') + ')';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = cor;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const fundoDe = (el) => {
    const pilha = [];
    let atual = el;
    while (atual) {
      const cor = getComputedStyle(atual).backgroundColor;
      if (cor && cor !== 'rgba(0, 0, 0, 0)' && cor !== 'transparent') pilha.push(cor);
      atual = atual.parentElement;
    }
    let fundo = [255, 255, 255];
    for (let i = pilha.length - 1; i >= 0; i--) fundo = pintar(pilha[i], fundo);
    return fundo;
  };
`;

/** Contraste entre o pixel mais distante do fundo e o fundo, numa captura. */
async function contrasteNaCaptura(
  page: Page,
  alvo: Locator,
): Promise<{ razao: number; pixelsFortes: number }> {
  const caixa = await alvo.boundingBox();
  expect(caixa, "o alvo tem caixa").not.toBeNull();
  const png = await page.screenshot({ clip: caixa! });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = (i: number) =>
    0.2126 * canal(data[i]!) + 0.7152 * canal(data[i + 1]!) + 0.0722 * canal(data[i + 2]!);
  const px = (x: number, y: number) => (y * info.width + x) * info.channels;
  // o fundo: a média dos quatro cantos da caixa do ícone (o traço não chega lá)
  const cantos = [
    px(1, 1),
    px(info.width - 2, 1),
    px(1, info.height - 2),
    px(info.width - 2, info.height - 2),
  ];
  const fundo = cantos.reduce((s, i) => s + lum(i), 0) / cantos.length;
  let maior = 1;
  let fortes = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const l = lum(px(x, y));
      const r = (Math.max(l, fundo) + 0.05) / (Math.min(l, fundo) + 0.05);
      if (r > maior) maior = r;
      if (r >= 3) fortes += 1;
    }
  }
  return { razao: maior, pixelsFortes: fortes };
}

/**
 * A figura desenhada pela `<img>` com `object-contain` dentro da área dela, e a
 * largura da COLUNA onde a mídia mora (o pai do `<figure>`). Correção da
 * auditoria: a fração contra a caixa era verdadeira por construção (a caixa
 * estreita até a figura); a que discrimina é contra a coluna.
 */
async function figuraDesenhada(ilustracao: Locator) {
  return ilustracao.evaluate((el) => {
    const img = el.querySelector("img") as HTMLImageElement;
    const area = img.getBoundingClientRect();
    const coluna = el.closest("figure")!.parentElement!.getBoundingClientRect();
    const r = img.naturalWidth / img.naturalHeight;
    const largura = Math.min(area.width, area.height * r);
    return { largura, coluna: coluna.width, altura: Math.min(area.height, area.width / r) };
  });
}

/**
 * As seis ilustrações mais altas (0,35:1 a 0,42:1): com o teto de 432 px de
 * altura, elas ficam abaixo de 60 % da coluna — e batem no teto (SPEC §22.13
 * item 1; a lista inteira é conferida no Vitest).
 */
const ALTAS_DEMAIS = new Set([GOBLET, "triceps-na-corda"]);

function conferirFigura(id: string, m: { largura: number; coluna: number; altura: number }) {
  if (ALTAS_DEMAIS.has(id)) {
    expect(m.altura, `${id}: altura da figura no teto`).toBeGreaterThanOrEqual(
      ALTURA_MAXIMA_DA_ILUSTRACAO - 2,
    );
  } else {
    expect(m.largura / m.coluna, `${id}: figura/coluna`).toBeGreaterThanOrEqual(0.6);
  }
}

// =====================================================================
//  itens 1–6 — a ficha do exercício
// =====================================================================

test.describe("L13 — ficha: a caixa da ilustração (item 1)", () => {
  for (const tema of TEMAS) {
    test(`o goblet passa de 180 px de figura; ≥ 60 % da coluna ou no teto — ${tema}`, async ({
      page,
    }) => {
      await preparar(page, tema);
      for (const id of [GOBLET, "triceps-na-corda", "prancha", SUPINO]) {
        await page.goto(`/exercicios/${id}`);
        const ilustracao = page.locator("[data-ilustracao]").first();
        await expect(ilustracao).toBeVisible();
        await expect
          .poll(() => ilustracao.locator("img").first().evaluate((i) => (i as HTMLImageElement).naturalWidth))
          .toBeGreaterThan(0);
        const m = await figuraDesenhada(ilustracao);
        if (id === GOBLET) expect(m.largura, "goblet: largura da figura").toBeGreaterThanOrEqual(180);
        expect(m.coluna, `${id}: coluna de 328 px`).toBeGreaterThanOrEqual(320);
        conferirFigura(id, m);
        await semRolagemHorizontal(page);
      }
    });
  }

  test("na folha (aberta pelo Como fazer do player) a caixa também segue a figura", async ({
    page,
  }) => {
    await preparar(page);
    await abrirFichaNoPlayer(page);
    const ficha = page.getByRole("dialog");
    const ilustracao = ficha.locator("[data-ilustracao]").first();
    await expect(ilustracao).toBeVisible();
    await expect
      .poll(() => ilustracao.locator("img").first().evaluate((i) => (i as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    const m = await figuraDesenhada(ilustracao);
    // a figura ocupa ≥ 60 % da coluna da folha ou bate no teto de altura
    expect(
      m.largura / m.coluna >= 0.6 || m.altura >= ALTURA_MAXIMA_DA_ILUSTRACAO - 2,
      `figura ${m.largura.toFixed(0)}×${m.altura.toFixed(0)} numa coluna de ${m.coluna.toFixed(0)}`,
    ).toBe(true);
  });

  /*
   * Correção da auditoria: com a caixa na proporção da ilustração, a mídia
   * muda de altura ao trocar de vista — e o segmento, que ficava embaixo
   * dela, saltava até 369 px sob o dedo. Agora ele fica acima da mídia.
   */
  async function topoDoSegmento(grupo: Locator): Promise<number> {
    // lido depois que a folha para de deslizar: duas leituras iguais seguidas
    return grupo.evaluate(
      (g) =>
        new Promise<number>((resolve) => {
          let anterior = g.getBoundingClientRect().top;
          let iguais = 0;
          const id = setInterval(() => {
            const agora = g.getBoundingClientRect().top;
            iguais = Math.abs(agora - anterior) < 0.1 ? iguais + 1 : 0;
            anterior = agora;
            if (iguais >= 3) {
              clearInterval(id);
              resolve(agora);
            }
          }, 100);
        }),
    );
  }

  test("trocar de vista não tira o segmento do lugar (página do goblet)", async ({ page }) => {
    await preparar(page);
    await page.goto(`/exercicios/${GOBLET}`);
    const grupo = page.getByRole("group", { name: "Como ver o exercício" });
    await expect(page.locator("[data-ilustracao]").first()).toBeVisible();
    await grupo.evaluate((g) => g.scrollIntoView({ block: "center" }));
    const antes = await topoDoSegmento(grupo);
    await grupo.getByRole("button", { name: "Figura" }).click();
    await expect(grupo.getByRole("button", { name: "Figura" })).toHaveAttribute("aria-pressed", "true");
    expect(Math.abs((await topoDoSegmento(grupo)) - antes), "Figura").toBeLessThanOrEqual(1);
    await grupo.getByRole("button", { name: "Ilustração" }).click();
    await expect(page.locator("[data-ilustracao]").first()).toBeVisible();
    expect(Math.abs((await topoDoSegmento(grupo)) - antes), "Ilustração").toBeLessThanOrEqual(1);
    await semRolagemHorizontal(page);
  });

  test("trocar de vista não tira o segmento do lugar (folha, com Fotos)", async ({ page }) => {
    await preparar(page);
    await abrirFichaNoPlayer(page);
    const ficha = page.getByRole("dialog");
    const grupo = ficha.getByRole("group", { name: "Como ver o exercício" });
    await expect(ficha.locator("[data-ilustracao]").first()).toBeVisible();
    const antes = await topoDoSegmento(grupo);
    for (const vista of ["Fotos", "Figura", "Ilustração"]) {
      const botao = grupo.getByRole("button", { name: vista });
      if ((await botao.count()) === 0) continue;
      await botao.click();
      await expect(botao).toHaveAttribute("aria-pressed", "true");
      expect(Math.abs((await topoDoSegmento(grupo)) - antes), vista).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("L13 — ficha: fotos na proporção do arquivo (item 2)", () => {
  async function conferirFotos(raiz: Locator) {
    const fotos = raiz.locator("img[data-foto-execucao]");
    await expect(fotos).toHaveCount(2);
    for (const foto of await fotos.all()) {
      await foto.scrollIntoViewIfNeeded();
      await expect
        .poll(() => foto.evaluate((i) => (i as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      const { caixa, arquivo } = await foto.evaluate((i) => {
        const img = i as HTMLImageElement;
        const r = img.getBoundingClientRect();
        return { caixa: r.width / r.height, arquivo: img.naturalWidth / img.naturalHeight };
      });
      expect(Math.abs(caixa - arquivo), "a caixa tem a proporção do arquivo").toBeLessThanOrEqual(0.02);
      expect(Math.abs(caixa - 1), "não é quadrado").toBeGreaterThan(0.1);
    }
    const legendas = raiz.locator("[data-legenda-foto]");
    await expect(legendas).toHaveText(["Início", "Fim"]);
    for (const l of await legendas.all()) await expect(l).toBeVisible();
  }

  test("na página /exercicios/<id>", async ({ page }) => {
    await preparar(page);
    await page.goto(`/exercicios/${SUPINO}`);
    await conferirFotos(page.locator("main"));
    await semRolagemHorizontal(page);
  });

  test("na folha, pela opção Fotos do segmento", async ({ page }) => {
    await preparar(page);
    await abrirFichaNoPlayer(page);
    const ficha = page.getByRole("dialog");
    await ficha
      .getByRole("group", { name: "Como ver o exercício" })
      .getByRole("button", { name: "Fotos" })
      .click();
    await conferirFotos(ficha);
  });
});

test.describe("L13 — ficha: só os links do crédito sublinhados (item 3)", () => {
  for (const tema of TEMAS) {
    test(`"Ilustração: <autor> · <licença>" — ${tema}`, async ({ page }) => {
      await preparar(page, tema);
      await page.goto(`/exercicios/${SUPINO}`);
      const credito = page.locator("[data-credito]");
      await expect(credito).toBeVisible();
      await expect(credito).toContainText(/^Ilustração:/);
      const medida = await credito.evaluate((el) => {
        const links = [...el.querySelectorAll("a")].map((a) => {
          const r = a.getBoundingClientRect();
          return {
            texto: a.textContent ?? "",
            sublinhado: getComputedStyle(a).textDecorationLine,
            l: r.width,
            a: r.height,
          };
        });
        const fora = [...el.children]
          .filter((c) => c.tagName !== "A")
          .map((c) => getComputedStyle(c).textDecorationLine);
        return { links, fora, proprio: getComputedStyle(el).textDecorationLine };
      });
      expect(medida.links).toHaveLength(2);
      for (const l of medida.links) {
        expect(l.sublinhado, `${l.texto} sublinhado`).toContain("underline");
        expect(l.a, `${l.texto}: altura do alvo`).toBeGreaterThanOrEqual(44);
        expect(l.l, `${l.texto}: largura do alvo`).toBeGreaterThanOrEqual(44);
      }
      expect(medida.links[1]!.texto).toMatch(/^CC BY-SA \d\.\d$/);
      expect(medida.proprio).toBe("none");
      expect(medida.fora.every((d) => d === "none")).toBe(true);
      // 11 px (§13.8.1)
      expect(await credito.evaluate((el) => getComputedStyle(el).fontSize)).toBe("11px");
    });
  }
});

test.describe("L13 — ficha: o segundo quadro espera o primeiro (item 4)", () => {
  /*
   * Só os pedidos de IMAGEM contam (os da `<img>` da ficha). O aquecimento de
   * mídia da fase (SPEC §8, `lib/precache-do-programa.ts`) busca por `fetch`,
   * uma vez, depois que o service worker assume — é outro pedido, para o
   * treino funcionar sem rede, e fica fora deste aceite.
   */
  test("a requisição do quadro 2 começa depois do fim da do quadro 1", async ({ page }) => {
    await preparar(page);
    const tempos: { fim1: number | null; inicio2: number | null } = { fim1: null, inicio2: null };
    page.on("request", (r) => {
      if (r.resourceType() === "image" && r.url().includes(`/ilustracoes/${SUPINO}-2.`)) {
        tempos.inicio2 ??= Date.now();
      }
    });
    page.on("requestfinished", (r) => {
      if (r.resourceType() === "image" && r.url().includes(`/ilustracoes/${SUPINO}-1.`)) {
        tempos.fim1 ??= Date.now();
      }
    });
    await page.goto(`/exercicios/${SUPINO}`);
    const ilustracao = page.locator("[data-ilustracao]").first();
    await expect(ilustracao.locator("img")).toHaveCount(2);
    await expect.poll(() => tempos.inicio2).not.toBeNull();
    expect(tempos.fim1, "o quadro 1 foi pedido e chegou").not.toBeNull();
    expect(tempos.inicio2!, "o quadro 2 só é pedido depois do 1").toBeGreaterThanOrEqual(tempos.fim1!);
  });

  test("parada (reduced motion), o quadro 2 só é pedido no toque em Voltar a alternar", async ({
    page,
  }) => {
    await preparar(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const pedidos: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "image" && r.url().includes(`/ilustracoes/${SUPINO}-2.`)) {
        pedidos.push(r.url());
      }
    });
    await page.goto(`/exercicios/${SUPINO}`);
    const ilustracao = page.locator("[data-ilustracao]").first();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "pausada");
    await expect
      .poll(() => ilustracao.locator("img").first().evaluate((i) => (i as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await page.waitForTimeout(2_500);
    expect(pedidos, "nenhum pedido do quadro 2 parado").toEqual([]);
    await expect(ilustracao.locator("img")).toHaveCount(1);

    await ilustracao.getByRole("button", { name: "Voltar a alternar" }).click();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "alternando");
    await expect.poll(() => pedidos.length).toBeGreaterThan(0);
    await expect(ilustracao.locator("img")).toHaveCount(2);
  });
});

test.describe("L13 — a figura não é o botão de pausa (item 5)", () => {
  test("no player, tocar no meio abre o Como fazer; só o botão do canto pausa", async ({
    page,
  }) => {
    await preparar(page);
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);

    const ilustracao = page.locator("[data-ilustracao]").first();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "alternando");
    const figura = ilustracao.locator('[data-figura="abre"]');
    await expect(figura).toHaveAccessibleName(/, posição [12] de 2 — abre o Como fazer$/);

    // o toque no meio da figura abre a ficha, e ela continua alternando
    const caixa = await ilustracao.boundingBox();
    await page.mouse.click(caixa!.x + caixa!.width / 2, caixa!.y + caixa!.height / 2);
    const ficha = page.getByRole("dialog");
    await expect(ficha.getByRole("tab", { name: "Vídeo" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ficha).toHaveCount(0);
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "alternando");

    // o botão do canto: 44×44 e é ele que pausa
    const pausa = ilustracao.getByRole("button", { name: "Parar a animação" });
    const b = await pausa.boundingBox();
    expect(b!.width).toBeGreaterThanOrEqual(44);
    expect(b!.height).toBeGreaterThanOrEqual(44);
    // no canto de baixo à direita da ilustração
    expect(b!.x + b!.width).toBeGreaterThan(caixa!.x + caixa!.width - 12);
    expect(b!.y + b!.height).toBeGreaterThan(caixa!.y + caixa!.height - 12);
    await pausa.click();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "pausada");
    await expect(ilustracao.getByRole("button", { name: "Voltar a alternar" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await semRolagemHorizontal(page);
  });

  test("na Visão geral do treino, tocar na figura do bloco abre o Como fazer", async ({
    page,
  }) => {
    await preparar(page);
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    const geral = page.getByRole("dialog", { name: "Visão geral do treino" });
    const figura = geral.locator('[data-figura="abre"]').first();
    // por CSS: com a ficha aberta por cima, a Visão geral sai da árvore de acessibilidade
    const ilustracaoDoBloco = page
      .locator('[role="dialog"][aria-label="Visão geral do treino"] [data-ilustracao]')
      .first();
    await expect(figura).toHaveAccessibleName(/ — abre o Como fazer$/);
    await figura.click();
    const ficha = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("tab", { name: "Vídeo" }) });
    await expect(ficha).toBeVisible();
    // o toque abriu a ficha, não pausou a figura do bloco
    await expect(ilustracaoDoBloco).not.toHaveAttribute("data-ilustracao", "pausada");
  });

  test("na ficha a figura não é botão: tocar no meio não pausa", async ({ page }) => {
    await preparar(page);
    await page.goto(`/exercicios/${SUPINO}`);
    const ilustracao = page.locator("[data-ilustracao]").first();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "alternando");
    await expect(ilustracao.getByRole("img")).toHaveAccessibleName(
      /^Execução do Supino reto com barra, posição [12] de 2$/,
    );
    const caixa = await ilustracao.boundingBox();
    await page.mouse.click(caixa!.x + caixa!.width / 2, caixa!.y + caixa!.height / 2);
    await page.waitForTimeout(300);
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "alternando");
  });
});

test.describe("L13 — o chip ativo do segmento se vê (item 6)", () => {
  for (const tema of TEMAS) {
    test(`o ativo (contorno de 2 px) ≥ 3:1 contra o inativo e texto ≥ 4,5:1 — ${tema}`, async ({ page }) => {
      await preparar(page, tema);
      await page.goto(`/exercicios/${SUPINO}`);
      const grupo = page.getByRole("group", { name: "Como ver o exercício" });
      await expect(grupo.getByRole("button", { name: "Ilustração" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const r = await grupo.evaluate((el, cores) => {
        const f = new Function("el", `${cores}
          const ativo = el.querySelector('[aria-pressed="true"]');
          const inativo = el.querySelector('[aria-pressed="false"]');
          const fundoAtivo = fundoDe(ativo);
          const trilho = fundoDe(inativo);
          // o que marca o ativo contra o inativo: o contorno (e o fundo)
          const contorno = pintar(getComputedStyle(ativo).borderTopColor, trilho);
          const largura = parseFloat(getComputedStyle(ativo).borderTopWidth);
          const texto = pintar(getComputedStyle(ativo).color, fundoAtivo);
          return {
            chips: Math.max(razao(contorno, trilho) * (largura >= 2 ? 1 : 0), razao(fundoAtivo, trilho)),
            texto: razao(texto, fundoAtivo),
          };
        `);
        return f(el) as { chips: number; texto: number };
      }, CORES);
      expect(r.chips, "ativo × inativo").toBeGreaterThanOrEqual(3);
      expect(r.texto, "texto do ativo").toBeGreaterThanOrEqual(4.5);
    });
  }
});

// =====================================================================
//  itens 7–10 — as coleções do Explorar
// =====================================================================

/** As cinco seções de "Escolhas para você" (components/explorar/tela-explorar.tsx). */
const SECOES = ["Treinos do programa", "Parte do corpo", "Circuitos", "Por aparelho", "Planos"];

test.describe("L13 — Explorar: linhas da mesma seção com a mesma altura (item 7)", () => {
  for (const tema of TEMAS) {
    test(`todas as linhas de cada seção de "Escolhas para você" — ${tema}`, async ({ page }) => {
      await preparar(page, tema);
      await page.goto("/explorar");
      await expect(page.locator("[data-colecao]").first()).toBeVisible();
      for (const nome of SECOES) {
        const secao = page.getByRole("region", { name: nome, exact: true });
        // "Ver todos": a regra vale para a seção inteira, não só a prévia
        const verTodos = secao.getByRole("button", { name: /^Ver todos/ });
        if ((await verTodos.count()) > 0) await verTodos.click();
        const alturas = await secao
          .locator("[data-colecao]")
          .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        expect(alturas.length, `${nome}: linhas`).toBeGreaterThan(0);
        const menor = Math.min(...alturas);
        const maior = Math.max(...alturas);
        expect(maior - menor, `${nome}: ${alturas.map((a) => a.toFixed(1)).join(", ")}`).toBeLessThanOrEqual(1);
      }
      await semRolagemHorizontal(page);
    });
  }
});

test.describe("L13 — Explorar: raios na linha da meta, chevron centrado (item 10)", () => {
  async function conferirLinhas(page: Page, linhas: Locator, onde: string) {
    const medidas = await linhas.evaluateAll((els) =>
      els.map((el) => {
        const linha = el.getBoundingClientRect();
        const svgs = [...el.querySelectorAll(":scope > svg")];
        const chevron = svgs[svgs.length - 1]!.getBoundingClientRect();
        const raios = el.querySelector("[data-raios]");
        const meta = el.querySelector('[data-linha="meta"]');
        const titulo = el.querySelector('[data-linha="titulo"]')!.getBoundingClientRect();
        // qualquer marca no canto de cima à direita (acima do meio da linha)
        const marcasNoAlto = [...el.querySelectorAll("svg, [data-raios]")].filter((m) => {
          const r = m.getBoundingClientRect();
          return r.left > titulo.right - 1 && r.bottom < linha.top + linha.height / 2 - 2;
        }).length;
        return {
          id: el.getAttribute("data-colecao"),
          centroChevron: chevron.top + chevron.height / 2,
          centroLinha: linha.top + linha.height / 2,
          marcasNoAlto,
          raiosNaMeta: raios ? (meta ? meta.contains(raios) : null) : true,
          metaTemExercicios: meta ? /exerc[ií]cio/.test(meta.textContent ?? "") : null,
          // |centro dos raios − centro da palavra "exercícios"| (null sem raios)
          distanciaDosRaios: (() => {
            if (!raios || !meta) return null;
            const andar = document.createTreeWalker(meta, NodeFilter.SHOW_TEXT);
            for (let n = andar.nextNode(); n; n = andar.nextNode()) {
              const i = (n.textContent ?? "").search(/exerc[ií]cio/);
              if (i < 0) continue;
              const trecho = document.createRange();
              trecho.setStart(n, i);
              trecho.setEnd(n, i + "exercício".length);
              const b = trecho.getClientRects()[0]!;
              const a = raios.getBoundingClientRect();
              return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2));
            }
            return null;
          })(),
        };
      }),
    );
    expect(medidas.length, `${onde}: linhas`).toBeGreaterThan(0);
    for (const m of medidas) {
      expect(Math.abs(m.centroChevron - m.centroLinha), `${onde} ${m.id}: chevron`).toBeLessThanOrEqual(2);
      expect(m.marcasNoAlto, `${onde} ${m.id}: marca no canto de cima`).toBe(0);
      expect(m.raiosNaMeta, `${onde} ${m.id}: raios na linha da meta`).not.toBe(false);
    }
    // os raios ficam na mesma linha visual do texto "exercícios" — em TODA
    // linha com raios e "exercícios" na meta (as de aparelho quebram em 2)
    const comRaios = medidas.filter((m) => m.metaTemExercicios && m.distanciaDosRaios !== null);
    expect(comRaios.length, `${onde}: linhas com raios e "exercícios" na meta`).toBeGreaterThan(0);
    for (const m of comRaios) {
      expect(m.distanciaDosRaios!, `${onde} ${m.id}: raios na linha de "exercícios"`).toBeLessThanOrEqual(4);
    }
    await semRolagemHorizontal(page);
    return medidas;
  }

  test("na vitrine", async ({ page }) => {
    await preparar(page);
    await page.goto("/explorar");
    const linhas = page.locator("[data-colecao]");
    await expect(linhas.first()).toBeVisible();
    // todas as linhas de cada seção, com os "Ver todos" abertos
    for (const nome of SECOES) {
      const verTodos = page
        .getByRole("region", { name: nome, exact: true })
        .getByRole("button", { name: /^Ver todos/ });
      if ((await verTodos.count()) > 0) await verTodos.click();
    }
    const medidas = await conferirLinhas(page, linhas, "vitrine");
    // as 9 linhas de "Por aparelho" (meta em 2 linhas) estão na conta
    expect(
      medidas.filter((m) => m.id?.startsWith("aparelho:") && m.distanciaDosRaios !== null).length,
      "linhas de aparelho com raios",
    ).toBeGreaterThan(0);
    // o treino A (meta numa linha) também está na conta
    const treinoA = medidas.find((m) => m.id?.startsWith("treino:"));
    expect(treinoA?.distanciaDosRaios, "o treino A tem raios").not.toBeNull();
  });

  test("no resultado da busca", async ({ page }) => {
    await preparar(page);
    await page.goto("/explorar");
    for (const termo of ["supino", "corda"]) {
      await page.locator('main input[type="search"]').first().fill(termo);
      const linhas = page.locator("[data-colecao]");
      await expect(linhas.first()).toBeVisible();
      await conferirLinhas(page, linhas, `busca "${termo}"`);
    }
  });
});

test.describe("L13 — coleção de plano: capa com ícone e as semanas (itens 8 e 9)", () => {
  for (const tema of TEMAS) {
    test(`corrida: ícone na capa, barra das concluídas e 12 semanas — ${tema}`, async ({ page }) => {
      await preparar(page, tema, { semana_corrida: 3, semana_corda: 5 });
      await page.goto("/explorar/plano/corrida");

      // item 8: o ícone do tipo na capa sem foto, ≥ 48 px, fora do véu
      const capa = page.locator("[data-capa]").first();
      const icone = capa.locator("[data-capa-icone] svg");
      await expect(icone).toBeVisible();
      const caixa = await icone.boundingBox();
      expect(caixa!.width).toBeGreaterThanOrEqual(48);
      expect(caixa!.height).toBeGreaterThanOrEqual(48);
      const titulo = await capa.getByRole("heading", { level: 1 }).boundingBox();
      expect(caixa!.y + caixa!.height, "o ícone acima do bloco do título").toBeLessThanOrEqual(
        titulo!.y,
      );
      const { razao, pixelsFortes } = await contrasteNaCaptura(page, icone);
      expect(razao, "ícone × fundo da capa (SC 1.4.11)").toBeGreaterThanOrEqual(3);
      expect(pixelsFortes, "o traço do ícone passa de 3:1, não um pixel solto").toBeGreaterThan(40);

      // item 9: "Semana 3 de 12" com 2 concluídas
      const barra = page.getByRole("progressbar", { name: /semanas concluídas/ });
      await expect(barra).toHaveAttribute("aria-valuenow", "2");
      await expect(barra).toHaveAttribute("aria-valuemax", "12");
      await expect(page.getByText("Semana 3 de 12 · 2 concluídas")).toBeVisible();
      const semanas = page.locator("[data-semana-do-plano]");
      await expect(semanas).toHaveCount(12);
      await expect(page.locator('[data-semana-do-plano="feita"]')).toHaveCount(2);
      const atual = page.locator('[aria-current="step"]');
      await expect(atual).toHaveCount(1);
      await expect(atual).toContainText("Semana 3");
      await expect(atual.getByRole("link", { name: "Abrir a sessão desta semana" })).toHaveAttribute(
        "href",
        "/cardio/corrida?semana=3",
      );
      const altura = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(altura).toBeGreaterThan(740);
      await semRolagemHorizontal(page);

      // contraste AA de todo texto da lista (a linha atual tem fundo próprio)
      const fracos = await page
        .locator("section[aria-labelledby=semanas-do-plano]")
        .evaluate((raiz, cores) => {
          const f = new Function("raiz", `${cores}
            const ruins = [];
            for (const el of raiz.querySelectorAll("*")) {
              const texto = [...el.childNodes]
                .filter((n) => n.nodeType === 3)
                .map((n) => n.textContent.trim())
                .join("");
              if (!texto) continue;
              const fundo = fundoDe(el);
              const cor = pintar(getComputedStyle(el).color, fundo);
              const r = razao(cor, fundo);
              if (r < 4.5) ruins.push(texto.slice(0, 30) + ": " + r.toFixed(2));
            }
            return ruins;
          `);
          return f(raiz) as string[];
        }, CORES);
      expect(fracos, "texto abaixo de 4,5:1").toEqual([]);
    });

    test(`corda: um estágio por linha, o atual pela semana_corda — ${tema}`, async ({ page }) => {
      await preparar(page, tema, { semana_corrida: 3, semana_corda: 5 });
      await page.goto("/explorar/plano/corda");
      const barra = page.getByRole("progressbar", { name: /semanas concluídas/ });
      await expect(barra).toHaveAttribute("aria-valuenow", "4");
      await expect(page.locator("[data-semana-do-plano]")).toHaveCount(5);
      const atual = page.locator('[aria-current="step"]');
      await expect(atual).toHaveCount(1);
      await expect(atual).toContainText("Semanas 5–6");
      const altura = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(altura).toBeGreaterThan(740);
      await semRolagemHorizontal(page);
    });
  }
});

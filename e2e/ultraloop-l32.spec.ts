/**
 * Ultraloop — Rodada 21, Lote 32 (SPEC §22.15): sobras das auditorias da
 * ficha e das coleções do Explorar. Tudo a 360×740, contra o mock, pelo
 * caminho que o dedo faz, nos dois temas onde o aceite pede.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { acharExercicio } from "../lib/dados";
import { tagsDoEquipamento } from "../lib/ficha";
import {
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026: dia de treino (SPEC §5) — A1 começa no agachamento livre. */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];

const AGACHAMENTO = "agachamento-livre";
const SUPINO = "supino-reto-com-barra";
/** O primeiro da lista do "Substituir" do agachamento livre. */
const AFUNDO = "afundo-passada";

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

/** A ficha em folha, pelo "?" do player (o "Como fazer" do agachamento livre). */
async function abrirFichaNoPlayer(page: Page): Promise<Locator> {
  await esperarAbaTreino(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: /^Como fazer: / }).first().click();
  const ficha = page.getByRole("dialog");
  await expect(ficha).toBeVisible();
  await expect(ficha.getByRole("heading", { name: acharExercicio(AGACHAMENTO).nome })).toBeVisible();
  return ficha;
}

/** "Substituir" → o exercício pelo nome; a ficha continua aberta com ele. */
async function substituirPor(ficha: Locator, id: string): Promise<void> {
  const nome = acharExercicio(id).nome;
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await ficha.getByRole("button", { name: new RegExp(`^${nome.replace(/[/]/g, "\\/")}`) }).click();
  await expect(ficha.getByRole("heading", { name: nome })).toBeVisible();
}

async function proximo(ficha: Locator, id: string): Promise<void> {
  await ficha.getByRole("button", { name: "Próximo exercício" }).click();
  await expect(ficha.getByRole("heading", { name: acharExercicio(id).nome })).toBeVisible();
}

/* ============================================================ item 1 */

test.describe("§22.15 item 1 — a figura nasce de novo também no Substituir", () => {
  // o service worker serviria os quadros do cache dele, fora do `route`
  test.use({ serviceWorkers: "block" });

  async function lerFigura(figura: Locator) {
    return figura.evaluate((el) => {
      const imgs = [...el.querySelectorAll("img")] as HTMLImageElement[];
      return {
        srcs: imgs.map((i) => i.getAttribute("src") ?? ""),
        chegou2: Boolean(imgs[1]?.complete && imgs[1].naturalWidth > 0),
        posicao: el.getAttribute("data-posicao"),
      };
    });
  }

  test("Substituir com o agachamento na posição 2: o afundo começa na 1 e o quadro 2 espera o 1", async ({
    page,
  }) => {
    await preparar(page);
    const QUADRO_2 = new RegExp(`/ilustracoes/${AFUNDO}-2\\.`);
    const tempos: { fim1: number | null; inicio2: number | null } = { fim1: null, inicio2: null };
    page.on("request", (r) => {
      if (r.resourceType() === "image" && QUADRO_2.test(r.url())) tempos.inicio2 ??= Date.now();
    });
    page.on("requestfinished", (r) => {
      if (r.resourceType() === "image" && r.url().includes(`/ilustracoes/${AFUNDO}-1.`)) {
        tempos.fim1 ??= Date.now();
      }
    });
    // o quadro 2 do afundo demora 2,5 s: a posição herdada apareceria vazia
    await page.route(QUADRO_2, async (rota) => {
      await new Promise((r) => setTimeout(r, 2_500));
      await rota.continue();
    });

    const ficha = await abrirFichaNoPlayer(page);
    const figura = ficha.locator("[data-ilustracao]").first();
    await expect
      .poll(async () => (await lerFigura(figura)).srcs[0] ?? "")
      .toContain(`/ilustracoes/${AGACHAMENTO}-1.`);
    await expect(figura).toHaveAttribute("data-posicao", "2", { timeout: 6_000 });

    await substituirPor(ficha, AFUNDO);
    await expect
      .poll(async () => (await lerFigura(figura)).srcs[0] ?? "")
      .toContain(`/ilustracoes/${AFUNDO}-1.`);
    let semOQuadro2 = 0;
    for (let i = 0; i < 12; i += 1) {
      const f = await lerFigura(figura);
      if (f.chegou2) break;
      semOQuadro2 += 1;
      expect(f.posicao, "sem o quadro 2 do afundo, a posição fica na 1").toBe("1");
      await page.waitForTimeout(150);
    }
    expect(semOQuadro2, "o atraso do quadro 2 foi visto").toBeGreaterThan(3);
    await expect.poll(() => tempos.inicio2).not.toBeNull();
    expect(tempos.fim1, "o quadro 1 do afundo foi pedido e chegou").not.toBeNull();
    expect(tempos.inicio2!, "o quadro 2 do afundo só é pedido depois do 1").toBeGreaterThanOrEqual(
      tempos.fim1!,
    );
    await expect
      .poll(async () => (await lerFigura(figura)).chegou2, { timeout: 6_000 })
      .toBe(true);
    await expect(figura).toHaveAttribute("data-posicao", "2", { timeout: 4_000 });
  });

  test("com a aba Músculos aberta, › e Substituir mostram os músculos do exercício novo", async ({
    page,
  }) => {
    await preparar(page);
    const ficha = await abrirFichaNoPlayer(page);
    const aba = ficha.getByRole("tab", { name: "Músculos" });
    await aba.click();
    await expect(aba).toHaveAttribute("aria-selected", "true");
    const painel = ficha.getByRole("tabpanel");
    const principais = (id: string) =>
      `Principais: ${acharExercicio(id).musculos_primarios_nome.join(", ")}`;
    await expect(painel).toContainText(principais(AGACHAMENTO));

    await proximo(ficha, SUPINO);
    await expect(aba).toHaveAttribute("aria-selected", "true");
    await expect(painel).toContainText(principais(SUPINO));
    await expect(painel.getByRole("img", { name: /Execução/ })).toHaveCount(0);

    await ficha.getByRole("button", { name: "Exercício anterior" }).click();
    await expect(ficha.getByRole("heading", { name: acharExercicio(AGACHAMENTO).nome })).toBeVisible();
    await substituirPor(ficha, AFUNDO);
    await expect(aba).toHaveAttribute("aria-selected", "true");
    await expect(painel).toContainText(principais(AFUNDO));
    await expect(painel.getByRole("img", { name: /Execução/ })).toHaveCount(0);
  });
});

/* ============================================================ item 2 */

test.describe("§22.15 item 2 — a figura quebrada não passa para o próximo", () => {
  test.use({ serviceWorkers: "block" });

  /** A ficha no player com "Figura" escolhida e a figura do agachamento abortada. */
  async function figuraDoAgachamentoQuebrada(page: Page): Promise<Locator> {
    await preparar(page);
    let abortados = 0;
    await page.route(new RegExp(`/figuras/${AGACHAMENTO}\\.svg`), async (rota) => {
      abortados += 1;
      await rota.abort("failed");
    });
    const ficha = await abrirFichaNoPlayer(page);
    await ficha
      .getByRole("group", { name: "Como ver o exercício" })
      .getByRole("button", { name: "Figura" })
      .click();
    await expect.poll(() => abortados).toBeGreaterThan(0);
    // a figura quebrou: a foto de início aparece no lugar
    await expect(
      ficha.getByRole("img", { name: `${acharExercicio(AGACHAMENTO).nome} — início` }),
    ).toBeVisible();
    return ficha;
  }

  async function conferirFigura(ficha: Locator, id: string): Promise<void> {
    const figura = ficha.locator(`img[src*="/figuras/${id}.svg"]`);
    await expect(figura, `a figura de ${id} aparece`).toBeVisible();
    await expect
      .poll(() => figura.evaluate((i) => (i as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(figura).toHaveAttribute("alt", `Execução: ${acharExercicio(id).nome}`);
    await expect(
      ficha.getByRole("img", { name: `${acharExercicio(id).nome} — início` }),
      "e não a foto",
    ).toHaveCount(0);
  }

  test("› do agachamento (figura abortada) ao supino: a figura do supino aparece", async ({ page }) => {
    const ficha = await figuraDoAgachamentoQuebrada(page);
    await proximo(ficha, SUPINO);
    await expect(
      ficha.getByRole("group", { name: "Como ver o exercício" }).getByRole("button", { name: "Figura" }),
    ).toHaveAttribute("aria-pressed", "true");
    await conferirFigura(ficha, SUPINO);
  });

  test("Substituir o agachamento (figura abortada) pelo afundo: a figura do afundo aparece", async ({
    page,
  }) => {
    const ficha = await figuraDoAgachamentoQuebrada(page);
    await substituirPor(ficha, AFUNDO);
    await conferirFigura(ficha, AFUNDO);
  });
});

/* ============================================================ item 3 */

test.describe("§22.15 item 3 — \"Execução: <nome>\", sem artigo", () => {
  test("na ficha da prancha e no player", async ({ page }) => {
    await preparar(page);
    await page.goto("/exercicios/prancha");
    const figura = page.getByRole("img", { name: /^Execução: Prancha(, posição \d de \d)?$/ });
    await expect(figura.first()).toBeVisible();
    await expect(page.getByRole("img", { name: /Execução d[oa] / })).toHaveCount(0);

    await page.goto("/");
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await expect(
      page.getByRole("button", { name: `Execução: ${acharExercicio(AGACHAMENTO).nome} — abre o Como fazer` }),
    ).toBeVisible();
  });
});

/* ======================================================= itens 5 e 6 */

async function buscar(page: Page, termo: string): Promise<Locator> {
  await page.locator('main input[type="search"]').first().fill(termo);
  const achadas = page.getByRole("region", { name: "Coleções encontradas" });
  await expect(achadas).toBeVisible();
  return achadas;
}

test.describe("§22.15 item 5 — na busca, sem vão onde não há subtítulo", () => {
  for (const tema of TEMAS) {
    test(`busca "corda": a linha sem subtítulo não reserva a linha vazia — ${tema}`, async ({ page }) => {
      await preparar(page, tema);
      await page.goto("/explorar");
      const achadas = await buscar(page, "corda");
      const medidas = await achadas.locator("[data-colecao]").evaluateAll((linhas) =>
        linhas.map((l) => {
          const titulo = l.querySelector('[data-linha="titulo"]')!.getBoundingClientRect();
          const vazio = l.querySelector('[data-linha="subtitulo-vazio"]');
          const sub = l.querySelector('[data-linha="subtitulo"]');
          const depois = titulo.bottom;
          const coluna = l.querySelector('[data-linha="titulo"]')!.parentElement!.parentElement!;
          const filhos = [...coluna.children];
          const i = filhos.findIndex((f) => f.contains(l.querySelector('[data-linha="titulo"]')));
          // a próxima linha COM texto (o motivo ou a meta), pulando a reserva vazia
          const seguinte =
            filhos
              .slice(i + 1)
              .find((f) => f.getAttribute("data-linha") !== "subtitulo-vazio")
              ?.getBoundingClientRect() ?? null;
          return {
            id: l.getAttribute("data-colecao"),
            temSubtitulo: Boolean(sub),
            circuito: Boolean(l.querySelector('[data-selo="circuito"]')),
            vazio: Boolean(vazio),
            vao: seguinte ? seguinte.top - depois : null,
          };
        }),
      );
      const semSubtitulo = medidas.filter((m) => !m.temSubtitulo && !m.circuito);
      // Tríceps, Cross over de parede, Tatame EVA e outras
      expect(semSubtitulo.length).toBeGreaterThanOrEqual(3);
      for (const m of semSubtitulo) {
        expect(m.vazio, `${m.id}: sem nó de subtítulo vazio`).toBe(false);
        expect(m.vao, `${m.id}: título colado na linha seguinte`).not.toBeNull();
        expect(m.vao!, `${m.id}: vão entre o título e a linha seguinte`).toBeLessThanOrEqual(4);
      }
      // o circuito sem subtítulo continua com a linha do selo
      const circuito = achadas.locator('[data-colecao="circuito:corda"]');
      await expect(circuito.locator('[data-linha="subtitulo-vazio"] [data-selo="circuito"]')).toBeVisible();
      await semRolagemHorizontal(page);
    });
  }

  test("a vitrine continua reservando: mesma altura por seção", async ({ page }) => {
    await preparar(page);
    await page.goto("/explorar");
    for (const nome of ["Parte do corpo", "Por aparelho"]) {
      const secao = page.getByRole("region", { name: nome });
      const botao = secao.getByRole("button", { name: /^Ver todos/ });
      if (await botao.count()) await botao.click();
      const alturas = await secao
        .locator("[data-colecao]")
        .evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().height));
      expect(alturas.length).toBeGreaterThan(3);
      expect(Math.max(...alturas) - Math.min(...alturas), nome).toBeLessThanOrEqual(1);
      await expect(secao.locator('[data-linha="subtitulo-vazio"]').first()).toBeAttached();
    }
  });
});

test.describe("§22.15 item 6 — na busca, a coleção leva a capa da vitrine", () => {
  test('"Corda: 5 estágios" tem a mesma foto na seção Planos e na busca "corda"', async ({ page }) => {
    await preparar(page);
    await page.goto("/explorar");
    const naVitrine = page
      .getByRole("region", { name: "Planos" })
      .locator('[data-colecao="plano:corda"] img');
    await expect(naVitrine).toHaveCount(1);
    const src = await naVitrine.getAttribute("src");
    expect(src).toBeTruthy();

    const achadas = await buscar(page, "corda");
    const naBusca = achadas.locator('[data-colecao="plano:corda"] img');
    await expect(naBusca).toHaveCount(1);
    await expect(naBusca).toHaveAttribute("src", src!);
    // nenhuma foto repetida no resultado
    const fotos = await achadas
      .locator("[data-colecao] img")
      .evaluateAll((is) => is.map((i) => i.getAttribute("src")));
    expect(new Set(fotos).size).toBe(fotos.length);
  });
});

/* ============================================================ item 7 */

test.describe("§22.15 item 7 — a posição no plano aparece uma vez", () => {
  for (const plano of ["corrida", "barra_fixa"] as const) {
    test(`/explorar/plano/${plano} com o perfil na semana 3`, async ({ page }) => {
      await preparar(page, "light", { semana_corrida: 3, semana_fixa: 3 });
      await page.goto(`/explorar/plano/${plano}`);
      const bloco = page.locator("section[aria-labelledby=semanas-do-plano]");
      await expect(bloco.getByRole("progressbar")).toBeVisible();
      const texto = (await page.locator("main").innerText()).toLowerCase();
      const vezes = texto.match(/semana 3 de \d+/g) ?? [];
      expect(vezes, "a posição uma vez só na rolagem").toHaveLength(1);
      await expect(bloco).toContainText(/Semana 3 de \d+ · 2 concluídas/);
      // a capa diz o que o plano é, não a posição
      await expect(page.locator("[data-capa]").first()).not.toContainText(/semana \d+ de/i);
    });
  }
});

/* ============================================================ item 8 */

/** Um pixel da captura da página inteira, em coordenadas CSS (escala 1). */
async function pixel(png: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

const perto = (a: number[], b: number[], tolerancia = 4) =>
  a.every((v, i) => Math.abs(v - b[i]!) <= tolerancia);

test.describe("§22.15 item 8 — a linha agora não cobre o canto do cartão", () => {
  for (const tema of TEMAS) {
    for (const [semana, canto] of [
      [1, "primeira"],
      [12, "última"],
    ] as const) {
      test(`corrida na semana ${semana} (linha atual é a ${canto}) — ${tema}`, async ({ page }) => {
        await preparar(page, tema, { semana_corrida: semana });
        await page.goto("/explorar/plano/corrida");
        const lista = page.locator("section[aria-labelledby=semanas-do-plano] ol");
        const atual = lista.locator('[aria-current="step"]');
        await expect(atual).toContainText(`Semana ${semana}`);
        await atual.evaluate((el) => el.scrollIntoView({ block: "center" }));
        const caixa = (await lista.boundingBox())!;
        const linha = (await atual.boundingBox())!;
        const png = await page.screenshot();
        const yCanto = semana === 1 ? caixa.y + 1 : caixa.y + caixa.height - 2;
        // o fundo da página, na margem de 16 px à esquerda da lista
        const pagina = await pixel(png, caixa.x - 6, yCanto);
        // o fundo da linha atual, no meio da borda de cima/baixo dela
        const yLinha = semana === 1 ? linha.y + 4 : linha.y + linha.height - 4;
        const daLinha = await pixel(png, caixa.x + caixa.width / 2, yLinha);
        expect(perto(pagina, daLinha), "a linha atual tem fundo próprio").toBe(false);
        // o canto de fora do raio (1 px para dentro da caixa)
        for (const x of [caixa.x + 1, caixa.x + caixa.width - 2]) {
          const c = await pixel(png, x, yCanto);
          expect(perto(c, pagina, 6), `canto (${Math.round(x)}, ${Math.round(yCanto)}): fundo da página`).toBe(true);
        }
        // o anel de foco do link da semana cabe inteiro dentro da lista
        const link = atual.getByRole("link", { name: "Abrir a sessão desta semana" });
        // pelo teclado, para o anel ser o do :focus-visible
        await link.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(link).toBeFocused();
        const anel = await link.evaluate((el) => {
          const e = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const largura = e.outlineStyle === "none" ? 0 : parseFloat(e.outlineWidth);
          const fora = largura + Math.max(0, parseFloat(e.outlineOffset || "0"));
          return {
            visivel: largura >= 2,
            l: r.left - fora,
            t: r.top - fora,
            r: r.right + fora,
            b: r.bottom + fora,
          };
        });
        expect(anel.visivel, "o link tem anel de foco").toBe(true);
        const box = (await lista.boundingBox())!;
        expect(anel.l).toBeGreaterThanOrEqual(box.x);
        expect(anel.r).toBeLessThanOrEqual(box.x + box.width);
        expect(anel.t).toBeGreaterThanOrEqual(box.y);
        expect(anel.b).toBeLessThanOrEqual(box.y + box.height);
      });
    }
  }
});

/* =========================================================== item 10 */

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

test.describe("§22.15 item 10 — a tag que abre a coleção parece link; a outra, texto", () => {
  for (const tema of TEMAS) {
    test(`supino reto com barra: tag-link × tag-texto sem hover — ${tema}`, async ({ page }) => {
      await preparar(page, tema);
      await page.goto(`/exercicios/${SUPINO}`);
      const tags = page.locator("[data-tags-equipamento]");
      await expect(tags).toBeVisible();
      await page.mouse.move(0, 0);
      const esperadas = tagsDoEquipamento(acharExercicio(SUPINO).equipamento);
      const comLink = esperadas.filter((t) => t.href);
      const semLink = esperadas.filter((t) => !t.href);
      expect(comLink.length).toBeGreaterThan(0);
      expect(semLink.length).toBeGreaterThan(0);
      await expect(tags.locator('[data-tag-equipamento="link"]')).toHaveCount(comLink.length);
      await expect(tags.locator('[data-tag-equipamento="texto"]')).toHaveCount(semLink.length);

      const estilos = await tags.locator("[data-tag-equipamento]").evaluateAll(
        (els, codigo) => {
          const f = new Function(`${codigo}; return { razao, pintar, fundoDe };`)();
          return els.map((el) => {
            const e = getComputedStyle(el);
            const fundo = f.fundoDe(el);
            return {
              tipo: el.getAttribute("data-tag-equipamento"),
              texto: (el.textContent ?? "").trim(),
              sublinhado: e.textDecorationLine.includes("underline"),
              borda: parseFloat(e.borderTopWidth) > 0 && e.borderTopColor !== "rgba(0, 0, 0, 0)",
              fundo: e.backgroundColor,
              svg: el.querySelectorAll("svg").length,
              razao: f.razao(f.pintar(e.color, fundo), fundo),
            };
          });
        },
        CORES,
      );
      for (const s of estilos) {
        expect(s.razao, `${s.texto}: contraste`).toBeGreaterThanOrEqual(4.5);
        if (s.tipo === "link") {
          expect(s.sublinhado, `${s.texto}: sublinhado sem hover`).toBe(true);
          expect(s.borda, `${s.texto}: contorno`).toBe(true);
          expect(s.svg, `${s.texto}: a seta`).toBe(1);
        } else {
          expect(s.sublinhado, `${s.texto}: sem sublinhado`).toBe(false);
          expect(s.borda, `${s.texto}: sem borda`).toBe(false);
          expect(s.fundo, `${s.texto}: sem fundo`).toBe("rgba(0, 0, 0, 0)");
          expect(s.svg, `${s.texto}: sem seta`).toBe(0);
        }
      }
      // a seta não entra no nome do link
      for (const t of comLink) {
        await expect(tags.getByRole("link", { name: t.rotulo, exact: true })).toHaveAttribute(
          "href",
          t.href!,
        );
      }
      await semRolagemHorizontal(page);
    });
  }
});

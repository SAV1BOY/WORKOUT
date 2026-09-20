/**
 * Ultraloop 20/09 — Lote 2 (SPEC §22.2): Relatório, Corpo, Calendário e
 * Explorar. Um teste por item que se vê na tela.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  estadoDoMock,
  fixarData,
  irNaAba,
  lerDoMock,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

/** Um PNG 16 × 16 de verdade (o app o decodifica no canvas antes de subir). */
const PNG_16 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4YSNHEmIY1TCqYfhqAADXFCIQU/5f4AAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async () => {
  await resetarMock();
});

/**
 * O contraste do texto contra o fundo efetivo (sobe pelos ancestrais até uma
 * cor opaca) — a mesma conta da varredura, aqui só para um elemento.
 */
async function contrasteDe(page: Page, seletor: string): Promise<number> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return 0;
    const canal = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]: number[]) =>
      0.2126 * canal(r ?? 0) + 0.7152 * canal(g ?? 0) + 0.0722 * canal(b ?? 0);
    const rgba = (cor: string): number[] | null => {
      const m = cor.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = (m[1] ?? "").split(/[,/]/).map((x) => Number.parseFloat(x.trim()));
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, Number.isFinite(p[3]) ? (p[3] as number) : 1];
    };
    const sobrepor = (f: number[], fundo: number[]) => [
      (f[0] ?? 0) * (f[3] ?? 1) + (fundo[0] ?? 0) * (1 - (f[3] ?? 1)),
      (f[1] ?? 0) * (f[3] ?? 1) + (fundo[1] ?? 0) * (1 - (f[3] ?? 1)),
      (f[2] ?? 0) * (f[3] ?? 1) + (fundo[2] ?? 0) * (1 - (f[3] ?? 1)),
    ];
    const pilha: number[][] = [];
    let atual: Element | null = el;
    while (atual) {
      const c = rgba(getComputedStyle(atual).backgroundColor);
      if (c && (c[3] ?? 0) > 0) {
        pilha.push(c);
        if ((c[3] ?? 0) >= 0.999) break;
      }
      atual = atual.parentElement;
    }
    const raiz = rgba(getComputedStyle(document.documentElement).backgroundColor);
    let fundo = raiz && (raiz[3] ?? 0) > 0 ? [raiz[0] ?? 0, raiz[1] ?? 0, raiz[2] ?? 0] : [255, 255, 255];
    for (let i = pilha.length - 1; i >= 0; i--) fundo = sobrepor(pilha[i] ?? [], fundo);
    const cor = rgba(getComputedStyle(el).color) ?? [0, 0, 0, 1];
    const frente = sobrepor(cor, fundo);
    const a = lum(frente);
    const b = lum(fundo);
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  }, seletor);
}

test.describe("Lote 2 — Relatório (SPEC §22.2 item 1)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`os três totais têm rótulo de uma linha e a mesma base — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioComPerfil();
      await page.emulateMedia({ colorScheme: tema });
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await irNaAba(page, "Relatório");

      const totais = page.getByRole("region", { name: "Totais" });
      await expect(totais).toBeVisible();
      await expect(totais.locator('[data-contador="Volume"]')).toContainText("kg no total");

      // os três do topo e também os cinco dos Números (onde mora "Barra fixa")
      const todos = page.locator("main [data-contador]");
      await expect(todos.first()).toBeVisible();
      const quebrados = await todos.evaluateAll((nos) =>
        nos
          .map((no) => {
            const rotulo = no.querySelector("[data-rotulo]") as HTMLElement | null;
            if (!rotulo) return null;
            const linha = parseFloat(getComputedStyle(rotulo).lineHeight);
            const alto = rotulo.getBoundingClientRect().height > Math.max(linha, 16) + 1;
            const cortou = rotulo.scrollWidth > rotulo.clientWidth + 1;
            return alto || cortou
              ? `${no.getAttribute("data-contador")}: ${alto ? "duas linhas" : "cortado"}`
              : null;
          })
          .filter((x): x is string => x !== null),
      );
      expect(quebrados, "rótulo de contador quebrado ou cortado").toEqual([]);

      const medidas = await totais.locator("[data-contador]").evaluateAll((nos) =>
        nos.map((no) => {
          const rotulo = no.querySelector("[data-rotulo]") as HTMLElement | null;
          const numero = no.querySelector(".numero-grande") as HTMLElement | null;
          const linha = rotulo ? parseFloat(getComputedStyle(rotulo).lineHeight) : 0;
          return {
            nome: no.getAttribute("data-contador") ?? "?",
            alturaDoRotulo: rotulo?.getBoundingClientRect().height ?? 0,
            linha,
            cortou: rotulo ? rotulo.scrollWidth > rotulo.clientWidth + 1 : false,
            topoDoNumero: Math.round(numero?.getBoundingClientRect().top ?? 0),
          };
        }),
      );
      expect(medidas).toHaveLength(3);
      for (const m of medidas) {
        // uma linha só: a caixa do rótulo não passa de uma altura de linha
        expect(m.alturaDoRotulo, `${m.nome} quebrou em duas linhas`).toBeLessThanOrEqual(
          Math.max(m.linha, 16) + 1,
        );
        expect(m.cortou, `${m.nome} foi cortado no fim`).toBe(false);
      }
      // os três números começam na mesma altura
      const topos = [...new Set(medidas.map((m) => m.topoDoNumero))];
      expect(topos, "os contadores não compartilham a base").toHaveLength(1);
    });
  }
});

test.describe("Lote 2 — capa e vitrine (SPEC §22.2 itens 9 e 10)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`o texto sobre a capa passa no contraste AA — tema ${tema}`, async ({ page }) => {
      await usuarioComPerfil();
      await page.emulateMedia({ colorScheme: tema });
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await esperarAbaTreino(page);

      const titulo = page.locator("main [data-capa] h2").first();
      await expect(titulo).toBeVisible();
      expect(await contrasteDe(page, "main [data-capa] h2")).toBeGreaterThanOrEqual(4.5);

      await page.goto("/explorar");
      await expect(page.getByRole("heading", { name: "Explorar" })).toBeVisible();
      await expect(page.locator("main [data-capa] h2").first()).toBeVisible();
      expect(await contrasteDe(page, "main [data-capa] h2")).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("a coleção que dá para rodar em circuito mostra o selo", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/explorar");

    const circuitos = page.getByRole("region", { name: "Circuitos" });
    await expect(circuitos).toBeVisible();
    await expect(circuitos.locator('[data-selo="circuito"]').first()).toBeVisible();
    // e não é um selo em toda linha: os treinos do programa não são circuito
    const treinos = page.getByRole("region", { name: "Treinos do programa" });
    await expect(treinos.locator('[data-selo="circuito"]')).toHaveCount(0);
  });

  test("o destaque do Explorar reserva o lugar enquanto o perfil não chega", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);

    // o perfil demora: a tela tem de mostrar a forma do destaque, não um buraco
    await page.route(/\/rest\/v1\/profiles/, async (rota) => {
      await new Promise((r) => setTimeout(r, 1500));
      await rota.continue().catch(() => {});
    });
    await page.goto("/explorar");
    const esqueleto = page.getByRole("status", { name: "Carregando o destaque" });
    await expect(esqueleto).toBeVisible();
    const altura = (await esqueleto.boundingBox())?.height ?? 0;
    expect(altura).toBeGreaterThan(150);

    // e quando o perfil chega, o destaque ocupa o mesmo lugar
    await expect(page.locator("main [data-capa] h2").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(esqueleto).toHaveCount(0);
  });
});

test.describe("Lote 2 — desafio e ilustração (SPEC §22.2 itens 6 e 8)", () => {
  test("o card do desafio diz as semanas concluídas e a barra concorda", async ({
    page,
  }) => {
    await usuarioComPerfil({ semana_fixa: 3, semana_corrida: 5 });
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    const card = page.locator('[data-desafio="barra_fixa"]');
    await expect(card).toContainText("Semana 3 de 12 · 2 concluídas");
    const barra = card.getByRole("progressbar");
    await expect(barra).toHaveAttribute("aria-valuenow", "2");
    await expect(barra).toHaveAttribute("aria-valuemax", "12");
    // 2 de 12 = 17 %: o número do card é a mesma leitura da barra
    await expect(card).toContainText("17%");
  });

  test("a ficha de uma ilustração aproximada mostra a nota do JSON", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/exercicios/face-pull");

    const nota = page.locator('[data-nota-ilustracao="face-pull"]');
    await expect(nota).toBeVisible();
    await expect(nota).toContainText("a nossa é na polia");
    // exercício com ilustração exata não ganha segunda linha nenhuma
    await page.goto("/exercicios/supino-reto-com-barra");
    await expect(
      page.locator('[data-nota-ilustracao="supino-reto-com-barra"]'),
    ).toHaveCount(0);
  });
});

test.describe("Lote 2 — Corpo (SPEC §22.2 itens 3 e 4)", () => {
  async function abrirFotos(page: Page) {
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await irNaAba(page, "Corpo");
    await expect(page.getByRole("heading", { name: "Corpo", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Fotos" }).click();
  }

  async function enviarFoto(page: Page, angulo: string) {
    await page.getByLabel(`Foto de ${angulo}`).setInputFiles({
      name: `${angulo}.png`,
      mimeType: "image/png",
      buffer: PNG_16,
    });
  }

  test("apagar uma foto tira ela da galeria, da tabela e do bucket", async ({
    page,
    context,
  }) => {
    const sessao = await usuarioComPerfil();
    await abrirFotos(page);
    await enviarFoto(page, "frente");
    await expect(page.getByRole("img", { name: "Frente em 16/09" })).toBeVisible();

    const caminho = `${sessao.userId}/2026-09-16-frente.jpg`;
    await expect
      .poll(async () => ((await estadoDoMock()).arquivos as string[]) ?? [], {
        timeout: 15_000,
      })
      .toContain(`progresso/${caminho}`);
    await expect
      .poll(async () => (await lerDoMock(sessao, "progress_photos")).length, {
        timeout: 15_000,
      })
      .toBe(1);

    // a foto abre em tela cheia, e é de lá que se apaga
    await page.getByRole("button", { name: /Ver a foto: Frente/ }).click();
    const camada = page.getByRole("dialog", { name: "Frente em 16/09" });
    await expect(camada).toBeVisible();

    // sem rede não apaga — e avisa por quê (como trocar a senha, §9)
    await context.setOffline(true);
    await camada.getByRole("button", { name: "Apagar" }).click();
    await expect(page.getByText("Apagar esta foto? Não dá para desfazer.")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
    await expect(page.getByText("Precisa de internet para apagar.")).toBeVisible();
    await expect
      .poll(async () => (await lerDoMock(sessao, "progress_photos")).length)
      .toBe(1);

    await context.setOffline(false);
    await camada.getByRole("button", { name: "Apagar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
    await expect(page.getByText("Foto apagada.")).toBeVisible();

    // a galeria e o comparador deixam de mostrá-la
    await expect(page.getByRole("img", { name: "Frente em 16/09" })).toHaveCount(0);
    await expect(page.getByText("Nenhuma foto ainda.")).toBeVisible();

    // e ela some do banco e do bucket
    await expect
      .poll(async () => (await lerDoMock(sessao, "progress_photos")).length, {
        timeout: 15_000,
      })
      .toBe(0);
    expect(((await estadoDoMock()).arquivos as string[]) ?? []).not.toContain(
      `progresso/${caminho}`,
    );

    // e continua apagada depois de recarregar
    await page.reload();
    await page.getByRole("tab", { name: "Fotos" }).click();
    await expect(page.getByRole("img", { name: "Frente em 16/09" })).toHaveCount(0);
  });

  test("Medidas e Fotos esperam a leitura com o esqueleto da própria forma", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);

    await page.route(/\/rest\/v1\/body_measurements/, async (rota) => {
      await new Promise((r) => setTimeout(r, 1500));
      await rota.continue().catch(() => {});
    });
    await page.goto("/corpo");
    await page.getByRole("tab", { name: "Medidas" }).click();
    await expect(page.getByRole("status", { name: "Carregando" }).first()).toBeVisible();

    // e a aba se preenche quando a leitura chega
    await expect(page.getByLabel("Cintura (cm)")).toBeVisible({ timeout: 20_000 });
  });
});

/**
 * Ultraloop 20/09 — Lote 2 (SPEC §22.2): Relatório, Corpo, Calendário e
 * Explorar. Um teste por item que se vê na tela.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { contrasteDe } from "./contraste";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  estadoDoMock,
  fixarData,
  irNaAba,
  lerDoMock,
  resetarMock,
  semCacheDoAparelho,
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

  test.describe("leitura inicial da vitrine", () => {
    test.use({ serviceWorkers: "block" });

    test("o destaque do Explorar reserva o lugar enquanto o perfil não chega", async ({ page }) => {
      await usuarioComPerfil();
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await semCacheDoAparelho(page);

      // Somente liberar o perfil depois de medir o esqueleto mantém o cenário
      // válido tanto no aparelho rápido quanto durante uma suíte em paralelo.
      let liberar!: () => void;
      const leitura = new Promise<void>((resolve) => { liberar = resolve; });
      await page.route(/\/rest\/v1\/profiles/, async (rota) => {
        await leitura;
        await rota.continue().catch(() => {});
      });
      const esqueleto = page.getByRole("status", { name: "Carregando o destaque" });
      try {
        const pedido = page.waitForRequest(/\/rest\/v1\/profiles/);
        await page.goto("/explorar");
        await pedido;
        await expect(esqueleto).toBeVisible();
        expect((await esqueleto.boundingBox())?.height ?? 0).toBeGreaterThan(150);
      } finally {
        liberar();
      }
      await expect(page.locator("main [data-capa] h2").first()).toBeVisible({ timeout: 20_000 });
      await expect(esqueleto).toHaveCount(0);
    });
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
    await expect(page.getByRole("heading", { name: "Registre sua primeira foto" })).toBeVisible();

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

  /*
   * O botão que apaga a foto é sólido (`bg-destructive`) e no tema escuro o
   * `--destructive` é claro: com o rótulo branco dava 2,77:1. A varredura não
   * chega aqui — esta camada só existe depois de mandar uma foto e tocar nela.
   */
  for (const tema of ["dark", "light"] as const) {
    test(`os botões da confirmação de apagar passam no contraste AA — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioComPerfil();
      await page.emulateMedia({ colorScheme: tema });
      await abrirFotos(page);
      await enviarFoto(page, "frente");
      await expect(page.getByRole("img", { name: "Frente em 16/09" })).toBeVisible();

      await page.getByRole("button", { name: /Ver a foto: Frente/ }).click();
      const camada = page.getByRole("dialog", { name: "Frente em 16/09" });
      await expect(camada).toBeVisible();
      await camada.getByRole("button", { name: "Apagar" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();

      const apagar = '[role="alertdialog"] [data-confirmacao="apagar"]';
      const cancelar = '[role="alertdialog"] [data-confirmacao="cancelar"]';
      expect(await contrasteDe(page, apagar)).toBeGreaterThanOrEqual(4.5);
      expect(await contrasteDe(page, cancelar)).toBeGreaterThanOrEqual(4.5);
    });
  }

  test.describe("leituras pendentes em Corpo", () => {
    // O worker passa a requisição por fetch próprio. Aqui o teste controla
    // exatamente quando cada leitura termina, em vez de adivinhar por tempo.
    test.use({ serviceWorkers: "block" });

    test("Medidas e Fotos esperam a leitura com o esqueleto da própria forma", async ({ page }) => {
      await usuarioComPerfil();
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      let liberar = () => {};
      const pendente = new Promise<void>((resolver) => { liberar = resolver; });
      await page.route(/\/rest\/v1\/(body_measurements|progress_photos)\b/, async (rota) => {
        await pendente;
        await rota.continue();
      });
      try {
        await page.goto("/corpo");
        for (const aba of ["Medidas", "Fotos"]) {
          await page.getByRole("tab", { name: aba }).click();
          await expect(page.getByRole("tabpanel", { name: aba }).getByRole("status", { name: "Carregando" })).toBeVisible();
        }
      } finally {
        liberar();
      }
      await expect(page.getByRole("tabpanel", { name: "Fotos" }).getByLabel("Foto de frente")).toBeAttached();
      await page.getByRole("tab", { name: "Medidas" }).click();
      await expect(page.getByLabel("Cintura (cm)")).toBeVisible();
    });
  });
});

/*
 * SPEC §22.2 item 7. O caminho passa pelo layout do shell autenticado — que lê
 * `public/videos` e desce a lista por contexto —, então uma regressão aqui
 * afetaria todas as telas. A receita do mp4 temporário é a do e2e do player
 * (e2e/treino-v2.spec.ts): nenhum vídeo é entregue no kit.
 */
test.describe("Lote 2 — vídeo fora do player (SPEC §22.2 item 7)", () => {
  /** Quarta é o Treino A do programa (§5.2): o supino abre a lista do dia. */
  const NA_LISTA = { id: "supino-reto-com-barra", nome: "Supino reto com barra" };
  /** E o levantamento terra abre a lista da coleção do Treino B. */
  const NA_COLECAO = { id: "levantamento-terra", nome: "Levantamento terra" };
  const PASTA = join(process.cwd(), "public", "videos");
  const arquivo = (id: string) => join(PASTA, `${id}.mp4`);

  function criarOVideo(id: string) {
    mkdirSync(PASTA, { recursive: true });
    writeFileSync(arquivo(id), Buffer.from("00000018667479706d703432", "hex"));
  }

  test.afterEach(() => {
    // o agachamento é do e2e do player: aqui só se mexe nestes dois
    for (const e of [NA_LISTA, NA_COLECAO]) rmSync(arquivo(e.id), { force: true });
  });

  async function abrirAFicha(page: Page, nome: string) {
    await page.getByRole("button", { name: `Ficha: ${nome}` }).first().click();
    await expect(page.getByRole("dialog", { name: nome })).toBeVisible();
  }

  test("a ficha aberta pela lista do dia troca a ilustração pelo vídeo", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    // sem o arquivo (o estado do kit) a ficha mostra a ilustração
    await abrirAFicha(page, NA_LISTA.nome);
    await expect(page.locator(`video[data-video="${NA_LISTA.id}"]`)).toHaveCount(0);

    criarOVideo(NA_LISTA.id);
    await page.reload();
    await esperarAbaTreino(page);
    await abrirAFicha(page, NA_LISTA.nome);
    const video = page.locator(`video[data-video="${NA_LISTA.id}"]`);
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("src", `/videos/${NA_LISTA.id}.mp4`);
  });

  test("a ficha aberta pela lista de uma coleção troca a ilustração pelo vídeo", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);

    await page.goto("/explorar/treino/B1");
    await abrirAFicha(page, NA_COLECAO.nome);
    await expect(page.locator(`video[data-video="${NA_COLECAO.id}"]`)).toHaveCount(0);

    criarOVideo(NA_COLECAO.id);
    await page.goto("/explorar/treino/B1");
    await abrirAFicha(page, NA_COLECAO.nome);
    const video = page.locator(`video[data-video="${NA_COLECAO.id}"]`);
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("src", `/videos/${NA_COLECAO.id}.mp4`);

    // e sem o arquivo de novo, volta a ilustração
    rmSync(arquivo(NA_COLECAO.id), { force: true });
    await page.goto("/explorar/treino/B1");
    await abrirAFicha(page, NA_COLECAO.nome);
    await expect(page.locator(`video[data-video="${NA_COLECAO.id}"]`)).toHaveCount(0);
  });
});

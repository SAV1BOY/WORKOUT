/**
 * Marco Guia de uso (SPEC §20): o tutorial da primeira entrada e o
 * "Como usar o app" da aba Mais.
 *
 * O que estes testes prendem:
 *  - conta nova (perfil sem `prefs.guia_visto`) cai no guia com "Pular por
 *    agora"; "Entendi, começar a treinar" grava a marca no banco e volta para
 *    a aba Treino; recarregar não redireciona mais;
 *  - Mais → "Como usar o app" abre o mesmo guia SEM "Pular por agora";
 *  - **todo** botão "Ir" leva a uma página existente — a lista sai de
 *    `lib/guia.ts`, não de uma cópia à mão;
 *  - o índice de chips rola até a seção;
 *  - a 360 px, nos dois temas, nada rola de lado e todo alvo tem 44 px.
 */
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { SECOES, hrefsDoGuia, rotaDoHref } from "../lib/guia";
import {
  EMAIL_DONO,
  SENHA,
  atualizarNoMock,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  irNaAba,
  lerDoMock,
  resetarMock,
  sessaoNoMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

const CAPTURAS =
  process.env.CAPTURAS_DIR ?? "test-results/capturas/guia";
mkdirSync(CAPTURAS, { recursive: true });

/**
 * O título esperado de cada rota para onde o guia manda. Tudo o que
 * `lib/guia.ts` aponta tem que estar aqui — um teste confere isso, então um
 * "Ir" novo sem destino conhecido quebra na hora.
 */
const TITULO_DA_ROTA: Record<string, string> = {
  "/": "", // a aba Treino: o h1 é a saudação com a data, conferida pela região
  "/explorar": "Explorar",
  "/relatorio": "Relatório",
  "/corpo": "Corpo",
  "/mais": "Mais",
  "/calendario": "Calendário",
  "/exercicios": "Exercícios",
  "/barra-fixa": "Barra fixa",
  "/mais/guia": "Como usar o app",
  "/mais/perfil": "Perfil",
  "/mais/equipamento": "Equipamento",
  "/mais/preferencias": "Preferências",
  "/mais/creditos": "Créditos",
  "/mais/backup": "Backup",
  "/mais/senha": "Trocar senha",
  // SPEC §21.3: só o dono vê o link, e os e2e do guia entram como o dono
  "/mais/contas": "Contas",
};

test.beforeEach(async () => {
  await resetarMock();
});

/** Um perfil de conta nova: como o banco cria, **sem** `prefs.guia_visto`. */
async function contaNova(): Promise<SessaoMock> {
  const sessao = await sessaoNoMock();
  await atualizarNoMock(sessao, "profiles", `user_id=eq.${sessao.userId}`, {
    nome: EMAIL_DONO.split("@")[0],
    altura_cm: 190,
    data_inicio: "2026-09-14",
    fase_atual: "fase1",
    fase_desde: "2026-09-14",
    // o default do schema.sql, sem a marca do guia
    prefs: {
      tema: "auto",
      descanso_som: true,
      descanso_vibra: true,
      manter_tela: true,
    },
  });
  return sessao;
}

/** Entra sem esperar a aba Treino (a conta nova é desviada para o guia). */
async function entrarSemEsperar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL_DONO);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** O que o app gravou em `profiles.prefs.guia_visto`. */
async function guiaVistoNoMock(sessao: SessaoMock): Promise<unknown> {
  const linhas = await lerDoMock<{ prefs?: { guia_visto?: unknown } }>(
    sessao,
    "profiles",
    `select=prefs&user_id=eq.${sessao.userId}`,
  );
  return linhas[0]?.prefs?.guia_visto;
}

test.describe("primeira entrada da conta (SPEC §20.1)", () => {
  test("cai no guia com “Pular por agora”, reconhece e não volta mais", async ({
    page,
  }) => {
    const sessao = await contaNova();
    await fixarData(page, QUARTA);
    await entrarSemEsperar(page);

    // 1. o desvio: /mais/guia?inicio=1, uma vez, sem laço
    await page.waitForURL(/\/mais\/guia\?inicio=1$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Como usar o app" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pular por agora" }),
    ).toBeVisible();
    // a barra das 5 abas continua lá: o guia não é tela cheia
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }),
    ).toBeVisible();
    await page.screenshot({
      path: `${CAPTURAS}/04-primeira-entrada.png`,
      fullPage: false,
    });

    // nada é gravado só por abrir
    expect(await guiaVistoNoMock(sessao)).toBeUndefined();

    // 2. o reconhecimento grava e volta para a aba Treino
    await page
      .getByRole("button", { name: "Entendi, começar a treinar" })
      .click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
    await esperarAbaTreino(page);
    await expect
      .poll(async () => guiaVistoNoMock(sessao), { timeout: 20_000 })
      .toBe(true);

    // 3. recarregar não desvia mais
    await page.goto("/");
    await esperarAbaTreino(page);
    await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible({
      timeout: 20_000,
    });
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("“Pular por agora” também grava e volta para a aba Treino", async ({
    page,
  }) => {
    const sessao = await contaNova();
    await fixarData(page, QUARTA);
    await entrarSemEsperar(page);
    await page.waitForURL(/\/mais\/guia\?inicio=1$/, { timeout: 20_000 });

    await page.getByRole("button", { name: "Pular por agora" }).click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
    await esperarAbaTreino(page);
    await expect
      .poll(async () => guiaVistoNoMock(sessao), { timeout: 20_000 })
      .toBe(true);
  });

  test("sair do guia por um “Ir” não deixa a aba Treino no esqueleto", async ({
    page,
  }) => {
    /*
     * O guia da primeira entrada tem "Ir" que voltam para `/` (o passo
     * "Começar o primeiro treino", a seção Treino, a miniatura da barra). O
     * desvio é uma vez por carregamento — e a aba Treino, que não desvia mais,
     * precisa DESENHAR: já ficou parada no esqueleto aqui.
     */
    await contaNova();
    await fixarData(page, QUARTA);
    await entrarSemEsperar(page);
    await page.waitForURL(/\/mais\/guia\?inicio=1$/, { timeout: 20_000 });

    await page.locator('a[data-ir="/"]').first().click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
    await esperarAbaTreino(page);
    await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible({
      timeout: 20_000,
    });
    // e continua sem a marca: o guia volta no próximo carregamento
    await page.goto("/");
    await page.waitForURL(/\/mais\/guia\?inicio=1$/, { timeout: 20_000 });
  });

  test("conta antiga (com a marca) entra direto na aba Treino", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible({
      timeout: 20_000,
    });
    expect(new URL(page.url()).pathname).toBe("/");
  });
});

test.describe("Mais → Como usar o app (SPEC §20.1)", () => {
  test("abre o guia sem “Pular por agora” e o botão do fim volta para Mais", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await irNaAba(page, "Mais");

    const linha = page.getByRole("link", { name: /Como usar o app/ });
    await expect(linha).toBeVisible();
    await linha.click();

    await page.waitForURL(/\/mais\/guia$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Como usar o app" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pular por agora" }),
    ).toHaveCount(0);

    await page.screenshot({
      path: `${CAPTURAS}/03-guia-mais.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: "Entendi", exact: true }).click();
    await page.waitForURL(/\/mais$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Mais" })).toBeVisible();
  });
});

test.describe("o conteúdo do guia (SPEC §20.4)", () => {
  test("mostra as nove seções, a miniatura da barra e os primeiros passos", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await page.emulateMedia({ colorScheme: "dark" });
    await entrarNoApp(page);
    await page.goto("/mais/guia");
    await expect(
      page.getByRole("heading", { level: 1, name: "Como usar o app" }),
    ).toBeVisible();

    for (const secao of SECOES) {
      await expect(
        page.getByRole("heading", { level: 2, name: secao.titulo, exact: true }),
        `seção ${secao.id}`,
      ).toBeVisible();
      await expect(page.locator(`[data-chip="${secao.id}"]`)).toHaveCount(1);
    }

    // os quatro primeiros passos, com as instruções de instalação
    await expect(page.getByText("Marcar os dias de treino")).toBeVisible();
    await expect(page.getByText("Instalar o app no celular")).toBeVisible();
    await expect(page.getByText(/Adicionar à Tela de Início/)).toBeVisible();

    await page.screenshot({
      path: `${CAPTURAS}/01-guia-topo.png`,
      fullPage: false,
    });

    // a miniatura da barra: os cinco rótulos da barra de baixo (SPEC §20.4)
    await page.locator('[data-chip="abas"]').click();
    await expect(page.locator("#abas")).toBeInViewport({ timeout: 10_000 });
    const miniatura = page.locator("[data-miniatura]");
    await expect(miniatura).toBeVisible();
    await expect(miniatura.locator("> span")).toHaveCount(5);

    // a seção Treino, com o caminho em chips de uma função de fluxo
    await page.locator('[data-chip="treino"]').click();
    await expect(page.locator("#treino")).toBeInViewport({ timeout: 10_000 });
    // o nome da função e, logo abaixo, o mesmo texto no chip do caminho
    await expect(page.getByText("Treinar mesmo assim").first()).toBeVisible();
    await page.screenshot({
      path: `${CAPTURAS}/02-guia-treino.png`,
      fullPage: false,
    });
  });

  test("o índice de chips rola até a seção", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/mais/guia");

    for (const id of ["calendario", "offline", "corpo"]) {
      await page.locator(`[data-chip="${id}"]`).click();
      await expect(page.locator(`#${id}`)).toBeInViewport({ timeout: 10_000 });
      expect(new URL(page.url()).hash).toBe(`#${id}`);
    }
  });
});

test.describe("todo “Ir” leva a uma tela que existe (SPEC §20.7)", () => {
  test("a tabela de destinos cobre todos os hrefs de lib/guia.ts", () => {
    for (const href of hrefsDoGuia()) {
      expect(
        Object.keys(TITULO_DA_ROTA),
        `destino sem título esperado: ${href}`,
      ).toContain(rotaDoHref(href));
    }
  });

  for (const href of hrefsDoGuia()) {
    const rota = rotaDoHref(href);
    test(`“Ir” para ${href} abre ${rota}`, async ({ page }) => {
      await usuarioComPerfil();
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await page.goto("/mais/guia");

      const botao = page.locator(`a[data-ir="${href}"]`).first();
      await expect(botao, `nenhum “Ir” para ${href}`).toBeVisible();
      await botao.click();

      await page.waitForURL(
        (url) => url.pathname === rota,
        { timeout: 20_000 },
      );

      const titulo = TITULO_DA_ROTA[rota]!;
      if (titulo === "") {
        await esperarAbaTreino(page);
      } else {
        await expect(
          page.getByRole("heading", { level: 1, name: titulo, exact: true }),
        ).toBeVisible({ timeout: 20_000 });
      }
    });
  }
});

test.describe("celular a 360 px, nos dois temas (SPEC §20.7)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`nada rola de lado e todo alvo tem 44 px — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioComPerfil();
      await fixarData(page, QUARTA);
      await page.emulateMedia({ colorScheme: tema });
      await entrarNoApp(page);
      await page.goto("/mais/guia");
      await expect(
        page.getByRole("heading", { level: 1, name: "Como usar o app" }),
      ).toBeVisible();
      await page.waitForTimeout(500);

      await semRolagemHorizontal(page);

      const pequenos = await page.evaluate(() => {
        const alvos = [
          ...document.querySelectorAll("main .alvo, main button, main a"),
        ];
        return alvos
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              texto: (el.textContent ?? "").trim().slice(0, 30),
              h: Math.round(r.height),
              w: Math.round(r.width),
            };
          })
          .filter((a) => a.w > 0 && a.h > 0 && (a.h < 44 || a.w < 44));
      });
      expect(pequenos, "alvos menores que 44 px").toEqual([]);

      if (tema === "light") {
        await page.screenshot({
          path: `${CAPTURAS}/01-guia-topo-claro.png`,
          fullPage: false,
        });
      }
    });
  }
});

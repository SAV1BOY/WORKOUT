/**
 * Ultraloop 20/09/2026 — faixa A, rodada 4, lote "aba Treino: hierarquia e
 * controle" (SPEC §22.7). O que se MEDE aqui: o "Substituir" que ninguém mais
 * cobre, a faixa fixa do dia depois de rolar, a folha "Ajustar" que grava
 * sozinha e abre sem teclado, os dois ladrilhos com a mesma gramática, o nome
 * do exercício em até duas linhas, o carrossel que diz onde está, o degradê das
 * fileiras de chips, os verbos com objeto e o aviso ao voltar do player.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  lerDoMock,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** 14/09/2026, a segunda que abre o programa: Treino A (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

test.beforeEach(async () => {
  await resetarMock();
});

async function abrirAbaTreino(page: Page) {
  const sessao = await usuarioComPerfil();
  await fixarData(page, SEGUNDA);
  await entrarNoApp(page);
  await esperarAbaTreino(page);
  return sessao;
}

/** O elemento que receberia o toque no centro de uma caixa. */
async function quemRecebeOToque(page: Page, caixa: { x: number; y: number; width: number; height: number }) {
  return page.evaluate(
    ({ x, y }) => {
      const alvo = document.elementFromPoint(x, y);
      const botao = alvo?.closest("button");
      return botao?.getAttribute("aria-label") ?? alvo?.tagName ?? null;
    },
    { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 },
  );
}

/* ------------------------------------------------- item 1: o FAB saiu do meio */

test("o toque em cada 'Substituir' chega no próprio botão (SPEC §22.7 item 1)", async ({
  page,
}) => {
  await abrirAbaTreino(page);

  // o "Ajustar" agora é do cabeçalho, ao lado da data — não flutua mais
  const ajustar = page.getByRole("button", { name: "Ajustar" });
  await expect(ajustar).toBeVisible();
  expect(await ajustar.evaluate((el) => getComputedStyle(el).position)).toBe("static");

  const substituir = page.getByRole("button", { name: /^Substituir / });
  const quantos = await substituir.count();
  expect(quantos).toBeGreaterThan(2);

  for (let i = 0; i < quantos; i++) {
    const botao = substituir.nth(i);
    const nome = await botao.getAttribute("aria-label");
    /* no meio da tela: é ali que o FAB cobria o botão, e é o pior caso */
    await botao.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const caixa = await botao.boundingBox();
    expect(caixa, `caixa do ${nome}`).not.toBeNull();
    expect(await quemRecebeOToque(page, caixa!), `quem recebe o toque no ${nome}`).toBe(
      nome,
    );
  }
});

test("a folha do 'Ajustar' abre com o foco no título, não no teclado (item 3)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  await page.getByRole("button", { name: "Ajustar" }).click();

  const folha = page.getByRole("dialog");
  await expect(folha.getByLabel("Preparação (s)")).toBeVisible();
  const focado = await page.evaluate(() => ({
    etiqueta: document.activeElement?.tagName ?? null,
    texto: document.activeElement?.textContent?.trim() ?? null,
  }));
  expect(focado.etiqueta).not.toBe("INPUT");
  expect(focado.texto).toBe("Ajustar");
});

/* --------------------------------------------- item 2: a faixa fixa do dia */

test("depois de rolar, a faixa fixa continua levando ao treino de hoje (item 2)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  const faixa = page.locator("[data-faixa-do-dia]");
  await expect(faixa).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(faixa).toBeVisible();
  await expect(faixa).toContainText("Treino A");

  const comecar = faixa.getByRole("button", { name: "Começar" });
  await expect(comecar).toBeVisible();
  const caixa = await comecar.boundingBox();
  expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);

  await comecar.click();
  await page.waitForURL(/\/treinar\/[0-9a-f-]+$/);
});

test("com a sessão aberta, a faixa fixa diz o progresso e continua (item 2)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  await comecarOTreinoDoDia(page);
  await page.goBack();
  await esperarAbaTreino(page);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const faixa = page.locator("[data-faixa-do-dia]");
  await expect(faixa).toContainText("Treino A");
  await expect(faixa).toContainText("séries");
  await expect(faixa.getByRole("link", { name: "Continuar" })).toHaveAttribute(
    "href",
    /\/treinar\/[0-9a-f-]+$/,
  );
});

/* ------------------------------------------ item 9: voltar do player avisa */

test("voltar do player avisa em pt-BR e destaca o card do dia (item 9)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  await comecarOTreinoDoDia(page);
  await page.goBack();
  await esperarAbaTreino(page);

  await expect(
    page.getByText("Treino guardado — toque em Continuar para retomar."),
  ).toBeVisible();
  await expect(page.getByText("em andamento").first()).toBeVisible();
});

/* --------------------------------------------- item 3: a folha grava sozinha */

test("os dois campos do 'Ajustar' gravam sozinhos, sem botão Salvar (item 3)", async ({
  page,
}) => {
  const sessao = await abrirAbaTreino(page);
  await page.getByRole("button", { name: "Ajustar" }).click();
  const folha = page.getByRole("dialog");

  await expect(folha.getByRole("button", { name: /^Salvar/ })).toHaveCount(0);
  await expect(folha.getByLabel("Descanso padrão (s)")).toHaveAttribute(
    "placeholder",
    "—",
  );
  await expect(folha.getByText("Nenhum por enquanto.")).toBeVisible();

  await folha.getByLabel("Descanso padrão (s)").fill("75");
  await folha.getByLabel("Descanso padrão (s)").blur();
  await expect
    .poll(async () => {
      const perfis = await lerDoMock<{ prefs: Record<string, unknown> }>(
        sessao,
        "profiles",
      );
      return perfis[0]?.prefs?.descanso_padrao_s;
    })
    .toBe(75);
});

/* ------------------------------------------------- item 4: os dois ladrilhos */

test("os ladrilhos Fase e Peso têm a mesma altura e a mesma base (item 4)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  const fase = page.locator('[data-ladrilho="Fase"]');
  const peso = page.locator('[data-ladrilho="Peso"]');
  await expect(fase).toBeVisible();
  await expect(peso).toBeVisible();

  const caixaFase = await fase.boundingBox();
  const caixaPeso = await peso.boundingBox();
  expect(Math.abs((caixaFase?.height ?? 0) - (caixaPeso?.height ?? 1))).toBeLessThanOrEqual(1);

  // o valor de cada ladrilho é a segunda linha, e as duas caem na mesma base
  const bases = await page.evaluate(() => {
    const ler = (rotulo: string) => {
      const caixa = document.querySelector(`[data-ladrilho="${rotulo}"]`);
      const valor = caixa?.children[1] as HTMLElement | undefined;
      return valor ? Math.round(valor.getBoundingClientRect().bottom) : null;
    };
    return { fase: ler("Fase"), peso: ler("Peso") };
  });
  expect(bases.fase).not.toBeNull();
  expect(bases.fase).toBe(bases.peso);
  await expect(fase).toContainText("semana");
});

/* ------------------------------------ item 5: o nome cabe em até duas linhas */

test("nenhum nome de exercício passa de duas linhas a 360 px (item 5)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  const linhas = await page.evaluate(() => {
    const lista = document.querySelector('ul[aria-label="Exercícios de hoje"]');
    if (!lista) return null;
    return [...lista.querySelectorAll("li > button > span > span:first-child")].map(
      (el) => {
        const alturaDaLinha = parseFloat(getComputedStyle(el).lineHeight);
        const altura = el.getBoundingClientRect().height;
        return { texto: el.textContent ?? "", linhas: Math.round(altura / alturaDaLinha) };
      },
    );
  });
  expect(linhas).not.toBeNull();
  expect(linhas!.length).toBeGreaterThan(2);
  for (const linha of linhas!) {
    expect(linha.linhas, `"${linha.texto}" passou de duas linhas`).toBeLessThanOrEqual(
      2,
    );
  }
});

/* ------------------------------------------------ item 6: o carrossel conta */

test("o carrossel de Desafios diz a posição e alinha os CTAs (item 6)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  const desafios = page.getByRole("region", { name: "Desafios" });
  await expect(desafios.locator("[data-desafios-posicao]")).toHaveText("1 de 3");
  await expect(desafios.locator('[data-ponto="ativo"]')).toHaveCount(1);
  await expect(desafios.getByRole("list", { name: "Desafios" })).toBeVisible();
  await expect(
    desafios.getByRole("link", { name: "Fazer a sessão de barra fixa" }),
  ).toBeVisible();

  // todos os CTAs na mesma altura dentro do próprio card
  const distancias = await desafios.evaluate((secao) => {
    return [...secao.querySelectorAll("li[data-desafio]")].map((li) => {
      const cartao = li.getBoundingClientRect();
      const cta = li.querySelector("a")?.getBoundingClientRect();
      return cta ? Math.round(cartao.bottom - cta.bottom) : null;
    });
  });
  expect(new Set(distancias).size, `CTAs em alturas diferentes: ${distancias}`).toBe(1);
});

/* ------------------------------------------ item 7: o degradê dos chips */

test("as duas fileiras de chips avisam que há mais fora da tela (item 7)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  for (const nome of ["Grupos", "Filtros"]) {
    const fileira = page.getByRole("list", { name: nome });
    const medida = await fileira.evaluate((el) => ({
      sobra: el.scrollWidth - el.clientWidth,
      mascara: getComputedStyle(el).maskImage,
    }));
    expect(medida.sobra, `${nome}: nada fora da tela`).toBeGreaterThan(0);
    expect(medida.mascara, `${nome}: sem degradê na borda`).toContain("linear-gradient");
  }
});

/* --------------------------------------------- item 8: verbo com objeto */

test("nenhum botão de começar cola o nome no verbo (item 8)", async ({ page }) => {
  await abrirAbaTreino(page);
  await expect(
    page.getByRole("button", { name: "Começar o treino de peito" }),
  ).toBeVisible();

  const colados = await page.evaluate(() =>
    [...document.querySelectorAll("button, a")]
      .map((el) => (el.textContent ?? "").trim())
      .filter((t) => /^Começar [A-Z]/.test(t)),
  );
  expect(colados, `verbo colado no nome: ${colados.join(" | ")}`).toEqual([]);
});

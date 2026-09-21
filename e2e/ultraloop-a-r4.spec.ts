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
async function quemRecebeOToque(
  page: Page,
  caixa: { x: number; y: number; width: number; height: number },
) {
  return page.evaluate(
    ({ x, y }) => {
      const alvo = document.elementFromPoint(x, y);
      const botao = alvo?.closest("button");
      return botao?.getAttribute("aria-label") ?? alvo?.tagName ?? null;
    },
    { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 },
  );
}

/**
 * Quem está com o anel de destaque (`ring-2`) e se esse alguém tem o botão
 * "Continuar". A espera roda DENTRO da página porque o destaque dura 4 s: uma
 * ida e volta por chamada de Playwright gastaria metade da janela.
 */
async function quemEstaComAnel(page: Page) {
  return page.evaluate(async () => {
    const ler = () =>
      [...document.querySelectorAll(".ring-2")].map((el) => ({
        rotulo:
          el.getAttribute("aria-label") ??
          el.getAttribute("data-capa") ??
          el.tagName,
        temContinuar: (el.textContent ?? "").includes("Continuar"),
      }));
    const limite = Date.now() + 5_000;
    let anelados = ler();
    while (anelados.length === 0 && Date.now() < limite) {
      await new Promise((pronto) => setTimeout(pronto, 50));
      anelados = ler();
    }
    return anelados;
  });
}

/* ------------------------------------------------- item 1: o FAB saiu do meio */

test("o toque em cada 'Substituir' chega no próprio botão (SPEC §22.7 item 1)", async ({
  page,
}) => {
  await abrirAbaTreino(page);

  // o "Ajustar" agora é do cabeçalho, ao lado da data — não flutua mais
  const ajustar = page.getByRole("button", { name: "Ajustar" });
  await expect(ajustar).toBeVisible();
  expect(await ajustar.evaluate((el) => getComputedStyle(el).position)).toBe(
    "static",
  );

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
    expect(
      await quemRecebeOToque(page, caixa!),
      `quem recebe o toque no ${nome}`,
    ).toBe(nome);
  }

  /*
   * E também com a FAIXA FIXA DO DIA por cima (§22.7 item 2): centralizar o
   * botão antes de medir esconde o defeito, porque no meio da tela nada o
   * cobre. Aqui a aba desce de 40 em 40 px — como o dedo faz — e em toda
   * parada todo "Substituir"/"Ficha" FORA do retângulo da faixa tem de
   * receber o próprio toque. O que fica DEBAIXO da faixa é dela enquanto
   * está ali (o aceite do item 2, fixado no caso da varredura da faixa):
   * um dedo de rolagem devolve a linha.
   */
  const varredura = await page.evaluate(async () => {
    const esperar = (ms: number) =>
      new Promise((pronto) => setTimeout(pronto, ms));
    const perdidos: { y: number; rotulo: string; porQuem: string }[] = [];
    let passosComFaixa = 0;
    const fim = document.documentElement.scrollHeight;
    for (let y = 400; y <= fim; y += 40) {
      window.scrollTo(0, y);
      /* a sentinela decide a faixa por IntersectionObserver, entre os passos */
      await esperar(80);
      const faixa = document.querySelector("[data-faixa-do-dia] aside");
      if (!faixa) continue;
      passosComFaixa += 1;
      const caixaDaFaixa = faixa.getBoundingClientRect();
      const alvos = document.querySelectorAll<HTMLElement>(
        'button[aria-label^="Substituir "], button[aria-label^="Ficha: "]',
      );
      for (const alvo of alvos) {
        const r = alvo.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        /* só o que está inteiro na tela */
        if (r.top < 0 || r.bottom > window.innerHeight) continue;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        /* debaixo da faixa os pixels são da faixa — e só enquanto ela está lá */
        if (cy <= caixaDaFaixa.bottom) continue;
        const quem = document.elementFromPoint(cx, cy);
        if (quem?.closest("button, a") === alvo) continue;
        perdidos.push({
          y,
          rotulo: alvo.getAttribute("aria-label") ?? "",
          porQuem: quem?.tagName ?? "nulo",
        });
      }
    }
    window.scrollTo(0, 0);
    return { passosComFaixa, perdidos };
  });

  expect(
    varredura.passosComFaixa,
    "paradas com a faixa fixa à vista",
  ).toBeGreaterThan(5);
  expect(
    varredura.perdidos,
    "alvos fora da faixa que perderam o toque",
  ).toEqual([]);
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

test("nenhum toque na faixa fixa atravessa para a lista de baixo (item 2)", async ({
  page,
}) => {
  /*
   * A faixa é um cartão OPACO por cima da lista, com o nome do treino escrito
   * nele: cada pixel dela tem de ser dela. A tentativa de deixá-la inerte
   * (`pointer-events-none`) devolvia esses pixels para o que estava escondido
   * embaixo — tocar em "Treino A · …" abria a ficha de um exercício invisível,
   * e podia cair até no "Começar o treino de <grupo>", que cria uma sessão.
   * Esta é a varredura do aceite (§22.7 item 2): de 24 em 24 px na largura da
   * faixa, a cada 60 px de rolagem, em três alturas dela.
   */
  await abrirAbaTreino(page);

  const varredura = await page.evaluate(async () => {
    const esperar = (ms: number) =>
      new Promise((pronto) => setTimeout(pronto, ms));
    const fugas: { y: number; px: number; recebe: string }[] = [];
    let pontos = 0;
    let paradas = 0;
    const fim = document.documentElement.scrollHeight;
    for (let y = 200; y <= fim; y += 60) {
      window.scrollTo(0, y);
      /* a sentinela decide a faixa por IntersectionObserver, entre os passos */
      await esperar(80);
      const faixa = document.querySelector("[data-faixa-do-dia] aside");
      if (!faixa) continue;
      paradas += 1;
      const r = faixa.getBoundingClientRect();
      for (const cy of [r.top + 4, r.top + r.height / 2, r.bottom - 4]) {
        for (let px = 8; px < r.width; px += 24) {
          pontos += 1;
          const quem = document.elementFromPoint(r.left + px, cy);
          if (quem && faixa.contains(quem)) continue;
          const ctrl = quem?.closest("button, a");
          fugas.push({
            y,
            px: Math.round(px),
            recebe: ctrl
              ? `${ctrl.tagName}[${ctrl.getAttribute("aria-label") ?? (ctrl.textContent ?? "").trim().slice(0, 28)}]`
              : (quem?.tagName ?? "nulo"),
          });
        }
      }
    }
    window.scrollTo(0, 0);
    return { paradas, pontos, fugas: fugas.slice(0, 20), total: fugas.length };
  });

  expect(varredura.paradas, "paradas com a faixa fixa à vista").toBeGreaterThan(
    5,
  );
  expect(varredura.pontos, "pontos varridos na faixa").toBeGreaterThan(200);
  expect(varredura.fugas, "toques na faixa que caíram fora dela").toEqual([]);
  expect(varredura.total).toBe(0);
});

test("a faixa fixa inteira é o controle anunciado (item 2)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const faixa = page.locator("[data-faixa-do-dia] aside");
  await expect(faixa).toBeVisible();

  /* o controle ocupa a faixa toda, e o nome dele diz o verbo e o treino */
  const medida = await faixa.evaluate((el) => {
    const ctrl = el.querySelector("a, button") as HTMLElement | null;
    if (!ctrl) return null;
    const a = el.getBoundingClientRect();
    const b = ctrl.getBoundingClientRect();
    return {
      nome: ctrl.getAttribute("aria-label"),
      sobra: Math.round(a.width - b.width),
      altura: Math.round(b.height),
      controles: el.querySelectorAll("a, button").length,
    };
  });
  expect(medida?.controles, "um único controle na faixa").toBe(1);
  expect(
    medida?.sobra,
    "o controle ocupa a largura da faixa",
  ).toBeLessThanOrEqual(1);
  expect(medida?.altura ?? 0).toBeGreaterThanOrEqual(44);
  expect(medida?.nome).toMatch(/^Começar — Treino A/);

  /* e o toque no NOME do treino, longe do botão, começa o treino */
  await faixa.getByText("Treino A").click();
  await page.waitForURL(/\/treinar\/[0-9a-f-]+$/);
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

  // a sessão aberta É a do dia: o anel fica no card "em andamento", que é
  // quem tem o "Continuar" — e em mais ninguém
  expect(await quemEstaComAnel(page)).toEqual([
    { rotulo: "Treino A", temContinuar: true },
  ]);
});

test("voltar de uma sessão livre destaca o banner, que é quem tem o 'Continuar' (item 9)", async ({
  page,
}) => {
  await abrirAbaTreino(page);

  /*
   * A sessão da "Parte do corpo em foco" nasce com `workout_id = 'livre'`:
   * NÃO é o treino do dia, então o "Continuar" dela está no banner "Você tem
   * um treino aberto de …" e o card do dia continua sendo "Começar treino".
   */
  await page.getByRole("button", { name: /^Começar o treino de / }).click();
  await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
  await page.goBack();
  await esperarAbaTreino(page);

  await expect(
    page.getByText("Treino guardado — toque em Continuar para retomar."),
  ).toBeVisible();

  const banner = page.getByRole("region", { name: "Treino aberto" });
  await expect(banner.getByRole("link", { name: "Continuar" })).toBeVisible();
  // o card do dia segue oferecendo um treino NOVO: não é ele que o aviso pede
  await expect(
    page.getByRole("button", { name: "Começar treino" }),
  ).toBeVisible();

  // e o anel cai no banner, nunca no card que começaria uma segunda sessão
  expect(await quemEstaComAnel(page)).toEqual([
    { rotulo: "Treino aberto", temContinuar: true },
  ]);
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
  expect(
    Math.abs((caixaFase?.height ?? 0) - (caixaPeso?.height ?? 1)),
  ).toBeLessThanOrEqual(1);

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
    return [
      ...lista.querySelectorAll("li > button > span > span:first-child"),
    ].map((el) => {
      const alturaDaLinha = parseFloat(getComputedStyle(el).lineHeight);
      const altura = el.getBoundingClientRect().height;
      return {
        texto: el.textContent ?? "",
        linhas: Math.round(altura / alturaDaLinha),
      };
    });
  });
  expect(linhas).not.toBeNull();
  expect(linhas!.length).toBeGreaterThan(2);
  for (const linha of linhas!) {
    expect(
      linha.linhas,
      `"${linha.texto}" passou de duas linhas`,
    ).toBeLessThanOrEqual(2);
  }
});

/* ------------------------------------------------ item 6: o carrossel conta */

test("o carrossel de Desafios diz a posição e alinha os CTAs (item 6)", async ({
  page,
}) => {
  await abrirAbaTreino(page);
  const desafios = page.getByRole("region", { name: "Desafios" });
  await expect(desafios.locator("[data-desafios-posicao]")).toHaveText(
    "1 de 3",
  );
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
  expect(
    new Set(distancias).size,
    `CTAs em alturas diferentes: ${distancias}`,
  ).toBe(1);
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
    expect(medida.mascara, `${nome}: sem degradê na borda`).toContain(
      "linear-gradient",
    );
  }
});

/* --------------------------------------------- item 8: verbo com objeto */

test("nenhum botão de começar cola o nome no verbo (item 8)", async ({
  page,
}) => {
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

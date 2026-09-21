/**
 * Ultraloop, rodada 5, lote 8 (faixa C) — Calendário e faixa da semana
 * (SPEC §22.8). Cada teste fecha um item do lote e leva o número dele no
 * nome; o que se mede é o desenho e a geometria, não só o texto.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarRelogio,
  inserirNoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Quarta, 16/09/2026: a semana 1 da fase já tem passado, hoje e futuro. */
const QUARTA = "2026-09-16T08:00:00-03:00";

/** 200 % de zoom num celular de 360 px: 180 px de largura efetiva. */
const ZOOM_200 = { width: 180, height: 740 };

async function abrirCalendario(page: Page): Promise<void> {
  await fixarRelogio(page, QUARTA);
  await entrarNoApp(page);
  await page.goto("/calendario");
  await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
}

function mesDe(page: Page, nome: string) {
  return page.getByRole("region", { name: `Mês de ${nome}` });
}

test.beforeEach(async () => {
  await resetarMock();
});

/* ------------------------------------------------------------------ item 1 */

test("§22.8-1: passada a semana 12, a Fase 1 não mostra “16 de 12”", async ({
  page,
}) => {
  // 01/06 é uma segunda: 15 semanas inteiras até a semana de 14/09 → semana 16
  await usuarioComPerfil({ fase_desde: "2026-06-01", data_inicio: "2026-06-01" });
  await abrirCalendario(page);

  await expect(page.getByText("Fase 1 · 12 de 12 concluída")).toBeVisible();
  await expect(page.getByText(/de 12/)).toHaveCount(1);

  /* nenhum "N de M" da tela pode ter N > M */
  const fracoes = await page.evaluate(() =>
    [...(document.body.innerText ?? "").matchAll(/(\d+)\s+de\s+(\d+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]),
  );
  expect(fracoes.length).toBeGreaterThan(0);
  for (const [n, m] of fracoes) expect(n, `“${n} de ${m}”`).toBeLessThanOrEqual(m ?? 0);

  /* e a tela oferece a saída em vez de continuar contando */
  await expect(page.getByRole("link", { name: "Passar para a Fase 2" })).toHaveAttribute(
    "href",
    "/mais/perfil",
  );
});

test("§22.8-1: até a semana 12 a contagem segue igual", async ({ page }) => {
  await usuarioComPerfil();
  await abrirCalendario(page);
  await expect(page.getByText("Fase 1 · semana 1 de 12")).toBeVisible();
  await expect(page.getByRole("link", { name: "Passar para a Fase 2" })).toHaveCount(0);
});

/* ------------------------------------------------------------------ item 2 */

test("§22.8-2: tocar num dia do mês abre o mesmo diálogo do cartão da semana", async ({
  page,
}) => {
  await usuarioComPerfil();
  await abrirCalendario(page);

  const setembro = mesDe(page, "setembro de 2026");
  await setembro.getByRole("button", { name: /^18\/09/ }).click();

  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText("18 de setembro de 2026");
  // é o MESMO diálogo do cartão da semana: o formulário de troca vem junto
  await expect(dialogo.getByRole("button", { name: "Salvar a troca" })).toBeVisible();
  await dialogo.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // e o mês tem as setas que o título prometia
  await page.getByRole("button", { name: "Mês anterior" }).click();
  await expect(mesDe(page, "agosto de 2026")).toBeVisible();
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await expect(mesDe(page, "setembro de 2026")).toBeVisible();
});

/* ------------------------------------------------------------------ item 3 */

test("§22.8-3: a 200 % de zoom a faixa rola em vez de empurrar a página", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarRelogio(page, QUARTA);
  await entrarNoApp(page);
  await esperarAbaTreino(page);

  await page.setViewportSize(ZOOM_200);
  await esperarAbaTreino(page);

  /*
   * A régua do `main`: o que a faixa fazia era vazar 264 px numa caixa de
   * 180. Duas coisas PRESAS na tela (`position: fixed`) ainda passam dessa
   * largura e não são deste lote — a barra de 5 abas do rodapé
   * (`components/nav-inferior.tsx`) e o botão flutuante da aba Treino —, as
   * duas registradas na fila da rodada. Por isso a conta do `/` é sobre o
   * conteúdo que ROLA, não sobre o `documentElement`.
   */
  const vazam = async () =>
    page.evaluate(() => {
      const largura = document.documentElement.clientWidth;
      const rola = (el: Element) => {
        const e = getComputedStyle(el);
        return e.overflowX === "auto" || e.overflowX === "scroll";
      };
      const dentroDeQuemRola = (el: Element) => {
        let atual: Element | null = el.parentElement;
        while (atual && atual !== document.documentElement) {
          if (rola(atual)) return true;
          atual = atual.parentElement;
        }
        return false;
      };
      return [...document.querySelectorAll("main *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return (
            r.width > 0 &&
            r.height > 0 &&
            cs.visibility !== "hidden" &&
            cs.display !== "none" &&
            cs.position !== "fixed" &&
            !rola(el) &&
            !dentroDeQuemRola(el) &&
            (Math.round(r.right) > largura + 1 || Math.round(r.left) < -1)
          );
        })
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`);
    });

  expect(await vazam(), "conteúdo de / vazando a 180 px").toEqual([]);

  /* quem rola é a FAIXA, não a página */
  const faixa = page.locator("ol").filter({ has: page.locator("[data-dia]") }).first();
  const medida = await faixa.evaluate((el) => ({
    rola: getComputedStyle(el).overflowX,
    conteudo: Math.round(el.scrollWidth),
    caixa: Math.round(el.clientWidth),
  }));
  expect(medida.rola).toBe("auto");
  expect(medida.conteudo).toBeGreaterThan(medida.caixa);

  /* no Calendário nem a página rola: 180 px de conteúdo em 180 px de tela */
  await page.goto("/calendario");
  await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
  await semRolagemHorizontal(page);
  expect(await vazam(), "conteúdo de /calendario vazando a 180 px").toEqual([]);

  /* e a 360 px a faixa continua inteira, sem rolagem nenhuma */
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await esperarAbaTreino(page);
  const largura = await faixa.evaluate((el) => ({
    conteudo: Math.round(el.scrollWidth),
    caixa: Math.round(el.clientWidth),
  }));
  expect(largura.conteudo).toBeLessThanOrEqual(largura.caixa);
  await semRolagemHorizontal(page);
});

/* ------------------------------------------------------------------ item 4 */

test("§22.8-4: os sete marcadores da faixa têm a mesma caixa e a mesma linha de base", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await inserirNoMock(sessao, "sessions", [
    { data: "2026-09-14", workout_id: "A1", fase: "fase1", status: "concluida" },
  ]);
  await fixarRelogio(page, QUARTA);
  await entrarNoApp(page);
  await esperarAbaTreino(page);

  const caixas = await page
    .locator("[data-dia] [data-glifo]")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          glifo: (el as HTMLElement).dataset.glifo ?? "",
          largura: Math.round(r.width),
          altura: Math.round(r.height),
          topo: Math.round(r.top),
        };
      }),
    );

  expect(caixas).toHaveLength(7);
  // a semana da quarta tem feito, faltou, aberto e descanso: nenhum é igual
  expect(new Set(caixas.map((c) => c.glifo)).size).toBeGreaterThan(2);
  for (const c of caixas) {
    expect(c.largura, `caixa de “${c.glifo}”`).toBe(20);
    expect(c.altura, `caixa de “${c.glifo}”`).toBe(20);
    expect(c.topo, `linha de base de “${c.glifo}”`).toBe(caixas[0]?.topo);
  }
});

/* ------------------------------------------------------------------ item 5 */

test("§22.8-5: o dia de hoje do mês se anuncia como “hoje”, não só por cor", async ({
  page,
}) => {
  await usuarioComPerfil();
  await abrirCalendario(page);

  const hoje = mesDe(page, "setembro de 2026").getByRole("button", { name: /^16\/09/ });
  await expect(hoje).toHaveAttribute("aria-current", "date");
  await expect(hoje).toHaveAccessibleName(/hoje/);
  // e é o único do mês
  await expect(
    mesDe(page, "setembro de 2026").locator('[aria-current="date"]'),
  ).toHaveCount(1);
});

/* ------------------------------------------------------------------ item 6 */

test("§22.8-6: a grade do mês tem legenda e separa feito de planejado pela forma", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await inserirNoMock(sessao, "sessions", [
    { data: "2026-09-14", workout_id: "A1", fase: "fase1", status: "concluida" },
  ]);
  await abrirCalendario(page);

  const setembro = mesDe(page, "setembro de 2026");
  // o glifo de "perdido" é um ✕ de texto dentro do próprio item: sem `exact`
  for (const texto of ["feito", "parcial", "força a fazer", "cardio a fazer", "perdido"]) {
    await expect(setembro.getByText(texto).last()).toBeVisible();
  }

  const desenho = (nome: RegExp) =>
    setembro
      .getByRole("button", { name: nome })
      .locator("span > span")
      .last()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          borda: Math.round(Number.parseFloat(cs.borderTopWidth)),
          fundo: cs.backgroundColor,
        };
      });

  /* 14/09 feito: disco CHEIO; 18/09 planejado: ANEL — a forma já distingue */
  const feito = await desenho(/^14\/09/);
  expect(feito.borda).toBe(0);
  expect(feito.fundo).not.toBe("rgba(0, 0, 0, 0)");

  const planejado = await desenho(/^18\/09/);
  expect(planejado.borda).toBeGreaterThan(0);
  expect(planejado.fundo).toBe("rgba(0, 0, 0, 0)");
});

/* ------------------------------------------------------------------ item 7 */

test("§22.8-7: a semana sem perdidos não escreve “perdidos”", async ({ page }) => {
  await usuarioComPerfil();
  await abrirCalendario(page);

  const contagem = page.getByText(/^\d+ feitos? · \d+ a fazer/);
  // quarta: a segunda e a terça passaram sem sessão
  await expect(contagem).toHaveText("0 feitos · 3 a fazer · 2 perdidos");

  // a semana que ainda não começou não tem o que perder
  await page.getByRole("button", { name: "Próxima semana" }).click();
  await expect(contagem).toHaveText("0 feitos · 5 a fazer");

  /* e a barra dos três segmentos está logo acima da contagem */
  const barra = page.locator("span.bg-muted.h-2");
  const caixas = await barra.evaluate((el) => ({
    segmentos: el.children.length,
    altura: Math.round(el.getBoundingClientRect().height),
  }));
  expect(caixas.segmentos).toBe(1); // só "a fazer" tem quantidade
  expect(caixas.altura).toBe(8);
});

/* ----------------------------------------------------------------- item 11 */

/*
 * O perfil padrão começou na segunda 14/09 e hoje é quarta 16/09: antes da
 * correção o mês de setembro tinha DEZ ✕ vermelhos em dias anteriores ao
 * começo do programa (31/08, 01, 02, 04, 05, 07, 08, 09, 11 e 12/09), com o
 * nome acessível dizendo "faltou" em cada um.
 */
test("§22.8-11: nada é “perdido” antes do começo do programa", async ({ page }) => {
  await usuarioComPerfil();
  await abrirCalendario(page);

  const setembro = mesDe(page, "setembro de 2026");
  const perdidos = setembro.locator('[aria-label*="faltou"]');
  /* só os dois dias planejados que já venceram DEPOIS do começo */
  await expect(perdidos).toHaveCount(2);
  await expect(perdidos.nth(0)).toHaveAccessibleName("14/09: faltou");
  await expect(perdidos.nth(1)).toHaveAccessibleName("15/09: faltou");

  /* o dia anterior ao começo se anuncia pelo que é, e não desenha nada */
  const antes = setembro.getByRole("button", { name: /^05\/09/ });
  await expect(antes).toHaveAccessibleName("05/09: antes do começo");
  await expect(antes).not.toContainText("✕");
  expect(await antes.locator("span > span").count()).toBe(0);

  /* nem a semana anterior ao começo: sem marca e sem contagem de perdidos */
  await page.getByRole("button", { name: "Semana anterior" }).click();
  await expect(page.getByText("07/09 – 13/09")).toBeVisible();
  /* a contagem da semana some por inteiro — a legenda do MÊS, que explica o
     ✕, continua escrita ali embaixo e não fala desta semana */
  await expect(page.getByText(/^\d+ feitos? · \d+ a fazer/)).toHaveCount(0);
  const semana = page.getByRole("list", { name: "Semana" });
  await expect(semana.locator('[aria-label*="faltou"]')).toHaveCount(0);
  await expect(semana.getByRole("button")).toHaveCount(7);
});

/* ------------------------------------------------------------------ item 8 */

test("§22.8-8: o intervalo da semana fica entre as setas e “Hoje” só volta quando sai", async ({
  page,
}) => {
  await usuarioComPerfil();
  await abrirCalendario(page);

  const anterior = page.getByRole("button", { name: "Semana anterior" });
  const proxima = page.getByRole("button", { name: "Próxima semana" });
  const intervalo = page.getByText("14/09 – 20/09");
  await expect(intervalo).toBeVisible();

  const [a, i, p] = await Promise.all([
    anterior.boundingBox(),
    intervalo.boundingBox(),
    proxima.boundingBox(),
  ]);
  expect(i?.x ?? 0).toBeGreaterThan((a?.x ?? 0) + (a?.width ?? 0) - 1);
  expect((i?.x ?? 0) + (i?.width ?? 0)).toBeLessThanOrEqual((p?.x ?? 0) + 1);

  /* na semana atual o "Hoje" não tem para onde levar */
  const hoje = page.getByRole("button", { name: "Hoje", exact: true });
  await expect(hoje).toHaveCount(0);
  await proxima.click();
  await expect(page.getByText("21/09 – 27/09")).toBeVisible();
  await expect(hoje).toBeVisible();
  await hoje.click();
  await expect(page.getByText("14/09 – 20/09")).toBeVisible();
  await expect(hoje).toHaveCount(0);
});

/* ------------------------------------------------------------------ item 9 */

test("§22.8-9: “Não vou treinar hoje” está presa ao dia que ela altera", async ({
  page,
}) => {
  await usuarioComPerfil();
  await abrirCalendario(page);

  const acao = page.getByRole("button", { name: "Não vou treinar hoje" });
  await expect(acao).toBeVisible();
  const bloco = page.locator("div", { has: acao }).last();
  await expect(bloco).toContainText("Se hoje (16/09) não rolar");
  // o divisor que separa a ação do resto da tela
  const borda = await bloco.evaluate((el) =>
    Math.round(Number.parseFloat(getComputedStyle(el).borderTopWidth)),
  );
  expect(borda).toBeGreaterThan(0);
});

/* ----------------------------------------------------------------- item 10 */

test("§22.8-10: os sete cartões da semana têm a mesma altura e o mês é um título", async ({
  page,
}) => {
  await usuarioComPerfil();
  await abrirCalendario(page);

  const alturas = await page
    .getByRole("list", { name: "Semana" })
    .getByRole("listitem")
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  expect(alturas).toHaveLength(7);
  expect(new Set(alturas).size, `alturas: ${alturas.join(", ")}`).toBe(1);

  const titulo = page.getByRole("heading", { name: "setembro de 2026", level: 2 });
  const estilo = await titulo.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { tamanho: Math.round(Number.parseFloat(cs.fontSize)), caixa: cs.textTransform };
  });
  expect(estilo.tamanho).toBe(16);
  expect(estilo.caixa).toBe("none");

  /* a linha da semana mostrada ganha realce dentro da grade */
  const realce = mesDe(page, "setembro de 2026").locator("div.ring-1");
  await expect(realce).toHaveCount(1);
  await expect(realce.getByRole("button", { name: /^16\/09/ })).toBeVisible();
});

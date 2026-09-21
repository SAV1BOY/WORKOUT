/**
 * Ultraloop 20/09 — Rodada 3, Lote 6 (SPEC §22.6): o Relatório em seções,
 * a caixa reservada antes do dado, as conquistas em duas colunas e os
 * rótulos que pararam de se contradizer. Um teste por item que se vê.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  GLIFO_DA_MARCA,
  LEGENDA_DA_FAIXA,
  NOME_DA_MARCA,
  ORDEM_DA_LEGENDA,
} from "../lib/semana";
import {
  abrirSecaoDoRelatorio as abrirSecao,
  entrarNoApp,
  fixarData,
  inserirNoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

/** As cinco seções dobráveis, na ordem da tela. */
const SECOES = ["resumo", "conquistas", "historico", "corpo", "graficos"] as const;

function uuid(prefixo: string, n: number): string {
  return `${prefixo}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/**
 * Doze sessões de força concluídas entre junho e setembro: o bastante para
 * fechar várias conquistas de uma vez (é o que o aviso precisa) e para o
 * Histórico e os gráficos terem o que desenhar.
 */
async function semearForca(sessao: SessaoMock, quantas = 12): Promise<void> {
  const datas = [
    "2026-06-01",
    "2026-06-03",
    "2026-06-08",
    "2026-06-10",
    "2026-06-15",
    "2026-06-17",
    "2026-06-22",
    "2026-06-24",
    "2026-09-14",
    "2026-09-15",
    "2026-09-16",
    "2026-09-16",
  ].slice(0, quantas);
  await inserirNoMock(
    sessao,
    "sessions",
    datas.map((data, i) => ({
      id: uuid("aaaaaaaa", i + 1),
      data,
      workout_id: i % 2 === 0 ? "A1" : "B1",
      fase: "fase1",
      status: "concluida",
      concluida_em: `${data}T13:00:00.000Z`,
      duracao_s: 2700,
    })),
  );
  await inserirNoMock(sessao, "session_sets", [
    {
      id: uuid("dddddddd", 1),
      session_id: uuid("aaaaaaaa", 9),
      exercise_id: "agachamento-livre",
      ordem_ex: 1,
      set_index: 1,
      tipo: "trabalho",
      reps: 5,
      carga_kg: 20,
      concluida: true,
      registrada_em: "2026-09-14T13:00:00.000Z",
    },
  ]);
}

/** Abre a tela já logada, com o relógio preso na quarta. */
async function abrirRelatorio(page: Page): Promise<void> {
  await fixarData(page, QUARTA);
  await entrarNoApp(page);
  await page.goto("/relatorio");
  await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
}

/** O `<details>` de uma seção e o cabeçalho que a abre. */
function secao(page: Page, id: string) {
  return page.locator(`details[data-secao="${id}"]`);
}

test.beforeEach(async () => {
  await resetarMock();
});

/* ---------------------------------------------------- item 1: as seções */

test("§22.6-1: o Relatório abre com menos de 1.500 px e cada bloco a um toque", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);
  await page.waitForTimeout(800);

  /* a tela abre pelo Resumo, com as outras quatro recolhidas */
  for (const id of SECOES) {
    await expect(secao(page, id)).toHaveCount(1);
  }
  expect(
    await secao(page, "resumo").evaluate((d) => (d as HTMLDetailsElement).open),
  ).toBe(true);
  for (const id of ["conquistas", "historico", "corpo", "graficos"]) {
    expect(
      await secao(page, id).evaluate((d) => (d as HTMLDetailsElement).open),
      id,
    ).toBe(false);
  }

  const rolagem = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(rolagem, `rolagem de ${rolagem} px`).toBeLessThan(1500);

  /* todo bloco é alcançável por UM toque no cabeçalho */
  for (const id of SECOES) {
    await abrirSecao(page, id);
    await expect(secao(page, id).locator("summary")).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Números" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Conquistas" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Histórico" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Peso" })).toBeVisible();

  /* o cabeçalho de toda seção tem alvo de dedo */
  for (const id of SECOES) {
    const caixa = await secao(page, id).locator("summary").boundingBox();
    expect(caixa?.height ?? 0, id).toBeGreaterThanOrEqual(44);
  }
  await semRolagemHorizontal(page);
});

test("§22.6-1: a seção aberta é lembrada na próxima visita", async ({ page }) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);

  await abrirSecao(page, "conquistas");
  await secao(page, "resumo").locator("summary").click();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
  await expect(secao(page, "conquistas")).toHaveAttribute("open", "");
  expect(
    await secao(page, "resumo").evaluate((d) => (d as HTMLDetailsElement).open),
  ).toBe(false);
});

/* ------------------------------------------------------- item 2: o CLS */

for (const tema of ["dark", "light"] as const) {
  test(`§22.6-2: o CLS de /relatorio fica abaixo de 0,1 — tema ${tema}`, async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await semearForca(sessao);
    await page.emulateMedia({ colorScheme: tema });
    await fixarData(page, QUARTA);
    await entrarNoApp(page);

    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!e.hadRecentInput) {
            (window as unknown as { __cls: number }).__cls += e.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto("/relatorio");
    await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
    await page.waitForTimeout(2500);

    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    expect(cls, `CLS ${cls.toFixed(4)} no tema ${tema}`).toBeLessThan(0.1);
  });
}

/* ------------------------------------------- itens 4 e 5: as conquistas */

test("§22.6-5: duas colunas, linhas de mesma altura e progresso visível", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);
  await abrirSecao(page, "conquistas");

  const grade = page.getByRole("region", { name: "Conquistas" });
  await expect(grade).toBeVisible();

  /* a barra de progresso diz quantas faltam sem contar cartão a cartão */
  const barra = grade.getByRole("progressbar", { name: "Conquistas fechadas" });
  await expect(barra).toBeVisible();
  const total = Number(await barra.getAttribute("aria-valuemax"));
  const feitas = Number(await barra.getAttribute("aria-valuenow"));
  expect(total).toBe(26);
  expect(feitas).toBeGreaterThan(0);

  /* os dois grupos rotulados */
  await expect(grade.getByRole("list", { name: "Conquistadas" })).toBeVisible();
  await expect(grade.getByRole("list", { name: "A conquistar" })).toBeVisible();

  /* duas colunas a 360 px: os dois primeiros cartões dividem a linha */
  const cartoes = grade.getByRole("list", { name: "A conquistar" }).getByRole("button");
  const caixas = await cartoes.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), h: Math.round(r.height) };
    }),
  );
  expect(caixas.length).toBeGreaterThan(2);
  const porLinha = caixas.filter((c) => c.y === caixas[0]!.y).length;
  expect(porLinha, "cartões por linha a 360 px").toBe(2);

  /* toda linha tem a mesma altura */
  const alturasPorLinha = new Map<number, number[]>();
  for (const c of caixas) {
    alturasPorLinha.set(c.y, [...(alturasPorLinha.get(c.y) ?? []), c.h]);
  }
  for (const [y, alturas] of alturasPorLinha) {
    expect(Math.max(...alturas) - Math.min(...alturas), `linha y=${y}`).toBeLessThanOrEqual(1);
  }

  /* e nenhum título quebra em três linhas */
  const linhasDoTitulo = await cartoes
    .locator("span.line-clamp-2")
    .evaluateAll((els) =>
      els.map((e) => {
        const cs = getComputedStyle(e);
        return Math.round(e.getBoundingClientRect().height / parseFloat(cs.lineHeight));
      }),
    );
  expect(Math.max(...linhasDoTitulo)).toBeLessThanOrEqual(2);
  await semRolagemHorizontal(page);
});

/* ---------------------------------------------- item 6: o aviso de nova */

test("§22.6-6: o aviso corta em 3, esconde a data de hoje e é um status", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil({ prefs: { conquistas_vistas: [] } });
  await semearForca(sessao);
  await abrirRelatorio(page);

  const aviso = page.getByRole("status", { name: "Conquista nova" });
  await expect(aviso).toBeVisible();

  const ids = (await aviso.getAttribute("data-aviso-conquista"))?.split(" ") ?? [];
  expect(ids.length, "a semente fecha mais de 3 conquistas de uma vez").toBeGreaterThan(3);

  await expect(aviso.getByRole("listitem")).toHaveCount(3);
  await expect(aviso).toContainText("e mais");
  /* o rótulo não repete o título da seção "Conquistas" da mesma tela */
  await expect(aviso).toContainText("Novas conquistas");

  /* data só do que não é de hoje: nada de 16/09 anunciado como novidade */
  await expect(aviso).not.toContainText("16/09");
});

/* --------------------------------------- itens 3, 4, 7 e 8: os rótulos */

test("§22.6-4: nenhum par de números com o mesmo rótulo se contradiz", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);

  const totais = page.getByRole("region", { name: "Totais" });
  const sessoes = totais.locator('[data-contador="Sessões"]');
  await expect(sessoes).toContainText("no total (força + cardio)");

  await abrirSecao(page, "graficos");
  const treinos = page.getByText(/de força no total/).first();
  await expect(treinos).toBeVisible();

  /* "no total" sozinho não aparece mais em dois lugares com números diferentes */
  const corpo = ((await page.locator("body").textContent()) ?? "").toLowerCase();
  expect(corpo).not.toContain("no mês · 46 no total");
});

test("§22.6-7: os números de uma fileira caem na mesma linha de base", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);

  for (const regiao of ["Totais", "Sequências"]) {
    const numeros = page
      .getByRole("region", { name: regiao })
      .locator(".numero-grande");
    const tops = await numeros.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().top)),
    );
    expect(tops.length).toBeGreaterThan(1);
    expect(Math.max(...tops) - Math.min(...tops), regiao).toBeLessThanOrEqual(1);
  }

  /* o ícone do rótulo tem 14 px: a 12 px ele sumia ao lado do número */
  const icone = page
    .getByRole("region", { name: "Totais" })
    .locator("[data-rotulo] svg")
    .first();
  const caixa = await icone.boundingBox();
  expect(Math.round(caixa?.width ?? 0)).toBe(14);
});

/*
 * O til de "SESSÕES" já foi dado como consertado uma vez e continuava
 * cortado: o `overflow-hidden` saiu do span de FORA, mas quem recortava era
 * o `truncate` do span de DENTRO — `overflow: hidden` numa caixa de linha de
 * 12 px (10 px × 1,2), que come o acento do Õ em versalete. Como o
 * `innerText` diz "SESSÕES" de qualquer jeito, nenhum teste de TEXTO pega
 * isto; este mede o recorte e os pixels.
 */
test("§22.6-7: nada recorta o rótulo na vertical e o til de SESSÕES pinta", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);
  await expect(page.locator('[data-contador="Sessões"] .numero-grande')).not.toHaveText(
    "—",
  );

  /* 1. nenhum rótulo da tela — nem o span de fora, nem o de dentro — recorta em y */
  const recortados = await page.locator("[data-rotulo]").evaluateAll((els) =>
    els.flatMap((el) =>
      [el, ...Array.from(el.querySelectorAll("span"))]
        .filter((n) => (n.textContent ?? "").trim().length > 0)
        .map((n) => ({
          rotulo: (el as HTMLElement).dataset.rotulo ?? "",
          classe: n.getAttribute("class") ?? "",
          overflowY: getComputedStyle(n).overflowY,
        }))
        .filter((m) => m.overflowY !== "visible"),
    ),
  );
  expect(recortados, "rótulo com recorte vertical: o acento some").toEqual([]);

  /* 2. prova de pixel: tirar o recorte à força não muda NADA do que é pintado */
  const alvo = page.locator('[data-rotulo="Sessões"] span').last();
  await expect(alvo).toHaveText("Sessões");
  const encurtado = await alvo.evaluate((n) => n.scrollWidth > n.clientWidth);
  expect(encurtado, 'o rótulo "SESSÕES" cabe na coluna sem encurtar').toBe(false);

  const caixa = await alvo.boundingBox();
  expect(caixa).not.toBeNull();
  const recorte = {
    x: Math.floor(caixa!.x),
    y: Math.floor(caixa!.y) - 4,
    width: Math.ceil(caixa!.width) + 2,
    height: Math.ceil(caixa!.height) + 8,
  };
  const antes = await page.screenshot({ clip: recorte, animations: "disabled" });
  await page.locator('[data-rotulo="Sessões"]').evaluate((el) => {
    (el as HTMLElement).style.overflow = "visible";
    for (const s of Array.from(el.querySelectorAll("span"))) {
      (s as HTMLElement).style.overflow = "visible";
    }
  });
  const depois = await page.screenshot({ clip: recorte, animations: "disabled" });
  expect(
    antes.equals(depois),
    'algo corta o desenho de "SESSÕES": sem o recorte o rótulo pinta diferente',
  ).toBe(true);

  /*
   * 3. caso NEGATIVO: o grampo horizontal. Só medir o til deixa passar o
   * erro oposto — foi ele que voltou uma vez. Na fileira de Totais o
   * ladrilho é uma GRADE, e num item de grade o `min-width: auto` só vira 0
   * quando o `overflow` do item não é `visible`: com os dois eixos
   * `visible`, um rótulo maior que o ladrilho de 95 px não encolhe nem
   * encurta, estoura, e a página passa a rolar para o lado a 360 px. Um
   * rótulo longo injetado tem de continuar encurtando e não pode alargar a
   * página.
   */
  const ladrilho = page
    .getByRole("region", { name: "Totais" })
    .locator('[data-contador="Minutos"]');
  const medida = await ladrilho.evaluate((el) => {
    const fora = el.querySelector("[data-rotulo]") as HTMLElement;
    const dentro = fora.querySelectorAll("span");
    const texto = dentro[dentro.length - 1] as HTMLElement;
    const antes = texto.textContent ?? "";
    texto.textContent = "Volume muito comprido de propósito para estourar";
    const m = {
      fora: Math.round(fora.getBoundingClientRect().width),
      conteudo: Math.round(el.getBoundingClientRect().width),
      encurtado: texto.scrollWidth > texto.clientWidth,
      recorteY: getComputedStyle(fora).overflowY,
      pagina: document.documentElement.scrollWidth,
    };
    texto.textContent = antes;
    return m;
  });
  expect(medida.encurtado, 'rótulo longo tem de encurtar com "…"').toBe(true);
  expect(
    medida.fora,
    "o rótulo estourou para fora do ladrilho em vez de encurtar",
  ).toBeLessThanOrEqual(medida.conteudo);
  expect(medida.pagina, "um rótulo longo fez a página rolar para o lado").toBe(360);
  /* e o grampo horizontal não pode ter voltado às custas do til */
  expect(medida.recorteY).toBe("visible");
  await semRolagemHorizontal(page);
});

/*
 * O outro lado do §22.6 item 7: o grampo horizontal é a REDE, não o normal.
 * Com os Números dentro do `<details>` a fileira de três perdeu ~9 px por
 * coluna e "BARRA FIXA" passou a sair "BARRA F…" — o texto inteiro seguia no
 * DOM, então nenhum teste de TEXTO pegava. Este mede: nenhum rótulo REAL da
 * tela pode encurtar. (O caso do rótulo longo INJETADO, logo acima, continua
 * exigindo o contrário.)
 */
test("§22.6-7: nenhum rótulo de verdade do Relatório sai cortado", async ({ page }) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);
  for (const id of SECOES) await abrirSecao(page, id);
  await page.waitForTimeout(500);

  const cortados = await page.locator("[data-rotulo]").evaluateAll((els) =>
    els.flatMap((el) => {
      const nos = [el, ...Array.from(el.querySelectorAll("span"))];
      return nos
        .map((n) => ({
          rotulo: (el as HTMLElement).dataset.rotulo ?? "",
          texto: (n.textContent ?? "").trim(),
          clientWidth: n.clientWidth,
          scrollWidth: n.scrollWidth,
        }))
        .filter((m) => m.texto.length > 0 && m.scrollWidth > m.clientWidth);
    }),
  );
  expect(cortados, "rótulo real encurtado com “…”: falta largura na linha").toEqual([]);

  /* e o mais comprido deles — "Barra fixa" — continua inteiro na tela */
  const barra = page.locator('[data-rotulo="Barra fixa"]');
  await expect(barra).toHaveCount(1);
  await expect(barra).toHaveText("Barra fixa");
  await semRolagemHorizontal(page);
});

test("§22.6-8: nenhuma sigla nem notação matemática sem tradução", async ({ page }) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);
  for (const id of SECOES) await abrirSecao(page, id);
  await page.waitForTimeout(400);

  const texto = (await page.locator("body").textContent()) ?? "";
  expect(texto).not.toContain("e1RM");
  expect(texto).not.toContain("Σ");
  expect(texto).not.toContain("Aderência");
  expect(texto).toContain("Constância (4 semanas)");
  expect(texto).toContain("carga máxima estimada");
  /* um formato só de porcentagem: colado, nunca "78 %" */
  expect(texto).not.toMatch(/\d\s%/);
  /* a contagem separada do nome do treino */
  expect(texto).toMatch(/Treino [AB] × \d/);

  /*
   * A folha de detalhe de uma conquista está a um toque da grade, mas
   * fechada não entra no `textContent` do corpo: medir só o corpo dava
   * confiança falsa — a regra de volume ainda dizia "Σ repetições × carga".
   * Abrir a folha antes de medir fecha o buraco.
   */
  await abrirSecao(page, "conquistas");
  await page.locator('[data-conquista="volume-50k"]').click();
  const folha = page.getByRole("dialog");
  await expect(folha).toBeVisible();
  await expect(folha).toContainText("Como fecha:");
  const naFolha = (await folha.textContent()) ?? "";
  expect(naFolha).toContain("Soma de repetições");
  expect(naFolha).not.toContain("Σ");
  expect(naFolha).not.toContain("e1RM");
});

/* ------------------------------------- item 9: legenda e cartão de uma linha */

/*
 * O dia de HOJE ainda por fazer é o estado mais comum da faixa — todo dia,
 * até o treino sair — e vinha desenhado como ponto CHEIO na cor primária, o
 * mesmo desenho que a legenda ensina para "faltou". Sem semeadura nenhuma a
 * quarta 16/09 é justamente isso: um dia de treino por fazer. Medido no
 * pixel, não lido no texto.
 */
test("§22.6-9: hoje por fazer é anel, não o ponto cheio de “faltou”", async ({
  page,
}) => {
  await usuarioComPerfil();
  await abrirRelatorio(page);
  await abrirSecao(page, "historico");
  const historico = page.getByRole("region", { name: "Histórico" });

  const hoje = historico.locator('[data-marca="hoje"] [data-glifo]');
  await expect(hoje).toHaveCount(1);
  const desenho = await hoje.evaluate((el) => {
    const ponto = el.firstElementChild as HTMLElement;
    const cs = getComputedStyle(ponto);
    return {
      glifo: (el as HTMLElement).dataset.glifo ?? "",
      borda: Math.round(parseFloat(cs.borderTopWidth)),
      fundo: cs.backgroundColor,
      corDaBorda: cs.borderTopColor,
    };
  });
  expect(desenho.glifo, "a quarta 16/09 sem sessão é um dia por fazer").toBe("aberto");
  expect(desenho.borda, "hoje por fazer tem de ser anel, não ponto cheio").toBe(2);
  expect(
    desenho.fundo,
    "o anel de hoje não pode ter preenchimento — esse é o desenho de “faltou”",
  ).toBe("rgba(0, 0, 0, 0)");

  /* o ponto CHEIO continua existindo, e só para "faltou" */
  const faltou = historico.locator('[data-glifo="faltou"]').first();
  await expect(faltou).toHaveCount(1);
  const cheio = await faltou.evaluate((el) => {
    const cs = getComputedStyle(el.firstElementChild as HTMLElement);
    return { borda: Math.round(parseFloat(cs.borderTopWidth)), fundo: cs.backgroundColor };
  });
  expect(cheio.borda).toBe(0);
  expect(cheio.fundo).not.toBe("rgba(0, 0, 0, 0)");
});


test("§22.6-9: a faixa tem legenda e o exercício sem registro é uma linha", async ({
  page,
}) => {
  const sessao = await usuarioComPerfil();
  await semearForca(sessao);
  await abrirRelatorio(page);

  await abrirSecao(page, "historico");
  const historico = page.getByRole("region", { name: "Histórico" });
  await expect(historico.getByText("✓ feito", { exact: false })).toBeVisible();

  /*
   * A legenda explica TODAS as marcas que a faixa desenha, e nenhum desenho
   * serve a duas delas. A primeira versão citava quatro glifos para as cinco
   * de `MarcaDoDia` — "parcial" faltava —, e pior: ensinava que ● é "faltou"
   * ao lado do dia de HOJE por fazer, que vinha como ponto cheio. Medido, não
   * lido: hoje por fazer tem de ser ANEL (borda de 2 px, sem preenchimento),
   * como todo dia por fazer.
   */
  await expect(historico.getByText(LEGENDA_DA_FAIXA)).toBeVisible();
  for (const marca of ORDEM_DA_LEGENDA) {
    expect(LEGENDA_DA_FAIXA, marca).toContain(
      `${GLIFO_DA_MARCA[marca]} ${NOME_DA_MARCA[marca]}`,
    );
  }

  /* nenhum dia "a fazer" — hoje ou não — é pintado como ponto cheio */
  const anois = await historico
    .locator('[data-glifo="aberto"]')
    .evaluateAll((els) =>
      els.map((el) => {
        const ponto = el.firstElementChild as HTMLElement;
        const cs = getComputedStyle(ponto);
        return {
          dia: (el.closest("[data-dia]") as HTMLElement | null)?.dataset.dia ?? "",
          borda: Math.round(parseFloat(cs.borderTopWidth)),
          fundo: cs.backgroundColor,
        };
      }),
    );
  expect(anois.length).toBeGreaterThan(0);
  for (const a of anois) {
    expect(a.borda, `o dia ${a.dia} por fazer virou ponto cheio`).toBe(2);
    expect(a.fundo, `o dia ${a.dia} por fazer ganhou preenchimento`).toBe("rgba(0, 0, 0, 0)");
  }

  await abrirSecao(page, "graficos");
  const vazio = page.locator('[data-grande="desenvolvimento-militar-em-pe"]');
  await expect(vazio).toContainText("sem registro");
  const caixa = await vazio.boundingBox();
  expect(caixa?.height ?? 0, "o card sem registro é uma linha").toBeLessThanOrEqual(48);
  await expect(page.getByText("Sem sessão registrada ainda.")).toHaveCount(0);
});

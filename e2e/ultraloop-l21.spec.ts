/**
 * Ultraloop — Rodada 32, Lote 21 (SPEC §22.18): Player — séries feitas no
 * Substituir, firme, conclusão e Visão geral. Tudo a 360×740, contra o mock,
 * pelo caminho que o dedo faz, nos dois temas onde o aceite pede.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  abrirSecaoDoRelatorio,
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  type SessaoMock,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026: Treino A, agachamento com 2 aquecimentos (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];
const AGACHAMENTO = "agachamento-livre";

/*
 * O config roda um worker só, em série (`workers: 1`, `fullyParallel: false`):
 * cada teste começa do mock limpo, como os outros specs do ultraloop.
 */
test.beforeEach(async () => {
  await resetarMock();
});

async function preparar(page: Page, tema: Tema = "light"): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil();
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await fixarData(page, SEGUNDA);
  await entrarNoApp(page);
  return sessao;
}

/** ✓ na série atual e pula o descanso que vem logo depois. */
async function concluirSerie(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Concluir série" }).click();
  await page.getByRole("button", { name: "Pular descanso" }).click();
}

interface SerieDoAparelho {
  id: string;
  concluida: boolean;
  tipo: string;
  setIndex: number;
  nota?: string | null;
}
interface BlocoDoAparelho {
  ordem: number;
  exercicioId: string;
  nota?: string | null;
  series: SerieDoAparelho[];
  trocados?: { exercicioId: string; series: SerieDoAparelho[] }[];
}

/** A sessão em andamento como o aparelho a guarda (Dexie → `sessaoAtiva`). */
async function blocosNoAparelho(page: Page): Promise<BlocoDoAparelho[]> {
  const bruto = await page.evaluate(
    () =>
      new Promise<string>((resolver) => {
        const pedido = indexedDB.open("treino-terraco");
        pedido.onerror = () => resolver("");
        pedido.onsuccess = () => {
          const banco = pedido.result;
          const tx = banco.transaction(["sessaoAtiva"], "readonly");
          const todas = tx.objectStore("sessaoAtiva").getAll();
          tx.oncomplete = () => {
            resolver(JSON.stringify(todas.result));
            banco.close();
          };
        };
      }),
  );
  const linhas = JSON.parse(bruto || "[]") as { dados?: { blocos?: BlocoDoAparelho[] } }[];
  return linhas.find((l) => l.dados?.blocos)?.dados?.blocos ?? [];
}

interface LinhaSerie {
  id: string;
  exercise_id: string;
  ordem_ex: number;
  set_index: number;
  tipo: string;
  concluida: boolean;
}

async function seriesNoMock(sessao: SessaoMock, exercicioId?: string): Promise<LinhaSerie[]> {
  const todas = await lerDoMock<LinhaSerie>(sessao, "session_sets");
  return exercicioId ? todas.filter((s) => s.exercise_id === exercicioId) : todas;
}

/** Os ids concluídos do bloco 1 no aparelho, na ordem. */
async function feitasDoPrimeiro(page: Page): Promise<string[]> {
  const bloco = (await blocosNoAparelho(page)).find((b) => b.ordem === 1);
  return (bloco?.series ?? []).filter((s) => s.concluida).map((s) => s.id);
}

/* ------------------------------------------ item 1: Substituir não apaga */

test.describe("§22.18 item 1 — Substituir nunca apaga série concluída", () => {
  // Os dois caminhos cruzam a sessão inteira, o Dexie e várias sincronizações.
  test.slow();
  for (const tema of TEMAS) {
    test(`pela ficha ('?' → Substituir): as 3 feitas ficam com o agachamento no aparelho, no mock e no histórico — ${tema}`, async ({
      page,
    }) => {
      const sessao = await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);

      // aquecimento 1, aquecimento 2 e série 1 do agachamento
      for (let i = 0; i < 3; i++) await concluirSerie(page);
      await expect(page.getByText("Série 2 de 3 · exercício 1 de 6")).toBeVisible();
      const idsFeitos = await feitasDoPrimeiro(page);
      expect(idsFeitos).toHaveLength(3);
      await expect
        .poll(async () => (await seriesNoMock(sessao, AGACHAMENTO)).map((s) => s.id).sort(), {
          timeout: 15_000,
        })
        .toEqual([...idsFeitos].sort());

      // "?" → ficha → Substituir: o aviso novo, antes de escolher
      await page.getByRole("button", { name: "Como fazer: Agachamento livre" }).click();
      const ficha = page.getByRole("dialog");
      await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
      await expect(
        ficha.getByText(
          "As séries já feitas ficam com cada exercício. Só as séries de trabalho restantes passam para o exercício escolhido.",
        ),
      ).toBeVisible();
      await semRolagemHorizontal(page);
      const primeira = ficha.getByRole("list", { name: "Exercícios alternativos" }).getByRole("button").first();
      const novo = (await primeira.locator("span").first().innerText()).trim();
      await primeira.click();
      await expect(ficha.getByRole("heading", { name: novo, exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(ficha).toHaveCount(0);

      // o player segue no passo certo: série 1 do substituto
      await expect(
        page.getByText(/^Série 1 de \d+ · exercício 1 de 6 · no lugar de Agachamento livre$/),
      ).toBeVisible();

      // no aparelho: as 3 feitas guardadas com o agachamento, os mesmos ids
      await expect
        .poll(async () => {
          const bloco = (await blocosNoAparelho(page)).find((b) => b.ordem === 1);
          return {
            exercicio: bloco?.exercicioId !== AGACHAMENTO,
            feitasDoNovo: bloco?.series.filter((s) => s.concluida).length,
            trocados: bloco?.trocados?.map((t) => [
              t.exercicioId,
              t.series.filter((s) => s.concluida).map((s) => s.id),
            ]),
          };
        })
        .toEqual({ exercicio: true, feitasDoNovo: 0, trocados: [[AGACHAMENTO, idsFeitos]] });

      // a série 1 do substituto sobe; as do agachamento continuam lá
      await concluirSerie(page);
      const outras = async () =>
        (await seriesNoMock(sessao)).filter((s) => s.exercise_id !== AGACHAMENTO && s.concluida);
      await expect.poll(async () => (await outras()).length, { timeout: 15_000 }).toBe(1);
      expect((await seriesNoMock(sessao, AGACHAMENTO)).map((s) => s.id).sort()).toEqual(
        [...idsFeitos].sort(),
      );

      // concluir o treino pela Visão geral: nada some no caminho
      await page.getByRole("button", { name: "Visão geral do treino" }).click();
      await expect(
        page.getByText("Feitas antes da troca: 3 séries de Agachamento livre."),
      ).toBeVisible();
      await page.getByRole("button", { name: "Concluir", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();
      await esperarAbaTreino(page);
      await expect
        .poll(async () => (await lerDoMock<{ status: string }>(sessao, "sessions"))[0]?.status, {
          timeout: 15_000,
        })
        .toBe("concluida");
      const doAgachamento = await seriesNoMock(sessao, AGACHAMENTO);
      expect(doAgachamento.map((s) => s.id).sort()).toEqual([...idsFeitos].sort());
      expect(doAgachamento.every((s) => s.concluida && s.ordem_ex === 1)).toBe(true);
      expect((await outras()).length).toBe(1);

      // o histórico do agachamento mostra a sessão, com a série de trabalho dele
      await page.goto(`/exercicios/${AGACHAMENTO}`);
      const ultimas = page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText("Últimas sessões", { exact: true }) });
      await expect(ultimas.getByRole("listitem")).toHaveCount(1);
      await expect(ultimas.getByRole("listitem").first()).toContainText("14/09");
      await semRolagemHorizontal(page);
    });

    test(`pela Visão geral ('substituir hoje'): o aviso novo e a série feita fica com o agachamento — ${tema}`, async ({
      page,
    }) => {
      const sessao = await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);
      await concluirSerie(page); // aquecimento 1
      const [feita] = await feitasDoPrimeiro(page);
      expect(feita).toBeTruthy();
      await expect
        .poll(async () => (await seriesNoMock(sessao, AGACHAMENTO)).length, { timeout: 15_000 })
        .toBe(1);

      await page.getByRole("button", { name: "Visão geral do treino" }).click();
      await page.locator("#bloco-1").getByRole("button", { name: "substituir hoje" }).click();
      const folha = page.getByRole("dialog", { name: "Substituir hoje" });
      await expect(
        folha.getByText(
          "As séries já feitas ficam com cada exercício. Só as séries de trabalho restantes passam para o exercício escolhido.",
        ),
      ).toBeVisible();
      await expect(folha.getByText(/serão trocadas/)).toHaveCount(0);
      const primeira = folha.getByRole("list", { name: "Exercícios alternativos" }).getByRole("button").first();
      const novo = (await primeira.locator("span").first().innerText()).trim();
      await primeira.click();
      await expect(folha).toHaveCount(0);

      const bloco1 = page.locator("#bloco-1");
      await expect(bloco1.getByRole("heading", { name: `1. ${novo}` })).toBeVisible();
      await expect(
        bloco1.getByText("Feitas antes da troca: 1 série de Agachamento livre."),
      ).toBeVisible();
      await semRolagemHorizontal(page);

      await expect
        .poll(async () => {
          const b = (await blocosNoAparelho(page)).find((x) => x.ordem === 1);
          return b?.trocados?.map((t) => [t.exercicioId, t.series.filter(s => s.concluida).map(s => s.id)]);
        })
        .toEqual([[AGACHAMENTO, [feita]]]);

      // o player volta no passo certo: série 1 do substituto
      await page.getByRole("button", { name: "Fechar" }).click();
      await expect(
        page.getByText(/^Série 1 de \d+ · exercício 1 de 6 · no lugar de Agachamento livre$/),
      ).toBeVisible();
      await concluirSerie(page);
      await expect
        .poll(
          async () =>
            (await seriesNoMock(sessao)).filter((s) => s.exercise_id !== AGACHAMENTO).length,
          { timeout: 15_000 },
        )
        .toBe(1);
      // a do agachamento não saiu do mock
      expect((await seriesNoMock(sessao, AGACHAMENTO)).map((s) => s.id)).toEqual([feita]);
    });
  }
});


/* ------------------------------------------------ item 2: "Firme?" */

test("troca offline, retoma no mesmo ponto e sincroniza as séries com seus exercícios", async ({ page, context }) => {
  test.slow(); // instalação do SW, troca, recarga sem rede e sincronização
  const sessao = await preparar(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await esperarServiceWorker(page);
  await context.setOffline(true);
  await concluirSerie(page);
  await expect.poll(() => feitasDoPrimeiro(page)).toHaveLength(1);
  const [original] = await feitasDoPrimeiro(page);

  await page.getByRole("button", { name: "Como fazer: Agachamento livre" }).click();
  const ficha = page.getByRole("dialog");
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await ficha.getByRole("button", { name: "Outro equipamento" }).click();
  await ficha.getByRole("list", { name: "Exercícios alternativos" })
    .getByRole("button", { name: /^Agachamento goblet/ }).click();
  await expect(ficha.getByRole("heading", { name: "Agachamento goblet" })).toBeVisible();
  await page.keyboard.press("Escape");
  await concluirSerie(page);
  await expect.poll(() => feitasDoPrimeiro(page)).toHaveLength(1);
  const [nova] = await feitasDoPrimeiro(page);
  expect(nova).not.toBe(original);
  expect(await seriesNoMock(sessao)).toHaveLength(0);
  await expect.poll(async () => {
    const bloco = (await blocosNoAparelho(page)).find((b) => b.ordem === 1);
    return bloco?.trocados?.flatMap((troca) => troca.series.filter(s => s.concluida).map(s => s.id));
  }).toEqual([original]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Agachamento goblet" })).toBeVisible();
  await expect(page.getByText(/^Série 2 de \d+ · exercício 1 de 6/)).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () =>
    (await seriesNoMock(sessao)).map((s) => [s.exercise_id, s.id, s.concluida]).sort(),
    { timeout: 15_000 },
  ).toEqual([
    ["agachamento-goblet", nova, true],
    [AGACHAMENTO, original, true],
  ]);
});

test.describe("§22.18 item 2 — 'Firme?' pergunta antes de abrir o teclado", () => {
  test.slow(); // percorre os aquecimentos, três séries, os descansos e a nota
  for (const tema of TEMAS) {
    test(`o primeiro controle é 'Fácil'; a nota mora atrás de 'Adicionar nota' e fica no aparelho — ${tema}`, async ({
      page,
    }) => {
      await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);
      for (let i = 0; i < 4; i++) await concluirSerie(page);
      // a última série do agachamento vai direto para a pergunta
      await page.getByRole("button", { name: "Concluir série" }).click();
      const tela = page.getByRole("region", { name: "Última repetição" });
      await expect(tela.getByRole("heading", { name: "Última repetição saiu firme?" })).toBeVisible();

      const primeiro = await tela.evaluate((el) => {
        const alvo = el.querySelector<HTMLElement>(
          "button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])",
        );
        return alvo?.textContent?.trim() ?? alvo?.getAttribute("aria-label") ?? "";
      });
      expect(primeiro).toBe("Fácil");
      await expect(tela.getByRole("textbox")).toHaveCount(0);

      const adicionar = tela.getByRole("button", { name: "Adicionar nota" });
      const caixa = await adicionar.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      // abaixo das três opções
      const falhei = await tela.getByRole("radio", { name: "Falhei" }).boundingBox();
      expect((caixa?.y ?? 0) > (falhei?.y ?? 0)).toBe(true);
      await adicionar.click();
      const nota = tela.getByRole("textbox", { name: "Nota: Agachamento livre" });
      await expect(nota).toBeFocused();
      await nota.fill("joelho bem");
      await expect
        .poll(async () => (await blocosNoAparelho(page)).find((b) => b.ordem === 1)?.nota)
        .toBe("joelho bem");
      await semRolagemHorizontal(page);

      await tela.getByRole("radio", { name: "Firme" }).click();
      await expect(tela).toHaveCount(0);
      expect((await blocosNoAparelho(page)).find((b) => b.ordem === 1)?.nota).toBe("joelho bem");
    });
  }
});

/* ------------------------------------- item 3: recordes da conclusão */

/** Anda o treino inteiro pelo player até a conclusão, respondendo "Firme". */
async function atravessarOTreino(page: Page): Promise<void> {
  const fim = page.getByText("Excelente! Você concluiu o treino.");
  for (let i = 0; i < 120; i++) {
    if (await fim.isVisible().catch(() => false)) return;
    const concluir = page.getByRole("button", { name: "Concluir série" });
    if (await concluir.isVisible().catch(() => false)) {
      await concluir.click();
      continue;
    }
    const pular = page.getByRole("button", { name: "Pular descanso" });
    if (await pular.isVisible().catch(() => false)) {
      await pular.click();
      continue;
    }
    const firme = page
      .getByRole("radiogroup", { name: "Última repetição" })
      .getByRole("radio", { name: "Firme" });
    if (await firme.isVisible().catch(() => false)) {
      await firme.click();
      await firme.waitFor({ state: "detached" }).catch(() => undefined);
      continue;
    }
    const sensacao = page.getByRole("radiogroup", { name: "Sensação" });
    if (await sensacao.isVisible().catch(() => false)) {
      await sensacao.getByRole("radio", { name: "Na medida certa" }).click();
      await page.getByRole("button", { name: "Concluir", exact: true }).click();
      continue;
    }
    await page.waitForTimeout(100);
  }
  await expect(fim).toBeVisible();
}

/** Rótulos em caixa alta com espaçamento (o papel "eyebrow"), fora de selos. */
async function rotulosEmCaixaAlta(
  page: Page,
  raiz = "body",
): Promise<{ texto: string; estilo: string }[]> {
  return page.locator(raiz).first().evaluate((el) => {
    const saida: { texto: string; estilo: string }[] = [];
    for (const no of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
      const cs = getComputedStyle(no);
      if (cs.textTransform !== "uppercase") continue;
      const texto = Array.from(no.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("")
        .trim();
      if (!texto) continue;
      const r = no.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // selos e chips (fundo ou borda próprios) são outro papel
      if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") continue;
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && cs.borderRadius.startsWith("9999")) continue;
      // o papel do rótulo: 11–12 px com espaçamento, ou nenhum espaçamento (o defeito)
      if (parseFloat(cs.fontSize) > 12) continue;
      if (cs.fontSize === "10px") continue; // text-micro: legenda de contador, outro papel
      saida.push({ texto, estilo: `${cs.fontSize}/${cs.fontWeight}/${cs.letterSpacing}` });
    }
    return saida;
  });
}

test.describe("§22.18 item 3 — a conclusão mostra 5 recordes e 'Ver todos'", () => {
  /*
   * Treino A de uma primeira sessão, tudo feito no valor pré-preenchido: 16
   * recordes — carga, repetições e estimada nos 5 exercícios com carga, e só
   * repetições na elevação de pernas na barra fixa (a análise tinha contado
   * 18; medido pelo `recordesDoBloco` sobre os dados de hoje).
   */
  test("primeira sessão com 16 recordes: 5 linhas, 'Ver todos (16)', o toque mostra os 16", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await preparar(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await atravessarOTreino(page);

    const lista = page.getByRole("list", { name: "Recordes" });
    await expect(lista.getByRole("listitem")).toHaveCount(5);
    const verTodos = page.getByRole("button", { name: "Ver todos (16)" });
    await expect(verTodos).toBeVisible();
    const caixa = await verTodos.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    await verTodos.click();
    await expect(lista.getByRole("listitem")).toHaveCount(16);
    await expect(verTodos).toHaveCount(0);
    // o foco vai ao primeiro recorde que apareceu (o 6º)
    await expect(lista.getByRole("listitem").nth(5)).toBeFocused();
    await semRolagemHorizontal(page);

    // §22.18 item 6: o "Nova conquista" do aviso com o mesmo rótulo do resto
    const rotulos = await rotulosEmCaixaAlta(page);
    expect(rotulos.map((r) => r.texto)).toContain("Nova conquista");
    expect(new Set(rotulos.map((r) => r.estilo)).size).toBe(1);
  });
});

/* ------------------------- itens 4, 5 e 6: a série da Visão geral */

test.describe("§22.18 itens 4 e 5 — a série da Visão geral", () => {
  for (const tema of TEMAS) {
    test(`campos empilhados de 48 px, '15,5' cabe inteiro, nomes sem repetição — ${tema}`, async ({
      page,
    }) => {
      await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);
      await page.getByRole("button", { name: "Visão geral do treino" }).click();
      const geral = page.getByRole("dialog", { name: "Visão geral do treino" });
      await expect(geral.getByRole("heading", { level: 1, name: "Treino A" })).toBeVisible();

      // item 5: os nomes (botões e vistos) não se repetem
      const nomes = await geral.evaluate((el) =>
        Array.from(el.querySelectorAll<HTMLElement>("button, [role=checkbox], [role=switch]"))
          .filter((b) => b.getBoundingClientRect().width > 0)
          .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim()),
      );
      expect(nomes.length).toBeGreaterThan(60);
      const repetidos = nomes.filter((n, i) => nomes.indexOf(n) !== i);
      expect(repetidos).toEqual([]);
      await expect(
        geral.getByRole("checkbox", { name: "Aquecimento 1 concluído — Agachamento livre", exact: true }),
      ).toBeVisible();
      await expect(
        geral.getByRole("checkbox", { name: "Série 1 concluída — Agachamento livre", exact: true }),
      ).toBeVisible();
      await expect(
        geral.getByRole("button", {
          name: "Aumentar repetições da Série 1 de Agachamento livre",
          exact: true,
        }),
      ).toBeVisible();

      // item 4: o campo de carga com "15,5" inteiro e 48 px de altura
      const grupo = geral.getByRole("group", { name: "Série 1 — Agachamento livre" });
      const carga = grupo.getByRole("textbox", { name: "carga na barra" });
      await carga.fill("15,5");
      await carga.blur();
      await expect(carga).toHaveValue(/^\d+,\d$/);
      const medida = await carga.evaluate((el) => ({
        cabe: el.scrollWidth <= el.clientWidth,
        altura: el.getBoundingClientRect().height,
        largura: el.getBoundingClientRect().width,
      }));
      expect(medida.cabe).toBe(true);
      expect(medida.altura).toBeGreaterThanOrEqual(48);
      expect(medida.largura).toBeGreaterThanOrEqual(64);
      for (const nome of [
        "Aumentar repetições da Série 1 de Agachamento livre",
        "Diminuir carga na barra da Série 1 de Agachamento livre",
      ]) {
        const b = await grupo.getByRole("button", { name: nome, exact: true }).boundingBox();
        expect(b?.height ?? 0).toBeGreaterThanOrEqual(48);
      }
      const reps = await grupo.getByRole("textbox", { name: "repetições" }).boundingBox();
      const kg = await carga.boundingBox();
      // empilhados: a carga fica abaixo das repetições
      expect((kg?.y ?? 0) >= (reps?.y ?? 0) + (reps?.height ?? 0)).toBe(true);
      await semRolagemHorizontal(page);

      // item 6: os rótulos dos campos com o mesmo papel dos outros
      const rotulos = await rotulosEmCaixaAlta(page, '[role="dialog"][aria-label="Visão geral do treino"]');
      expect(rotulos.map((r) => r.texto)).toContain("repetições");
      expect([...new Set(rotulos.map((r) => r.estilo))]).toEqual(["11px/400/0.275px"]);
    });
  }
});

test.describe("§22.18 item 6 — um rótulo em caixa alta só", () => {
  test("/, /mais, o Guia, as conquistas do Relatório e o diálogo do Calendário usam o mesmo tamanho, peso e espaçamento", async ({
    page,
  }) => {
    await preparar(page);
    const estilos = new Map<string, string[]>();
    const anotar = async (onde: string, raiz?: string) => {
      for (const r of await rotulosEmCaixaAlta(page, raiz)) {
        estilos.set(r.estilo, [...(estilos.get(r.estilo) ?? []), `${onde}: ${r.texto}`]);
      }
    };
    await anotar("/");
    await page.goto("/mais");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await anotar("/mais");
    await page.goto("/mais/guia");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await anotar("/mais/guia");
    await page.goto("/relatorio");
    await abrirSecaoDoRelatorio(page, "conquistas");
    await expect(page.locator('[data-grupo]').first()).toBeVisible();
    await anotar("/relatorio");
    await page.goto("/calendario");
    await page.getByRole("button", { name: /^quarta 16\/09/ }).click();
    await expect(page.getByRole("dialog")).toContainText("16 de setembro de 2026");
    await anotar("calendário", '[role="dialog"]');
    expect([...estilos.keys()], JSON.stringify([...estilos.entries()])).toEqual([
      "11px/400/0.275px",
    ]);
    const todos = [...estilos.values()].flat().join(" | ");
    expect(todos).toContain("/mais: Conta");
    expect(todos).toContain("calendário: Tipo do dia");
    expect(todos).toMatch(/\/relatorio: Conquistadas · \d/);
  });
});

/* ------------------------------------- item 7: o canto da Visão geral */

test.describe("§22.18 item 7 — 'Visão geral do treino' no mesmo canto", () => {
  for (const tema of TEMAS) {
    test(`o x do botão é o mesmo na preparação e na série — ${tema}`, async ({ page }) => {
      await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      const lista = page.getByRole("button", { name: "Visão geral do treino" });
      await expect(page.getByRole("button", { name: "Começar agora" })).toBeVisible();
      const naPreparacao = await lista.boundingBox();
      await page.getByRole("button", { name: "Começar agora" }).click();
      await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
      const naSerie = await lista.boundingBox();
      expect(Math.abs((naPreparacao?.x ?? 0) - (naSerie?.x ?? -99))).toBeLessThanOrEqual(1);
      // à direita, nas duas
      expect((naSerie?.x ?? 0) + (naSerie?.width ?? 0)).toBeGreaterThan(300);
      await semRolagemHorizontal(page);
    });
  }
});

/* ------------------------- itens 8 e 9: o voto e o relógio parado */

test.describe("§22.18 item 8 — um aviso de voto por exercício", () => {
  test("'Não gosto' → 'Gostei' deixa um aviso só; o 'Desfazer' dele volta ao 'Não gosto'", async ({
    page,
  }) => {
    const sessao = await preparar(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    const naoGosto = page.getByRole("button", { name: "Não gosto deste exercício" });
    const gostei = page.getByRole("button", { name: "Gostei deste exercício" });
    await naoGosto.click();
    await expect(naoGosto).toHaveAttribute("aria-pressed", "true");
    await gostei.click();
    await expect(gostei).toHaveAttribute("aria-pressed", "true");
    const desfazer = page.getByRole("button", { name: "Desfazer" });
    await expect(desfazer).toHaveCount(1);
    await expect(page.getByText("Anotado: você gosta de Agachamento livre.")).toBeVisible();
    await expect(
      page.getByText("Agachamento livre vai para o fim das listas de substitutos e do Explorar."),
    ).toHaveCount(0);
    await desfazer.click();
    await expect(naoGosto).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        async () =>
          (await lerDoMock<{ prefs: { evitar_exercicios?: string[] } }>(sessao, "profiles"))[0]
            ?.prefs.evitar_exercicios ?? [],
        { timeout: 15_000 },
      )
      .toEqual([AGACHAMENTO]);
  });
});

test.describe("§22.18 item 9 — o relógio de 250 ms para com a Visão geral aberta", () => {
  test("aberta a partir da preparação por 20 s, nenhum tique; ao fechar, ele volta", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await preparar(page);
    /*
     * Conta os tiques de todo `setInterval` de 250 ms criado daqui em diante.
     * Instalado já na página (e não num init script): o relógio fixo do
     * Playwright (`fixarData`) troca o `setInterval` da janela ao carregar e
     * apagaria o contador. A entrada no player é navegação do cliente, então
     * o contador sobrevive e pega o relógio da preparação desde o começo.
     */
    await page.evaluate(() => {
      const w = window as unknown as { __tiques250: number };
      w.__tiques250 = 0;
      const atual = window.setInterval.bind(window);
      window.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
        if (ms === 250 && typeof fn === "function") {
          const f = fn as (...a: unknown[]) => void;
          return atual(
            (...a: unknown[]) => {
              w.__tiques250 += 1;
              f(...a);
            },
            ms,
            ...args,
          );
        }
        return atual(fn, ms, ...args);
      }) as typeof window.setInterval;
    });
    await comecarOTreinoDoDia(page);
    await expect(page.getByRole("button", { name: "Começar agora" })).toBeVisible();
    const tiques = () =>
      page.evaluate(() => (window as unknown as { __tiques250: number }).__tiques250);
    // o relógio anda na preparação
    const a = await tiques();
    await page.waitForTimeout(1_000);
    expect((await tiques()) - a).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Visão geral do treino" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Treino A" })).toBeVisible();
    await page.waitForTimeout(500);
    const antes = await tiques();
    await page.waitForTimeout(20_000);
    expect((await tiques()) - antes).toBe(0);

    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("button", { name: "Começar agora" })).toBeVisible();
    const depois = await tiques();
    await page.waitForTimeout(1_000);
    expect((await tiques()) - depois).toBeGreaterThan(0);
  });
});

/**
 * Ultraloop — Rodada 23, Lote 19 (SPEC §22.16): Player — Substituir no passo
 * atual, preparação e série. Tudo a 360×740, contra o mock, pelo caminho que
 * o dedo faz, nos dois temas onde o aceite pede. (O item 7, o '%' colado, tem
 * o guarda em e2e/treino.spec.ts.)
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { exercicios } from "../lib/dados";
import {
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
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
  const pular = page.getByRole("button", { name: "Pular descanso" });
  await pular.click();
}

function idDoNome(nome: string): string {
  const achado = exercicios.find((e) => e.nome === nome);
  if (!achado) throw new Error(`exercício sem id: ${nome}`);
  return achado.id;
}

/** A sessão em andamento como o aparelho a guarda (Dexie → `sessaoAtiva`). */
async function sessaoNoAparelho(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolver) => {
        const pedido = indexedDB.open("treino-terraco");
        pedido.onerror = () => resolver("");
        pedido.onsuccess = () => {
          const banco = pedido.result;
          const tx = banco.transaction(["sessaoAtiva"], "readonly");
          const todas = tx.objectStore("sessaoAtiva").getAll();
          tx.oncomplete = () => resolver(JSON.stringify(todas.result));
        };
      }),
  );
}

interface SerieDoAparelho {
  id: string;
  concluida: boolean;
  tipo: string;
}
interface BlocoDoAparelho {
  ordem: number;
  exercicioId: string;
  series: SerieDoAparelho[];
}

interface SessaoDoAparelho {
  blocos?: BlocoDoAparelho[];
  /** O passo do player como o aparelho o guarda (lib/player.ts). */
  player?: { chave: string; ordem?: number | null };
}

async function sessaoDoAparelho(page: Page): Promise<SessaoDoAparelho> {
  const bruto = await sessaoNoAparelho(page);
  // `sessaoAtiva` guarda { id, dados: SessaoLocal, atualizadoEm } (lib/db.ts)
  const linhas = JSON.parse(bruto || "[]") as { dados?: SessaoDoAparelho }[];
  return linhas.find((l) => l.dados?.blocos)?.dados ?? {};
}

async function blocosNoAparelho(page: Page): Promise<BlocoDoAparelho[]> {
  return (await sessaoDoAparelho(page)).blocos ?? [];
}

interface LinhaSerie {
  exercise_id: string;
  set_index: number;
  tipo: string;
  concluida: boolean;
}

async function seriesNoMock(
  sessao: SessaoMock,
  exercicioId: string,
): Promise<LinhaSerie[]> {
  const todas = await lerDoMock<LinhaSerie>(sessao, "session_sets");
  return todas.filter((s) => s.exercise_id === exercicioId);
}

/** Escolhe o primeiro substituto na folha aberta e devolve o nome dele. */
async function substituirNaFolha(ficha: Locator): Promise<string> {
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  const primeira = ficha.locator("ul li button").first();
  const nome = (await primeira.locator("span").first().innerText()).trim();
  await primeira.click();
  return nome;
}

/** Quantos itens do perfil estão na fila de saída do aparelho (Dexie → `outbox`). */
async function perfilNaFila(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolver) => {
        const pedido = indexedDB.open("treino-terraco");
        pedido.onerror = () => resolver(-1);
        pedido.onsuccess = () => {
          const banco = pedido.result;
          const tx = banco.transaction(["outbox"], "readonly");
          const todas = tx.objectStore("outbox").getAll();
          tx.oncomplete = () => {
            const itens = todas.result as { tipo?: string }[];
            resolver(itens.filter((i) => i.tipo === "perfil").length);
            banco.close();
          };
        };
      }),
  );
}

test.describe("§22.16 item 6 — sem perfil, o polegar não confirma voto que não gravou", () => {
  /*
   * O worker leva todo `/rest/v1/` pela rede (NetworkOnly, app/sw.ts), e o
   * que passa por ele fica fora do alcance do `page.route`: aqui ele fica de
   * fora, para o `profiles` falhar de verdade.
   */
  test.use({ serviceWorkers: "block" });

  test("o player abre com a sessão do aparelho; 'Não gosto' diz que não anotou, sem 'Desfazer' e sem gravar", async ({
    page,
  }) => {
    const sessao = await preparar(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await expect(
      page.getByText("Aquecimento 1 de 2 · exercício 1 de 6"),
    ).toBeVisible();

    /*
     * O perfil deixa de chegar: o `profiles` responde erro e o cache de
     * leitura do aparelho (lib/persistencia-query.ts, tabela `cache`) é
     * esvaziado antes de o app lê-lo — o mesmo que um cache de mais de 7
     * dias sem rede. A sessão em andamento continua no Dexie.
     */
    await page.route("**/rest/v1/profiles**", (rota) =>
      rota.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "indisponível" }),
      }),
    );
    await page.addInitScript(() => {
      const pedido = indexedDB.open("treino-terraco");
      pedido.onsuccess = () => {
        const banco = pedido.result;
        if (banco.objectStoreNames.contains("cache")) {
          banco.transaction(["cache"], "readwrite").objectStore("cache").clear();
        }
        banco.close();
      };
    });
    await page.reload();

    const naoGosto = page.getByRole("button", {
      name: "Não gosto deste exercício",
    });
    await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Aquecimento 1 de 2 · exercício 1 de 6"),
    ).toBeVisible();
    await naoGosto.click();

    await expect(
      page.getByText("Voto não anotado: o perfil ainda não carregou."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Agachamento livre vai para o fim das listas de substitutos e do Explorar.",
      ),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
    await expect(naoGosto).not.toHaveAttribute("aria-pressed", /.*/);
    await semRolagemHorizontal(page);

    // nada foi para a fila do aparelho nem para o banco
    expect(await perfilNaFila(page)).toBe(0);
    const perfis = await lerDoMock<{ prefs: { evitar_exercicios?: string[] } }>(
      sessao,
      "profiles",
    );
    expect(perfis[0]?.prefs.evitar_exercicios ?? []).toEqual([]);
  });
});

/* -------------------------------- item 1: Substituir no passo atual */

test.describe("§22.16 item 1 — Substituir no exercício do passo atual", () => {
  for (const tema of TEMAS) {
    test(`o player segue no exercício novo, sem recarregar; a série do substituto fica no aparelho e no mock — ${tema}`, async ({
      page,
    }) => {
      const sessao = await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);

      /*
       * Com o aquecimento 1 do agachamento feito. O que acontece com ELE na
       * troca (hoje sai do aparelho e do banco, como já saía em c689f69) já
       * foi decidido pelo dono — opção (b), manter as séries feitas do
       * original — e é o L21 (B-substituir-apaga-series-feitas, SPEC §22.16
       * item 1) que traz o conserto e os testes dele: este teste não afirma
       * nem a perda nem o contrário.
       */
      await concluirSerie(page);
      await expect(
        page.getByText("Aquecimento 2 de 2 · exercício 1 de 6"),
      ).toBeVisible();

      // marca na janela: se a página recarregar, a marca some
      await page.evaluate(() => {
        (window as unknown as { __semRecarregar?: number }).__semRecarregar =
          19;
      });

      // "?" → folha do exercício do passo atual → Substituir → o primeiro
      await page
        .getByRole("button", { name: "Como fazer: Agachamento livre" })
        .click();
      const ficha = page.getByRole("dialog");
      await expect(
        ficha.getByRole("heading", { name: "Agachamento livre", exact: true }),
      ).toBeVisible();
      const novo = await substituirNaFolha(ficha);
      const idNovo = idDoNome(novo);
      await expect(
        ficha.getByRole("heading", { name: novo, exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(ficha).toHaveCount(0);

      // o player mostra o exercício novo pronto para a série — sem esqueleto
      await expect(
        page.getByRole("button", { name: "Concluir série" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: novo, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          /^Série 1 de \d+ · exercício 1 de 6 · no lugar de Agachamento livre$/,
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("status", { name: "Carregando" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __semRecarregar?: number }).__semRecarregar,
        ),
      ).toBe(19);
      await semRolagemHorizontal(page);

      // o passo achado fica anotado no aparelho: a série 1 do exercício novo
      await expect
        .poll(async () => {
          const dados = await sessaoDoAparelho(page);
          const bloco = dados.blocos?.find((b) => b.ordem === 1);
          const primeira = bloco?.series.find((s) => !s.concluida);
          return [
            bloco?.exercicioId,
            dados.player?.ordem,
            dados.player?.chave === `serie:${primeira?.id ?? "?"}`,
          ];
        })
        .toEqual([idNovo, 1, true]);

      // a série 1 do exercício novo: no aparelho e no mock
      await concluirSerie(page);
      await expect(
        page.getByText(/^Série 2 de \d+ · exercício 1 de 6/),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const bloco = (await blocosNoAparelho(page)).find(
            (b) => b.ordem === 1,
          );
          return bloco
            ? [
                bloco.exercicioId,
                bloco.series.filter((s) => s.concluida).length,
              ]
            : null;
        })
        .toEqual([idNovo, 1]);
      await expect
        .poll(
          async () =>
            (await seriesNoMock(sessao, idNovo)).filter((s) => s.concluida)
              .length,
          {
            timeout: 15_000,
          },
        )
        .toBe(1);

      // trocar um exercício POSTERIOR (o 2º, pela folha) não mexe no passo
      await page
        .getByRole("button", { name: `Como fazer: ${novo}`, exact: true })
        .click();
      await expect(
        ficha.getByRole("heading", { name: novo, exact: true }),
      ).toBeVisible();
      await ficha.getByRole("button", { name: "Próximo exercício" }).click();
      await expect(ficha.getByRole("heading").first()).not.toHaveText(novo);
      const segundoAntes = (
        await ficha.getByRole("heading").first().innerText()
      ).trim();
      const segundoNovo = await substituirNaFolha(ficha);
      expect(segundoNovo).not.toBe(segundoAntes);
      await expect(
        ficha.getByRole("heading", { name: segundoNovo, exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(ficha).toHaveCount(0);
      await expect(
        page.getByRole("heading", { level: 2, name: novo, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/^Série 2 de \d+ · exercício 1 de 6/),
      ).toBeVisible();

      // e a série registrada continua lá, no aparelho e no mock
      const blocos = await blocosNoAparelho(page);
      expect(
        blocos.find((b) => b.ordem === 1)?.series.filter((s) => s.concluida),
      ).toHaveLength(1);
      expect(blocos.find((b) => b.ordem === 2)?.exercicioId).toBe(
        idDoNome(segundoNovo),
      );
      expect(
        (await seriesNoMock(sessao, idNovo)).filter((s) => s.concluida),
      ).toHaveLength(1);
    });
  }
});

test.describe("§22.16 item 1 — pela Visão geral", () => {
  test("trocar o exercício do passo atual pela Visão geral também não trava", async ({
    page,
  }) => {
    await preparar(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);

    await page.getByRole("button", { name: "Visão geral do treino" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Treino A" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "substituir hoje" }).first().click();
    const folha = page.getByRole("dialog", { name: "Substituir hoje" });
    await expect(
      folha.getByRole("heading", { name: "Substituir hoje" }),
    ).toBeVisible();
    const primeira = folha.locator("ul li button").first();
    const novo = (await primeira.locator("span").first().innerText()).trim();
    await primeira.click();
    await expect(folha).toHaveCount(0);
    await page.getByRole("button", { name: "Fechar" }).click();

    await expect(
      page.getByRole("button", { name: "Concluir série" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: novo, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /^Série 1 de \d+ · exercício 1 de 6 · no lugar de Agachamento livre$/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Carregando" }),
    ).toHaveCount(0);
  });
});

/* --------------------------------------- itens 2–4: a preparação */

test.describe("§22.16 itens 2–4 — a preparação", () => {
  for (const tema of TEMAS) {
    test(`'Prepare-se', centrada, com 'Sair do treino' e 'Visão geral' — ${tema}`, async ({
      page,
    }) => {
      await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      const endereco = page.url();

      // item 4: a forma neutra
      await expect(page.getByText("Prepare-se", { exact: true })).toBeVisible();
      await expect(page.getByText(/Preparad[oa]/)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        /Treino A/,
      );

      // item 2: os dois controles do topo, ≥ 44 × 44
      const sair = page.getByRole("link", { name: "Sair do treino" });
      const lista = page.getByRole("button", { name: "Visão geral do treino" });
      for (const alvo of [sair, lista]) {
        const caixa = await alvo.boundingBox();
        expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      // item 3: o bloco no meio da tela (≤ 24 px de diferença), longe do topo
      const bloco = await page.locator("[data-bloco-preparacao]").boundingBox();
      const topo = await sair.boundingBox();
      if (!bloco || !topo) throw new Error("preparação sem bloco");
      const acima = bloco.y;
      const abaixo = 740 - (bloco.y + bloco.height);
      expect(Math.abs(acima - abaixo)).toBeLessThanOrEqual(24);
      expect(bloco.y).toBeGreaterThanOrEqual(topo.y + topo.height + 8);
      await semRolagemHorizontal(page);

      // "Visão geral do treino" abre a visão geral; "Fechar" volta à preparação
      await lista.click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Treino A" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Fechar" }).click();
      await expect(page.getByText("Prepare-se", { exact: true })).toBeVisible();
      await expect(lista).toBeFocused();

      // "Sair do treino" volta à aba Treino, e a sessão continua retomável
      await sair.click();
      await esperarAbaTreino(page);
      const continuar = page.getByRole("link", { name: "Continuar" });
      await expect(continuar).toHaveAttribute(
        "href",
        new URL(endereco).pathname,
      );
      await continuar.click();
      await expect(page).toHaveURL(endereco);
      await expect(page.getByText("Prepare-se", { exact: true })).toBeVisible();
    });
  }
});

test.describe("§22.16 item 2 — a contagem não corre atrás da Visão geral", () => {
  test("20 s com a Visão geral aberta: 'Fechar' volta à preparação, e a contagem recomeça", async ({
    page,
  }) => {
    await preparar(page);
    await comecarOTreinoDoDia(page);
    await expect(page.getByText("Prepare-se", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Visão geral do treino" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Treino A" }),
    ).toBeVisible();
    // o relógio anda 20 s (a contagem padrão é de 10 s) com a lista aberta
    await page.clock.setFixedTime(
      new Date(new Date(SEGUNDA).getTime() + 20_000),
    );
    // o relógio do player lê a hora a cada 250 ms: 1 s dá quatro leituras
    await page.waitForTimeout(1_000);
    await expect(
      page.getByRole("heading", { level: 1, name: "Treino A" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();

    // de volta na preparação, com a contagem cheia de novo
    await expect(page.getByText("Prepare-se", { exact: true })).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect(page.getByText("Prepare-se", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Concluir série" })).toHaveCount(0);

    // mais uma contagem inteira depois, o treino começa sozinho
    await page.clock.setFixedTime(
      new Date(new Date(SEGUNDA).getTime() + 32_000),
    );
    await expect(
      page.getByRole("button", { name: "Concluir série" }),
    ).toBeVisible();
  });
});

/* -------------------------------------- item 5: pontos por série */

/** Razão de contraste WCAG entre duas cores `rgb(…)` do `getComputedStyle`. */
function contraste(a: string, b: string): number {
  const lum = (cor: string) => {
    const [r, g, bl] = (cor.match(/[\d.]+/g) ?? ["0", "0", "0"])
      .slice(0, 3)
      .map((v) => {
        const c = Number(v) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
}

test.describe("§22.16 item 5 — um ponto por série do exercício", () => {
  for (const tema of TEMAS) {
    test(`2 aquecimentos + 3 séries = 5 pontos; cada 'Concluir série' enche um — ${tema}`, async ({
      page,
    }) => {
      await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);

      const pontos = page.locator("[data-pontos-do-bloco]");
      await expect(pontos).toHaveAttribute("role", "img");
      await expect(pontos).toHaveAttribute(
        "aria-label",
        "Aquecimento 1 de 2 · 0 de 5 séries feitas",
      );
      await expect(pontos.locator("[data-ponto]")).toHaveCount(5);
      await expect(pontos.locator('[data-ponto="feita"]')).toHaveCount(0);
      // a barra da sessão continua, com nome
      await expect(
        page.getByRole("progressbar", { name: "Progresso do treino" }),
      ).toBeVisible();

      // o aquecimento é menor que a série de trabalho
      const tamanhos = await pontos
        .locator("[data-ponto]")
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
      expect(tamanhos[0]).toBeLessThan(tamanhos[4] ?? 0);

      await concluirSerie(page);
      await expect(pontos).toHaveAttribute(
        "aria-label",
        "Aquecimento 2 de 2 · 1 de 5 séries feitas",
      );
      await expect(pontos.locator('[data-ponto="feita"]')).toHaveCount(1);

      await concluirSerie(page);
      await expect(pontos).toHaveAttribute(
        "aria-label",
        "Série 1 de 3 · 2 de 5 séries feitas",
      );
      await expect(pontos.locator('[data-ponto="feita"]')).toHaveCount(2);
      await semRolagemHorizontal(page);

      // feito, atual e a fazer: cada contorno ≥ 3:1 contra o fundo da tela
      const cores = await pontos.locator("[data-ponto]").evaluateAll((els) => {
        const fundo = getComputedStyle(document.body).backgroundColor;
        return els.map((e) => ({
          borda: getComputedStyle(e).borderTopColor,
          fundo,
        }));
      });
      expect(cores).toHaveLength(5);
      for (const { borda, fundo } of cores) {
        expect(
          contraste(borda, fundo),
          `ponto ${borda} sobre ${fundo}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

/* ---------------------- item 6: topo com dois ícones; polegares com aviso */

/** Caixas dos alvos de 44 px visíveis na tela (botões e links de 44 a 60 px). */
async function alvosDe44(page: Page) {
  return page
    .locator("main button:visible, main a:visible")
    .evaluateAll((els) =>
      els
        .map((e) => {
          const r = e.getBoundingClientRect();
          const nome =
            e.getAttribute("aria-label") ?? (e.textContent ?? "").trim();
          return { nome, x: r.x, y: r.y, w: r.width, h: r.height };
        })
        .filter((c) => c.w >= 43.5 && c.h >= 43.5 && c.w <= 60 && c.h <= 60),
    );
}

test.describe("§22.16 item 6 — topo da série e polegares", () => {
  for (const tema of TEMAS) {
    test(`dois ícones no topo, 8 px entre alvos, 'Não gosto' com 'Desfazer' — ${tema}`, async ({
      page,
    }) => {
      const sessao = await preparar(page, tema);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);

      // o topo: só "Visão geral do treino" e "Ajustar"
      const lista = page.getByRole("button", { name: "Visão geral do treino" });
      const ajustar = page.getByRole("button", { name: "Ajustar" });
      const topoLista = await lista.boundingBox();
      const topoAjustar = await ajustar.boundingBox();
      if (!topoLista || !topoAjustar) throw new Error("topo sem ícones");
      const doTopo = (await alvosDe44(page)).filter(
        (c) => Math.abs(c.y - topoLista.y) < 4,
      );
      expect(doTopo.map((c) => c.nome).sort()).toEqual([
        "Ajustar",
        "Visão geral do treino",
      ]);

      // os polegares estão na linha do nome, ao lado do "?"
      const gostei = page.getByRole("button", {
        name: "Gostei deste exercício",
      });
      const naoGosto = page.getByRole("button", {
        name: "Não gosto deste exercício",
      });
      const ajuda = page.getByRole("button", {
        name: "Como fazer: Agachamento livre",
      });
      const caixaAjuda = await ajuda.boundingBox();
      const caixaGostei = await gostei.boundingBox();
      expect(
        Math.abs((caixaGostei?.y ?? 0) - (caixaAjuda?.y ?? 99)),
      ).toBeLessThan(4);

      // entre quaisquer dois alvos de 44 px, ≥ 8 px
      const alvos = await alvosDe44(page);
      expect(alvos.length).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < alvos.length; i++) {
        for (let j = i + 1; j < alvos.length; j++) {
          const a = alvos[i];
          const b = alvos[j];
          if (!a || !b) continue;
          const dx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
          const dy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
          expect(
            Math.max(dx, dy),
            `"${a.nome}" e "${b.nome}" a menos de 8 px`,
          ).toBeGreaterThanOrEqual(8 - 0.5);
        }
      }
      await semRolagemHorizontal(page);

      // "Não gosto": marca, avisa com "Desfazer", e o desfazer volta a nenhum voto
      await naoGosto.click();
      await expect(naoGosto).toHaveAttribute("aria-pressed", "true");
      const aviso = page.getByText(
        "Agachamento livre vai para o fim das listas de substitutos e do Explorar.",
      );
      await expect(aviso).toBeVisible();
      await expect
        .poll(
          async () =>
            (
              await lerDoMock<{ prefs: { evitar_exercicios?: string[] } }>(
                sessao,
                "profiles",
              )
            )[0]?.prefs.evitar_exercicios,
          { timeout: 10_000 },
        )
        .toEqual(["agachamento-livre"]);

      // o "Desfazer" é alvo de toque (≥ 44 × 44) e, focado pelo teclado,
      // tem anel sólido que se vê contra o fundo do aviso
      const desfazer = page.getByRole("button", { name: "Desfazer" });
      const caixaDesfazer = await desfazer.boundingBox();
      expect(caixaDesfazer?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(caixaDesfazer?.height ?? 0).toBeGreaterThanOrEqual(44);
      await page.keyboard.press("Shift");
      await desfazer.focus();
      const anel = await desfazer.evaluate((e) => {
        const estilo = getComputedStyle(e);
        const aviso = e.closest("[data-sonner-toast]");
        return {
          visivel: e.matches(":focus-visible"),
          tipo: estilo.outlineStyle,
          largura: parseFloat(estilo.outlineWidth),
          cor: estilo.outlineColor,
          fundo: aviso ? getComputedStyle(aviso).backgroundColor : "",
        };
      });
      expect(anel.visivel).toBe(true);
      expect(anel.tipo).toBe("solid");
      expect(anel.largura).toBeGreaterThanOrEqual(2);
      expect(
        contraste(anel.cor, anel.fundo),
        `anel ${anel.cor} sobre ${anel.fundo}`,
      ).toBeGreaterThanOrEqual(3);

      await desfazer.click();
      await expect(naoGosto).not.toHaveAttribute("aria-pressed", "true");
      await expect(naoGosto).not.toHaveAttribute("aria-pressed", "false");
      await expect(gostei).not.toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(
          async () =>
            (
              await lerDoMock<{ prefs: { evitar_exercicios?: string[] } }>(
                sessao,
                "profiles",
              )
            )[0]?.prefs.evitar_exercicios,
          { timeout: 10_000 },
        )
        .toEqual([]);
    });
  }
});

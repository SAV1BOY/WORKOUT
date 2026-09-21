/**
 * Ultraloop 20/09/2026 — faixa A, rodada 3, lote "player: gravar sem perder o
 * treino" (SPEC §22.5). O que se MEDE aqui: o descarte que só acontece depois
 * de uma pergunta, a sessão gravada ao entrar na conclusão, a Visão geral com
 * contrato de diálogo, as perguntas que chegam sem resposta, os 24 px entre
 * gravar e pular a série, o fim do descanso anunciado sem som e o player com
 * `h1`.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  abrirVisaoGeral,
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  lerDoMock,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** 14/09/2026 é a segunda-feira que abre o programa: Treino A (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

test.beforeEach(async () => {
  await resetarMock();
});

/** Entra, começa o Treino A e para no 1º exercício do player. */
async function abrirPlayer(page: Page) {
  const sessao = await usuarioComPerfil();
  await fixarData(page, SEGUNDA);
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  return sessao;
}

/** ✓ na série atual e pula o descanso que vier. */
async function concluirSerie(page: Page) {
  await page.getByRole("button", { name: "Concluir série" }).click();
  const pular = page.getByRole("button", { name: "Pular descanso" });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}

/**
 * O primário da tela de pergunta atual, se houver uma.
 *
 * Precisa ser procurado DENTRO da região: o cronômetro dos exercícios de
 * tempo também tem um botão "Continuar", e ele começa a contagem.
 */
function primarioDaPergunta(page: Page) {
  return page
    .getByRole("region", { name: "Última repetição" })
    .or(page.getByRole("region", { name: "Feedback do treino" }))
    .getByRole("button", {
      name: /^(Pular esta pergunta|Continuar|Concluir sem responder|Concluído)$/,
    });
}

/** Do 1º exercício até a tela de conclusão, respondendo tudo pelo primário. */
async function irAteAConclusao(page: Page) {
  for (let i = 0; i < 40; i++) {
    if (
      await page
        .getByRole("region", { name: "Treino concluído" })
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }
    const pular = page.getByRole("button", { name: "Pular descanso" });
    if (await pular.isVisible().catch(() => false)) {
      await pular.click();
      continue;
    }
    const pergunta = primarioDaPergunta(page);
    if (await pergunta.isVisible().catch(() => false)) {
      await pergunta.click();
      continue;
    }
    const proximo = page.getByRole("button", { name: "Próximo passo" });
    if (!(await proximo.isVisible().catch(() => false))) break;
    await proximo.click();
  }
  await expect(page.getByRole("region", { name: "Treino concluído" })).toBeVisible();
}

test.describe("§22.5 item 1 — dois toques no mesmo ponto não jogam o treino fora", () => {
  test("o descarte pede um AlertDialog, e o 2º toque no mesmo lugar não descarta", async ({
    page,
  }) => {
    await abrirPlayer(page);
    await abrirVisaoGeral(page);

    // uma série registrada na própria folha: é a contagem que o diálogo promete
    const visto = page
      .getByRole("group", { name: /^Série 1 —/ })
      .first()
      .getByRole("checkbox");
    await visto.click();
    await expect(visto).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/\b1\/\d+ séries\b/)).toBeVisible();

    const descartar = page.getByRole("button", { name: "Descartar este treino" });
    const caixa = await descartar.boundingBox();
    expect(caixa).not.toBeNull();
    await descartar.click();

    const pergunta = page.getByRole("alertdialog");
    await expect(pergunta).toBeVisible();
    await expect(pergunta).toContainText("Descartar este treino?");
    await expect(pergunta).toContainText("A 1 série já registrada continua salva.");

    // o 2º toque cai no mesmo ponto: nada é descartado, a pergunta continua
    await page.mouse.click(
      (caixa?.x ?? 0) + (caixa?.width ?? 0) / 2,
      (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2,
    );
    await expect(pergunta).toBeVisible();
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);

    // e "Cancelar" devolve a sessão inteira
    await pergunta.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
  });

  test("antes da 1ª série, a pergunta não promete \"0 séries\" salvas", async ({
    page,
  }) => {
    // o caso mais comum: abrir o treino, mudar de ideia e descartar sem
    // ter gravado nada. O diálogo destrutivo tem de falar disso, não de zero.
    await abrirPlayer(page);
    await abrirVisaoGeral(page);

    await page.getByRole("button", { name: "Descartar este treino" }).click();
    const pergunta = page.getByRole("alertdialog");
    await expect(pergunta).toBeVisible();
    await expect(pergunta).toContainText("Descartar este treino?");
    await expect(pergunta).toContainText("Nenhuma série foi registrada ainda.");
    await expect(pergunta).not.toContainText("0 séries");
    await expect(pergunta).not.toContainText("já registradas");
  });
});

test.describe("§22.5 item 2 — a conclusão grava ao entrar", () => {
  test("ver a conclusão já basta: nada fica 'em andamento' na aba Treino", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const sessao = await abrirPlayer(page);
    await irAteAConclusao(page);

    const fim = page.getByRole("region", { name: "Treino concluído" });
    await expect(fim.getByText(/Treino salvo/)).toBeVisible({ timeout: 15_000 });

    // o "Próximo" está na barra fixa: visível SEM rolar os 2.244 px de antes
    const proximo = fim.getByRole("button", { name: "Próximo" });
    const caixa = await proximo.boundingBox();
    const altura = page.viewportSize()?.height ?? 740;
    expect(caixa).not.toBeNull();
    expect(caixa?.y ?? 0).toBeLessThan(altura);

    // a sessão subiu com status "concluida" antes de qualquer toque no rodapé
    await expect
      .poll(
        async () => (await lerDoMock<{ status: string }>(sessao, "sessions"))[0]?.status,
        { timeout: 20_000 },
      )
      .toBe("concluida");

    // sair pela URL, sem tocar no "Próximo": a aba Treino não oferece retomar
    await page.goto("/");
    await esperarAbaTreino(page);
    await expect(page.getByRole("button", { name: "Começar treino" })).toBeVisible();
    await expect(page.getByText("em andamento")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Continuar" })).toHaveCount(0);
  });
});

test.describe("§22.5 item 3 — a Visão geral é um diálogo", () => {
  test("Esc e o voltar do celular fecham a lista e devolvem o foco", async ({ page }) => {
    await abrirPlayer(page);
    await abrirVisaoGeral(page);

    const lista = page.getByRole("dialog", { name: "Visão geral do treino" });
    await expect(lista).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
    // o foco volta ao botão que abriu a lista (§22.5 item 3)
    await expect(
      page.getByRole("button", { name: "Visão geral do treino" }),
    ).toBeFocused();

    // o voltar do celular fecha a lista, não o treino
    await page.getByRole("button", { name: "Visão geral do treino" }).click();
    await expect(lista).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
  });

  test("o rodapé repete 'Voltar ao treino' e tem três verbos de saída", async ({
    page,
  }) => {
    await abrirPlayer(page);
    await abrirVisaoGeral(page);

    // item 9: três verbos distintos, nenhum deles adivinhável só pelo ícone
    for (const nome of ["Continuar depois", "Descartar este treino", "Concluir"]) {
      await expect(page.getByRole("button", { name: nome }).or(
        page.getByRole("link", { name: nome }),
      ).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Voltar ao treino" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fechar" })).toBeVisible();
    // o "Abandonar" ambíguo e o ícone mudo saíram
    await expect(page.getByRole("button", { name: "Abandonar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sair do treino" })).toHaveCount(0);

    await page.getByRole("button", { name: "Voltar ao treino" }).click();
    await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
  });
});

test.describe("§22.5 itens 4 e 5 — as perguntas chegam sem resposta e com cor própria", () => {
  test("'firme?' e o feedback nascem sem nenhuma opção marcada", async ({ page }) => {
    test.setTimeout(120_000);
    await abrirPlayer(page);
    for (let i = 0; i < 5; i++) await concluirSerie(page);

    const firme = page.getByRole("radiogroup", { name: "Última repetição" });
    await expect(firme).toBeVisible();
    await expect(firme.getByRole("radio", { name: "Firme" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(await firme.getByRole("radio").count()).toBe(3);
    for (const marcada of await firme
      .getByRole("radio")
      .evaluateAll((nos) => nos.map((n) => n.getAttribute("aria-checked")))) {
      expect(marcada).toBe("false");
    }
    // o primário diz a verdade enquanto ninguém responde
    await expect(
      page.getByRole("button", { name: "Pular esta pergunta" }),
    ).toBeVisible();

    // item 5: a opção se distingue do fundo da PÁGINA sem depender da borda
    const cores = await firme.getByRole("radio").first().evaluate((no) => ({
      opcao: getComputedStyle(no).backgroundColor,
      pagina: getComputedStyle(document.body).backgroundColor,
    }));
    expect(cores.opcao).not.toBe(cores.pagina);

    await firme.getByRole("radio", { name: "Firme" }).click();
    await expect(firme.getByRole("radio", { name: "Firme" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    const sensacao = page.getByRole("radiogroup", { name: "Sensação" });
    for (let i = 0; i < 80 && !(await sensacao.isVisible().catch(() => false)); i++) {
      const pular = page.getByRole("button", { name: "Pular descanso" });
      if (await pular.isVisible().catch(() => false)) {
        await pular.click();
        continue;
      }
      const pergunta = primarioDaPergunta(page);
      if (await pergunta.isVisible().catch(() => false)) {
        await pergunta.click();
        continue;
      }
      await page.getByRole("button", { name: "Próximo passo" }).click();
    }
    await expect(sensacao).toBeVisible();
    for (const marcada of await sensacao
      .getByRole("radio")
      .evaluateAll((nos) => nos.map((n) => n.getAttribute("aria-checked")))) {
      expect(marcada).toBe("false");
    }
    await expect(page.getByText("(opcional)").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Concluir sem responder" }),
    ).toBeVisible();
  });
});

test.describe("§22.5 itens 6, 7, 8 e 10 — a barra, o descanso e o que se ouve", () => {
  test("24 px separam o ✓ de quem descarta a série, e o player tem h1", async ({
    page,
  }) => {
    await abrirPlayer(page);

    // item 10: a única rota sem h1 passou a ter um
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Treino A — exercício 1 de 6/,
    );
    const barra = page.getByRole("progressbar", { name: "Progresso do treino" });
    await expect(barra).toHaveAttribute("aria-valuetext", "exercício 1 de 6");
    await expect(barra).toHaveAttribute("aria-valuemax", /\d+/);

    // item 10: o rótulo visível diz o que o número é
    const rotulo = page.getByText("carga na barra", { exact: true }).first();
    await expect(rotulo).toBeVisible();
    await expect(rotulo).toHaveCSS("text-transform", "uppercase");

    // item 6
    const concluir = page.getByRole("button", { name: "Concluir série" });
    const proximo = page.getByRole("button", { name: "Próximo passo" });
    const a = await concluir.boundingBox();
    const b = await proximo.boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect((b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0))).toBeGreaterThanOrEqual(24);
  });

  test("gravar a série é anunciado, e o descanso tem anel, ±20 s e aviso sem som", async ({
    page,
  }) => {
    await abrirPlayer(page);
    await page.getByRole("button", { name: "Concluir série" }).click();

    // item 8: o descanso ganhou o anel da preparação
    const descanso = page.locator('[data-tela="descanso"]');
    await expect(descanso).toBeVisible();

    /*
     * item 10: o leitor de tela ouve o que foi gravado. O aviso viaja para a
     * tela de descanso porque a de exercício sai do ar no MESMO toque que
     * grava — o `status` dela nunca chegaria a ser lido.
     */
    await expect(descanso.getByRole("status")).toContainText(
      /registrada.*repetições/,
    );
    await expect(descanso.locator('svg[viewBox="0 0 220 220"] circle')).toHaveCount(2);
    await expect(descanso.getByRole("timer", { name: "Descanso" })).toBeVisible();

    // item 7: os dois botões de tempo dizem o sinal em texto, com 56 px
    const mais = page.getByRole("button", { name: "Somar 20 segundos ao descanso" });
    const menos = page.getByRole("button", { name: "Tirar 20 segundos do descanso" });
    await expect(mais).toContainText("20 s");
    await expect(menos).toContainText("20 s");
    for (const alvo of [mais, menos]) {
      const caixa = await alvo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(56);
      expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
    }

    // item 8: "Pular descanso" deixou de ser o botão mais forte da tela
    const pular = page.getByRole("button", { name: "Pular descanso" });
    await expect(pular).toBeVisible();
    const fundos = await pular.evaluate((no) => ({
      botao: getComputedStyle(no).backgroundColor,
      tela: getComputedStyle(no.closest("section") as Element).backgroundColor,
    }));
    // contorno sobre o marrom: o fundo do botão é o da própria tela
    expect(fundos.botao).toBe("rgba(0, 0, 0, 0)");
    expect(fundos.tela).not.toBe("rgba(0, 0, 0, 0)");

    /*
     * item 7: o aviso só-leitor existe ao lado do `role="timer"` (que tem
     * `aria-live` desligado). Com o relógio fixo (`fixarData`) a contagem não
     * anda, então o que se cobra aqui é o contrato; os textos dos marcos são
     * do `avisoDoDescanso`, testado na unidade.
     */
    await expect(descanso.locator('p[role="status"].sr-only')).toHaveCount(1);
  });
});

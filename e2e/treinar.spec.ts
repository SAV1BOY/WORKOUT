/**
 * A sessão de força de ponta a ponta (SPEC §3.2, §6, §8, §10.3 e §10.4),
 * num Chromium de 360 × 740 contra o mock do Supabase.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  abrirVisaoGeral,
  atualizarNoMock,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  type SessaoMock,
  usuarioComPerfil,
} from "./fixtures";

/** 14/09/2026 é a segunda-feira que abre o programa: Treino A (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

interface LinhaSessao {
  id: string;
  workout_id: string;
  status: string;
  fase: string;
  data: string;
  sensacao: number | null;
  duracao_s: number | null;
}

interface LinhaSerie {
  exercise_id: string;
  set_index: number;
  tipo: string;
  reps: number | null;
  carga_kg: number | null;
  concluida: boolean;
  ultima_firme: boolean | null;
}

test.beforeEach(async () => {
  await resetarMock();
});

/** Entra, vai para "Treinar" e começa o Treino A. */
async function comecarTreinoA(page: Page): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil();
  await fixarData(page, SEGUNDA);
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
  /*
   * SPEC §14.1: o caminho principal agora é o player. A folha de rolagem com
   * todas as séries virou a **visão geral**, atrás do ícone de lista — é nela
   * que estes testes continuam valendo, série a série.
   */
  await abrirVisaoGeral(page);
  await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
  return sessao;
}

/** Marca a série `n` do exercício e espera o visto ficar marcado. */
async function marcar(page: Page, exercicio: string, n: number) {
  const grupo = page.getByRole("group", { name: `Série ${n} — ${exercicio}` });
  const visto = grupo.getByRole("checkbox");
  await visto.click();
  await expect(visto).toHaveAttribute("aria-checked", "true");
}

test.describe("começar o treino (SPEC §3.2)", () => {
  test("o Treino A abre com os 6 blocos, o aquecimento e as cargas de hoje", async ({
    page,
  }) => {
    const sessao = await comecarTreinoA(page);

    await expect(page.getByRole("heading", { name: "1. Agachamento livre" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "6. Elevação de pernas na barra fixa" })).toBeVisible();

    // SPEC §3.2: duas linhas de aquecimento no primeiro exercício pesado
    await expect(
      page.getByRole("group", { name: "Aquecimento 1 — Agachamento livre" }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Aquecimento 2 — Agachamento livre" }),
    ).toBeVisible();
    // e em mais nenhum (o supino também é pesado, mas o aquecimento é um só)
    await expect(
      page.getByRole("group", { name: "Aquecimento 1 — Supino reto com barra" }),
    ).toHaveCount(0);

    // SPEC §10.2 e §4: o rótulo certo por implemento
    await expect(page.getByText("Hoje: 7,5 kg na barra").first()).toBeVisible();
    await expect(page.getByText("Hoje: 1,5 kg por halter")).toBeVisible();
    await expect(page.getByText("Hoje: peso do corpo")).toBeVisible();

    // a sessão nasceu com um uuid do cliente e já chegou ao banco (§8)
    await expect
      .poll(async () => (await lerDoMock<LinhaSessao>(sessao, "sessions")).length)
      .toBe(1);
    const [linha] = await lerDoMock<LinhaSessao>(sessao, "sessions");
    expect(linha).toMatchObject({
      workout_id: "A1",
      fase: "fase1",
      status: "em_andamento",
      data: "2026-09-14",
    });
    expect(page.url()).toContain(linha?.id ?? "sem-id");

    await semRolagemHorizontal(page);
  });

  test("um treino aberto leva direto para ele", async ({ page }) => {
    await comecarTreinoA(page);
    const url = page.url();

    await page.goto("/treinar");
    await expect(page).toHaveURL(url);
  });
});

test.describe("registrar série a série (SPEC §3.2 e §10.3)", () => {
  /*
   * O − e o + com o campo AINDA focado (SPEC §22.11). No Chromium tocar num
   * `<button>` tira o foco do `<input>`, e o `blur` reconcilia o texto: por
   * isso os outros testes daqui não alcançam este caminho. No Safari do
   * iPhone tocar num botão **não** move o foco — e o campo ficava mostrando o
   * número velho enquanto o valor já tinha andado.
   *
   * `dispatchEvent("click")` é o que reproduz isso num Chromium: dispara o
   * clique sem entrada de verdade, então o foco não sai do campo.
   */
  test("o − e o + acertam o campo mesmo com o foco dentro dele", async ({ page }) => {
    await comecarTreinoA(page);
    const primeira = page.getByRole("group", { name: "Série 1 — Agachamento livre" });
    const campo = primeira.getByRole("textbox", { name: "carga na barra" });

    await campo.click();
    await expect(campo).toBeFocused();

    await primeira
      .getByRole("button", { name: "Aumentar carga na barra" })
      .dispatchEvent("click");

    // o foco continua no campo: é o mundo do Safari
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue("11,5");

    await primeira
      .getByRole("button", { name: "Diminuir carga na barra" })
      .dispatchEvent("click");
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue("7,5");

    // e a digitação continua sendo do dedo depois do toque no botão: sem isto,
    // o efeito voltaria a reescrever o campo no meio de "12,5"
    await campo.fill("");
    await campo.pressSequentially("12,5", { delay: 60 });
    await expect(campo).toHaveValue("12,5");
  });

  test("três séries pelos steppers, sem teclado, e o timer de descanso", async ({
    page,
  }) => {
    const sessao = await comecarTreinoA(page);
    const primeira = page.getByRole("group", { name: "Série 1 — Agachamento livre" });

    // a carga anda só em cargas alcançáveis: 7,5 → 11,5 (incremento 4 kg, §6.4)
    await primeira.getByRole("button", { name: "Aumentar carga na barra" }).click();
    await expect(primeira.getByRole("textbox", { name: "carga na barra" })).toHaveValue(
      "11,5",
    );
    await primeira.getByRole("button", { name: "Diminuir carga na barra" }).click();
    await expect(primeira.getByRole("textbox", { name: "carga na barra" })).toHaveValue(
      "7,5",
    );
    // e as repetições de 1 em 1
    await primeira.getByRole("button", { name: "Aumentar repetições" }).click();
    await expect(primeira.getByRole("textbox", { name: "repetições" })).toHaveValue("6");
    await primeira.getByRole("button", { name: "Diminuir repetições" }).click();
    await expect(primeira.getByRole("textbox", { name: "repetições" })).toHaveValue("5");

    await marcar(page, "Agachamento livre", 1);

    // SPEC §3.2: o descanso do exercício (150 s) começa na barra do topo
    const timer = page.getByRole("timer", { name: "Descanso" });
    await expect(timer).toBeVisible();
    await expect(timer).toContainText("2:30");
    await expect(timer).toContainText("Agachamento livre");

    await marcar(page, "Agachamento livre", 2);
    await marcar(page, "Agachamento livre", 3);
    await expect(page.getByText("3/16 séries")).toBeVisible();

    // cada série concluída sobe sozinha, por id (§8)
    await expect
      .poll(async () =>
        (await lerDoMock<LinhaSerie>(sessao, "session_sets")).filter(
          (s) => s.exercise_id === "agachamento-livre" && s.tipo === "trabalho",
        ).length,
      )
      .toBe(3);

    const series = (await lerDoMock<LinhaSerie>(sessao, "session_sets")).filter(
      (s) => s.tipo === "trabalho",
    );
    expect(series.map((s) => s.set_index).sort()).toEqual([1, 2, 3]);
    expect(series.every((s) => s.concluida && s.reps === 5 && s.carga_kg === 7.5)).toBe(
      true,
    );

    await semRolagemHorizontal(page);
  });

  test("recarregar no meio do treino volta exatamente onde parou (§8)", async ({
    page,
  }) => {
    await comecarTreinoA(page);
    const grupo = page.getByRole("group", { name: "Série 1 — Agachamento livre" });
    await grupo.getByRole("button", { name: "Aumentar carga na barra" }).click();
    await marcar(page, "Agachamento livre", 1);
    await expect(page.getByText("1/16 séries")).toBeVisible();

    await page.reload();

    await abrirVisaoGeral(page);
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
    const depois = page.getByRole("group", { name: "Série 1 — Agachamento livre" });
    await expect(depois.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    await expect(depois.getByRole("textbox", { name: "carga na barra" })).toHaveValue(
      "11,5",
    );
    // a série 2 herdou os valores da 1 (SPEC §3.2)
    await expect(
      page
        .getByRole("group", { name: "Série 2 — Agachamento livre" })
        .getByRole("textbox", { name: "carga na barra" }),
    ).toHaveValue("11,5");
    await expect(page.getByText("1/16 séries")).toBeVisible();
  });

  test("sem rede as séries continuam sendo registradas e sobem depois (§8)", async ({
    page,
    context,
  }) => {
    const sessao = await comecarTreinoA(page);
    await marcar(page, "Agachamento livre", 1);
    await expect
      .poll(async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length)
      .toBe(1);

    await context.setOffline(true);
    await marcar(page, "Agachamento livre", 2);
    await marcar(page, "Agachamento livre", 3);
    await expect(page.getByText("3/16 séries")).toBeVisible();
    await expect(page.getByText(/para sincronizar/)).toBeVisible();
    // o banco continua com uma só: nada se perdeu, nada foi inventado
    expect(await lerDoMock<LinhaSerie>(sessao, "session_sets")).toHaveLength(1);

    await context.setOffline(false);
    await expect
      .poll(async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length, {
        timeout: 15_000,
      })
      .toBe(3);
    await expect(page.getByText("· sincronizado")).toBeVisible();
  });
});

test.describe("concluir e o que o motor decide (SPEC §6.2, §6.6, §10.3 e §10.4)", () => {
  test("tudo no topo com a última firme: resumo ↑ e a carga sobe no próximo treino", async ({
    page,
  }) => {
    const sessao = await comecarTreinoA(page);

    // o agachamento inteiro no topo da faixa (3 × 5 com 7,5 kg)
    for (const n of [1, 2, 3]) await marcar(page, "Agachamento livre", n);

    await page.getByRole("button", { name: "Concluir" }).click();
    const resumo = page.getByRole("dialog");
    await expect(resumo.getByText("Treino concluído")).toBeVisible();

    const linha = resumo
      .getByRole("list", { name: "Resumo por exercício" })
      .getByRole("listitem")
      .filter({ hasText: "Agachamento livre" });
    await expect(linha).toContainText("↑");
    await expect(linha).toContainText("7,5 → 11,5 kg na barra");

    // recorde de carga: é a primeira vez que o agachamento é registrado (§6.6)
    await expect(resumo.getByRole("list", { name: "Recordes" })).toContainText(
      "Agachamento livre",
    );

    await resumo.getByRole("radio", { name: "Um pouco fácil" }).click();
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();

    await esperarAbaTreino(page);

    /*
     * O banco recebeu a decisão inteira (§6.6 e §8). A fila grava na ordem —
     * séries, estados, eventos, perfil —, então esperar o `ultimo_treino` é
     * esperar tudo que vem antes dele.
     */
    await expect
      .poll(
        async () =>
          (await lerDoMock<{ ultimo_treino: string | null }>(sessao, "profiles"))[0]
            ?.ultimo_treino,
        { timeout: 15_000 },
      )
      .toBe("A1");

    const estados = await lerDoMock<{ exercise_id: string; carga_atual_kg: number }>(
      sessao,
      "exercise_state",
    );
    expect(estados.find((e) => e.exercise_id === "agachamento-livre")).toMatchObject({
      carga_atual_kg: 11.5,
    });

    const eventos = await lerDoMock<{
      exercise_id: string;
      motivo: string;
      de: { carga_kg: number };
      para: { carga_kg: number };
    }>(sessao, "progression_events");
    expect(eventos.find((e) => e.exercise_id === "agachamento-livre")).toMatchObject({
      motivo: "subiu",
      de: { carga_kg: 7.5 },
      para: { carga_kg: 11.5 },
    });

    const [treino] = await lerDoMock<LinhaSessao>(sessao, "sessions");
    expect(treino).toMatchObject({ status: "concluida", sensacao: 4 });

    /*
     * §10.4: "a próxima sessão mostra a carga + incremento". O próximo Treino A
     * vem depois de um Treino B (§5.2), então é assim que a Hoje o mostra.
     */
    await atualizarNoMock(sessao, "profiles", `user_id=eq.${sessao.userId}`, {
      ultimo_treino: "B1",
    });
    /*
     * Meia hora depois, no mesmo dia: o cache do TanStack Query (§8) guarda a
     * leitura por 30 s, e com o relógio parado em 08:00 ele nunca envelheceria.
     */
    await fixarData(page, "2026-09-14T08:30:00-03:00");
    await page.reload();
    await expect(
      page.getByText("Hoje: 11,5 kg na barra (subiu +4 kg no treino de 14/09)"),
    ).toBeVisible();
  });

  test("sem a última firme o exercício repete a carga (§6.2)", async ({ page }) => {
    const sessao = await comecarTreinoA(page);
    for (const n of [1, 2, 3]) await marcar(page, "Agachamento livre", n);

    await page
      .getByRole("switch", { name: "Última repetição firme no Agachamento livre" })
      .click();

    await page.getByRole("button", { name: "Concluir" }).click();
    const linha = page
      .getByRole("dialog")
      .getByRole("list", { name: "Resumo por exercício" })
      .getByRole("listitem")
      .filter({ hasText: "Agachamento livre" });
    await expect(linha).toContainText("repetiu 7,5 kg na barra");

    await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);

    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ exercise_id: string; motivo: string }>(
              sessao,
              "progression_events",
            )
          ).find((e) => e.exercise_id === "agachamento-livre")?.motivo,
        { timeout: 15_000 },
      )
      .toBe("repetiu");
  });

  test("abandonar guarda o que foi registrado e não move a alternância (§6.3)", async ({
    page,
  }) => {
    const sessao = await comecarTreinoA(page);
    await marcar(page, "Agachamento livre", 1);

    // SPEC §22.5 item 1: o descarte pede um AlertDialog, não um 2º toque
    await page.getByRole("button", { name: "Descartar este treino" }).click();
    const pergunta = page.getByRole("alertdialog");
    await expect(pergunta).toContainText("Descartar este treino?");
    await pergunta.getByRole("button", { name: "Descartar este treino" }).click();
    /*
     * O resumo do abandono não pode dizer "Treino concluído" — e agora é
     * preciso nomear o diálogo: desde a §22.5 item 3 a própria Visão geral é
     * um `role="dialog"`.
     */
    const resumo = page.getByRole("dialog", { name: "Treino abandonado" });
    await expect(resumo).toContainText("Treino abandonado");
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);

    await expect
      .poll(async () => (await lerDoMock<LinhaSessao>(sessao, "sessions"))[0]?.status, {
        timeout: 15_000,
      })
      .toBe("abandonada");
    expect(await lerDoMock<LinhaSerie>(sessao, "session_sets")).toHaveLength(1);
    // só 1 série de 3: o motor não avalia o exercício incompleto
    expect(await lerDoMock(sessao, "progression_events")).toHaveLength(0);
    const [perfil] = await lerDoMock<{ ultimo_treino: string | null }>(sessao, "profiles");
    expect(perfil?.ultimo_treino).toBeNull();
  });
});

test.describe("ajuda, montagem e substituição (SPEC §3.2, §6.5 e §7)", () => {
  test("a montagem mostra as anilhas por lado", async ({ page }) => {
    await comecarTreinoA(page);

    const grupo = page.getByRole("group", { name: "Série 1 — Agachamento livre" });
    // 7,5 → 25,5 kg: 5 + 4 por lado (SPEC §10.5)
    for (let i = 0; i < 9; i++) {
      await grupo.getByRole("button", { name: "Aumentar carga na barra" }).click();
    }
    await expect(grupo.getByRole("textbox", { name: "carga na barra" })).toHaveValue(
      "43,5",
    );

    await page
      .locator("#bloco-1")
      .getByRole("button", { name: "montagem" })
      .click();
    const folha = page.getByRole("dialog");
    await expect(folha.getByText("por lado")).toBeVisible();
    /*
     * A folha fala da carga que está na barra AGORA (§6.5), não da carga do
     * dia: 43,5 = 7,5 + 2 × 18, e 18 por lado é 10 · 5 · 3 (guloso, §6.5).
     */
    await expect(folha.getByText("43,5 kg na barra")).toBeVisible();
    await expect(
      folha.getByRole("list", { name: /Anilhas por lado/ }).getByRole("listitem"),
    ).toHaveText(["10", "5", "3"]);
    await folha.getByRole("button", { name: "Fechar" }).click();
  });

  test("uma carga digitada que o kit não monta é ajustada e avisada (§6.4 e §10.5)", async ({
    page,
  }) => {
    await comecarTreinoA(page);
    const grupo = page.getByRole("group", { name: "Série 1 — Agachamento livre" });
    const campo = grupo.getByRole("textbox", { name: "carga na barra" });

    // 26,5 kg não existe na escala da barra maciça: cai para 25,5 (SPEC §10.5)
    await campo.fill("26,5");
    await campo.blur();
    await expect(campo).toHaveValue("25,5");
    await expect(
      page.getByText("26,5 kg não fecha com estas anilhas: ficou 25,5 kg na barra."),
    ).toBeVisible();

    await page.locator("#bloco-1").getByRole("button", { name: "montagem" }).click();
    const folha = page.getByRole("dialog");
    await expect(folha.getByText("25,5 kg na barra")).toBeVisible();
    await expect(
      folha.getByRole("list", { name: /Anilhas por lado/ }).getByRole("listitem"),
    ).toHaveText(["5", "4"]);
    await folha.getByRole("button", { name: "Fechar" }).click();

    // e o que sobe para o banco é a carga que dá para montar
    await marcar(page, "Agachamento livre", 1);
  });

  test("a ficha do exercício abre com passos, erro comum e músculos", async ({
    page,
  }) => {
    await comecarTreinoA(page);
    await page.getByRole("button", { name: "Como fazer: Agachamento livre" }).click();

    const ficha = page.getByRole("dialog");
    // SPEC §14.2: a ficha em folha traz instruções, erro comum e as três abas
    await expect(ficha.getByRole("heading", { name: "Instruções" })).toBeVisible();
    await expect(ficha.getByRole("heading", { name: "Erro comum" })).toBeVisible();
    await expect(ficha.getByRole("img", { name: /Execução: Agachamento livre/ })).toBeVisible();
    await ficha.getByRole("tab", { name: "Músculos" }).click();
    await expect(ficha.getByRole("img", { name: "Frente" })).toBeVisible();
    await semRolagemHorizontal(page);

    // o X da folha também é alvo de dedo (SPEC §3: ≥ 44 px)
    const fechar = ficha.getByRole("button", { name: "Fechar" }).last();
    const caixa = await fechar.boundingBox();
    expect(Math.round(caixa?.width ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(caixa?.height ?? 0)).toBeGreaterThanOrEqual(44);

    await fechar.click();
  });

  test("substituir hoje troca o exercício do bloco e o registro vai para ele", async ({
    page,
  }) => {
    const sessao = await comecarTreinoA(page);

    await page.locator("#bloco-1").getByRole("button", { name: "substituir hoje" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Agachamento frontal/ }).click();

    await expect(page.getByRole("heading", { name: "1. Agachamento frontal" })).toBeVisible();
    await expect(page.getByText("no lugar de Agachamento livre (só hoje)")).toBeVisible();

    await marcar(page, "Agachamento frontal", 1);
    await expect
      .poll(async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length)
      .toBe(1);
    const [serie] = await lerDoMock<LinhaSerie>(sessao, "session_sets");
    expect(serie?.exercise_id).toBe("agachamento-frontal");
  });

  /*
   * SPEC §6.3: "o substituto usa o próprio estado". Com 31,5 kg gravados no
   * agachamento frontal, a troca tem de partir dos 31,5 — e o upsert do fim
   * também, senão a progressão real do exercício é apagada.
   */
  test("o substituto abre com a carga dele e a conclusão parte dela (§6.3)", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "exercise_state", [
      { exercise_id: "agachamento-frontal", carga_atual_kg: 31.5, reps_alvo: 8 },
    ]);
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    /*
     * A sessão carrega o estado e os recordes de todos os substitutos, não só
     * dos exercícios do treino — sem isso a troca começaria do zero.
     */
    const leituras = Promise.all(
      ["exercise_state", "v_records"].map((tabela) =>
        page.waitForResponse(
          (r) =>
            r.url().includes(`/rest/v1/${tabela}?`) &&
            r.url().includes("agachamento-frontal") &&
            r.status() === 200,
        ),
      ),
    );
    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
    await leituras;

    await page.locator("#bloco-1").getByRole("button", { name: "substituir hoje" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Agachamento frontal/ })
      .click();

    const bloco = page.locator("#bloco-1");
    await expect(bloco).toContainText("Hoje: 31,5 kg na barra");

    // 3 × 8 (topo da faixa 6–8) com a última firme: +2 kg a partir de 31,5
    for (const n of [1, 2, 3]) {
      const grupo = page.getByRole("group", { name: `Série ${n} — Agachamento frontal` });
      await expect(grupo.getByRole("textbox", { name: "carga na barra" })).toHaveValue(
        "31,5",
      );
      await expect(grupo.getByRole("textbox", { name: "repetições" })).toHaveValue("8");
      await marcar(page, "Agachamento frontal", n);
    }

    await page.getByRole("button", { name: "Concluir" }).click();
    const resumo = page.getByRole("dialog");
    await expect(
      resumo
        .getByRole("list", { name: "Resumo por exercício" })
        .getByRole("listitem")
        .filter({ hasText: "Agachamento frontal" }),
    ).toContainText("31,5 → 33,5 kg na barra");
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);

    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ exercise_id: string; carga_atual_kg: number }>(
              sessao,
              "exercise_state",
            )
          ).find((e) => e.exercise_id === "agachamento-frontal")?.carga_atual_kg,
        { timeout: 15_000 },
      )
      .toBe(33.5);

    const estados = await lerDoMock<{ exercise_id: string; reps_alvo: number | null }>(
      sessao,
      "exercise_state",
    );
    // o exercício que saiu do lugar não é tocado (§6.3)
    expect(estados.find((e) => e.exercise_id === "agachamento-livre")).toBeUndefined();
    expect(estados.find((e) => e.exercise_id === "agachamento-frontal")?.reps_alvo).toBe(8);

    /*
     * `progression_events` é uma escrita SEPARADA na fila de saída (§8): a
     * linha de `exercise_state` pode chegar ao mock antes dela. Ler de uma vez
     * era uma corrida — a auditoria do V3 pegou a falha nesse ponto. A
     * asserção continua a mesma; só o "quando" espera a fila.
     */
    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ exercise_id: string; de: { carga_kg: number } }>(
              sessao,
              "progression_events",
            )
          ).find((e) => e.exercise_id === "agachamento-frontal")?.de,
        { timeout: 15_000 },
      )
      .toMatchObject({ carga_kg: 31.5 });
  });
});

/** Entra na Fase 2 e começa um treino pelo nome (sem congelar o relógio). */
async function comecarTreinoDaFase2(page: Page, nome: string): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil({
    fase_atual: "fase2",
    fase_desde: "2026-06-01",
  });
  await entrarNoApp(page);
  await page.goto("/treinar");
  await page.getByRole("button", { name: `Começar o ${nome}` }).click();
  await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
  await abrirVisaoGeral(page);
  return sessao;
}

test.describe("cronômetro dos exercícios de tempo (SPEC §3.2 e §8)", () => {
  /*
   * O cronômetro corre num `setInterval` e devolve o valor pela sessão inteira.
   * Se ele guardar a versão da sessão de quando começou, cada tique desfaz o
   * que foi registrado no meio — um visto marcado noutro bloco voltava a "não
   * feito" 250 ms depois. Registro perdido é o que a §8 proíbe.
   */
  test("o cronômetro rodando não desfaz o que foi marcado", async ({ page }) => {
    const sessao = await comecarTreinoDaFase2(page, "Inferior A");
    const prancha = page.getByRole("group", { name: "Série 1 — Prancha" });
    await prancha.getByRole("button", { name: /Cronômetro/ }).click();
    await page.waitForTimeout(1_200);

    // com o cronômetro correndo, marcar uma série de outro bloco tem de pegar
    const visto = page
      .getByRole("group", { name: "Série 1 — Agachamento livre" })
      .getByRole("checkbox");
    await visto.click();
    await page.waitForTimeout(1_200);
    await expect(visto).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("1/20 séries")).toBeVisible();

    // e marcar a própria série do cronômetro para a contagem
    const vistoPrancha = prancha.getByRole("checkbox");
    await vistoPrancha.click();
    const campo = prancha.getByRole("textbox", { name: "segundos" });
    const parado = await campo.inputValue();
    await page.waitForTimeout(1_200);
    await expect(vistoPrancha).toHaveAttribute("aria-checked", "true");
    await expect(campo).toHaveValue(parado);

    // o tempo cronometrado subiu para o banco (§8)
    await expect
      .poll(async () =>
        (await lerDoMock<{ exercise_id: string; tempo_s: number | null }>(
          sessao,
          "session_sets",
        )).find((l) => l.exercise_id === "prancha")?.tempo_s,
      )
      .toBe(Number(parado));
  });
});

test.describe("celular (SPEC §3 e §10.9)", () => {
  test("todo alvo da sessão tem 44 px e nada rola para o lado", async ({ page }) => {
    await comecarTreinoA(page);

    const alvos = page.locator(
      "#bloco-1 button, #bloco-1 [role=checkbox], #bloco-1 input",
    );
    const quantos = await alvos.count();
    expect(quantos).toBeGreaterThan(5);
    for (let i = 0; i < quantos; i++) {
      const caixa = await alvos.nth(i).boundingBox();
      if (!caixa) continue;
      const nome = await alvos.nth(i).getAttribute("aria-label");
      expect(
        Math.round(caixa.height),
        `alvo ${i} (${nome}) do primeiro bloco com menos de 44 px de altura`,
      ).toBeGreaterThanOrEqual(44);
      /*
       * Auditoria final: a regra é 44 px nas DUAS dimensões. Na grade de duas
       * colunas (reps + carga) o campo do stepper fechava em 37 px de largura
       * — e ele é o alvo de quem digita em vez de usar o − e o +.
       */
      expect(
        Math.round(caixa.width),
        `alvo ${i} (${nome}) do primeiro bloco com menos de 44 px de largura`,
      ).toBeGreaterThanOrEqual(44);
    }

    await semRolagemHorizontal(page);
  });
});

test.describe("timer, tela acesa e voltar sem rede (SPEC §3.2, §8 e §10.3)", () => {
  test("o descanso zera vibrando, aceita +30 s e pular; a tela fica acesa", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const janela = window as unknown as { __vibrou: unknown[]; __tela: string[] };
      janela.__vibrou = [];
      janela.__tela = [];
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: (padrao: unknown) => {
          janela.__vibrou.push(padrao);
          return true;
        },
      });
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          request: async () => {
            janela.__tela.push("pedido");
            return {
              released: false,
              release: async () => {
                janela.__tela.push("solto");
              },
            };
          },
        },
      });
    });

    await comecarTreinoA(page);
    // Wake Lock pedido assim que a sessão abre (SPEC §3.2)
    await expect
      .poll(async () => page.evaluate(() => (window as never as { __tela: string[] }).__tela))
      .toEqual(["pedido"]);

    // a partir daqui o relógio é nosso: o descanso do agachamento é 2:30
    await page.clock.install();
    await marcar(page, "Agachamento livre", 1);
    const timer = page.getByRole("timer", { name: "Descanso" });
    await expect(timer).toContainText("2:30");

    await timer.getByRole("button", { name: "30 s" }).click();
    await expect(timer).toContainText("3:00");

    /*
     * "+30 s" soma ao que FALTA. Meio descanso depois (1:00 no relógio), o
     * botão tem de levar de 2:00 para 2:30 — e não recomeçar em 3:00.
     */
    await page.clock.runFor("01:00");
    await expect(timer).toContainText("2:00");
    await timer.getByRole("button", { name: "30 s" }).click();
    await expect(timer).toContainText("2:30");

    await page.clock.runFor("02:31");
    await expect(timer).toContainText("vai!");
    expect(
      await page.evaluate(() => (window as never as { __vibrou: unknown[] }).__vibrou),
    ).toHaveLength(1);
    await timer.getByRole("button", { name: "Fechar" }).click();
    await expect(timer).toHaveCount(0);

    // pular fecha o timer sem esperar
    await marcar(page, "Agachamento livre", 2);
    await expect(timer).toBeVisible();
    await timer.getByRole("button", { name: "Pular" }).click();
    await expect(timer).toHaveCount(0);

    /*
     * Sair da sessão solta o Wake Lock. O player é tela cheia (§14.1): a saída
     * é o "Continuar depois" da visão geral, não a barra de abas.
     */
    await page.getByRole("link", { name: "Continuar depois" }).click();
    await esperarAbaTreino(page);
    await expect
      .poll(async () => page.evaluate(() => (window as never as { __tela: string[] }).__tela))
      .toEqual(["pedido", "solto"]);
  });

  test("fechar o app sem rede e abrir de novo: a sessão volta inteira (§8 e §10.3)", async ({
    page,
    context,
  }) => {
    const sessao = await comecarTreinoA(page);
    const url = page.url();
    // "o app instalado": só com o service worker no controle uma aba nova
    // abre a sessão sem rede (o precache leva quase um segundo para fechar)
    await esperarServiceWorker(page);
    await page.reload();
    await abrirVisaoGeral(page);
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();

    await marcar(page, "Agachamento livre", 1);
    await context.setOffline(true);
    await marcar(page, "Agachamento livre", 2);
    await marcar(page, "Agachamento livre", 3);
    await expect(page.getByText("3/16 séries")).toBeVisible();

    // o app "morreu" no bolso: a aba fecha e outra abre na mesma URL, sem rede
    await page.close();
    const voltou = await context.newPage();
    await fixarData(voltou, SEGUNDA);
    await voltou.goto(url);
    await abrirVisaoGeral(voltou);
    await expect(voltou.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
    await expect(voltou.getByText("3/16 séries")).toBeVisible();
    await expect(
      voltou.getByRole("group", { name: "Série 3 — Agachamento livre" }).getByRole("checkbox"),
    ).toHaveAttribute("aria-checked", "true");
    await expect(voltou.getByText(/para sincronizar/)).toBeVisible();

    // a rede voltou: nada se perdeu no caminho
    await context.setOffline(false);
    await expect
      .poll(
        async () =>
          (await lerDoMock<LinhaSerie>(sessao, "session_sets")).filter((s) => s.concluida)
            .length,
        { timeout: 30_000 },
      )
      .toBe(3);
  });
});

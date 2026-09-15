/**
 * A sessão de força de ponta a ponta (SPEC §3.2, §6, §8, §10.3 e §10.4),
 * num Chromium de 360 × 740 contra o mock do Supabase.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  atualizarNoMock,
  entrarNoApp,
  fixarData,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
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
  await page.getByRole("link", { name: "Começar treino" }).click();
  await page.getByRole("button", { name: "Começar Treino A" }).click();
  await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
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

    await page.getByRole("link", { name: "Treinar" }).click();
    await expect(page).toHaveURL(url);
  });
});

test.describe("registrar série a série (SPEC §3.2 e §10.3)", () => {
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

    await resumo.getByRole("radio", { name: "4 — bom" }).click();
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();

    await expect(page.getByRole("heading", { name: "Hoje", level: 1 })).toBeVisible();

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
    await expect(page.getByRole("heading", { name: "Hoje", level: 1 })).toBeVisible();

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

    await page.getByRole("button", { name: "Abandonar" }).click();
    await page.getByRole("button", { name: "Confirmar abandono" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();
    await expect(page.getByRole("heading", { name: "Hoje", level: 1 })).toBeVisible();

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
    // a carga de hoje continua 7,5 kg (o cabeçalho não muda com a série)
    await expect(folha.getByText("7,5 kg na barra")).toBeVisible();
    await folha.getByRole("button", { name: "Fechar" }).click();
  });

  test("a ficha do exercício abre com passos, erro comum e músculos", async ({
    page,
  }) => {
    await comecarTreinoA(page);
    await page.getByRole("button", { name: "Como fazer: Agachamento livre" }).click();

    const ficha = page.getByRole("dialog");
    await expect(ficha.getByRole("heading", { name: "Passos" })).toBeVisible();
    await expect(ficha.getByRole("heading", { name: "Erro comum" })).toBeVisible();
    await expect(ficha.getByRole("img", { name: /Execução do Agachamento livre/ })).toBeVisible();
    await expect(ficha.getByRole("img", { name: "Frente" })).toBeVisible();
    await semRolagemHorizontal(page);
    await ficha.getByRole("button", { name: "Fechar" }).click();
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
      expect(
        Math.round(caixa.height),
        `alvo ${i} do primeiro bloco menor que 44 px`,
      ).toBeGreaterThanOrEqual(44);
    }

    await semRolagemHorizontal(page);
  });
});

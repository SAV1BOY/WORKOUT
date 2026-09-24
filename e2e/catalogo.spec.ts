import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  fixarData,
  irNaAba,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Os ids que `data/programa.json` usa — a conta do filtro "no meu programa". */
function idsDoPrograma(): string[] {
  const bruto = readFileSync(resolve(__dirname, "../data/programa.json"), "utf8");
  const programa = JSON.parse(bruto) as {
    treinos: Record<string, { exercicios: { exercicio_id: string }[] }>;
  };
  const ids = new Set<string>();
  for (const treino of Object.values(programa.treinos)) {
    for (const item of treino.exercicios) ids.add(item.exercicio_id);
  }
  return [...ids];
}

const TOTAL = 81;

/**
 * SPEC §22.9 item 2: o catálogo monta 20 cartões de cada vez. Quem conta
 * cartões abre a lista toda antes — o que o teste verifica (quais exercícios
 * o filtro deixa passar) é o mesmo; só o que está montado mudou.
 */
async function verTudo(page: Page): Promise<void> {
  const ver = page.getByRole("button", { name: /^Ver mais/ });
  for (let i = 0; i < 10 && (await ver.isVisible()); i += 1) await ver.click();
  await expect(ver).toBeHidden();
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("Catálogo (SPEC §3.6)", () => {
  test("lista os 81, busca sem acento e abre a ficha com figura e músculos", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page);
    await entrarNoApp(page);

    await irNaAba(page, "Relatório");
    await page.getByRole("link", { name: "Catálogo de exercícios" }).click();
    await expect(page.getByRole("heading", { name: "Exercícios" })).toBeVisible();
    await expect(page.getByText(`${TOTAL} exercícios`, { exact: true })).toBeVisible();
    await semRolagemHorizontal(page);

    // busca sem acento: "triceps" acha os "Tríceps"
    const busca = page.getByLabel("Buscar exercício pelo nome");
    await busca.fill("triceps");
    await expect(page.getByText(/de 81 exercícios$/)).toBeVisible();
    const primeiro = page.getByRole("link").filter({ hasText: "Tríceps" }).first();
    await expect(primeiro).toBeVisible();

    // e a ficha de um exercício do programa
    await busca.fill("supino reto");
    await page.getByRole("link", { name: /Supino reto com barra/ }).first().click();

    await expect(
      page.getByRole("heading", { name: "Supino reto com barra", level: 1 }),
    ).toBeVisible();
    await expect(
      // SPEC §22.13 item 5: a figura diz a posição
      page.getByRole("img", { name: /^Execução: Supino reto com barra, posição \d de 2$/ }),
    ).toBeVisible();
    // as duas fotos e, na aba Músculos (SPEC §14.2), o mapa frente/costas
    await expect(page.getByRole("button", { name: /Ampliar a foto/ })).toHaveCount(2);
    // SPEC §22.14 item 3(b): na página os músculos ficam só na aba Músculos
    await expect(page.getByRole("list", { name: "Área de foco" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Músculos" }).click();
    await expect(page.getByRole("img", { name: "Frente" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Costas" })).toBeVisible();
    await expect(page.getByRole("tabpanel")).toContainText("Peitoral");

    // conteúdo do JSON: instruções, erro comum, prescrição, carga inicial e regra
    await expect(page.getByRole("heading", { name: "Instruções" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Pegada um pouco mais aberta" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Erro comum" })).toBeVisible();
    await expect(page.getByText("3 × 5–8").first()).toBeVisible();
    await expect(page.getByText("7,5 kg na barra").first()).toBeVisible();

    // histórico vazio: um cartão só, e "Onde você está" não repete a carga
    // inicial e a prescrição das seções acima (SPEC §22.14 item 2)
    await expect(page.getByText("Ainda sem histórico deste exercício")).toBeVisible();
    await expect(page.getByText("Onde você está")).toHaveCount(0);
    await expect(page.getByText(/Sem recorde ainda/)).toHaveCount(0);
    await semRolagemHorizontal(page);
  });

  test("a ficha é protegida: sem sessão vai para o login", async ({ page }) => {
    await usuarioComPerfil();
    await page.goto("/exercicios/supino-reto-com-barra");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("a foto abre em tela cheia", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page);
    await entrarNoApp(page);
    await page.goto("/exercicios/supino-reto-com-barra");

    await page.getByRole("button", { name: /Ampliar a foto do início/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("img", { name: /início do movimento/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
  });

  test('o filtro "no meu programa" reduz para os ids de programa.json', async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page);
    await entrarNoApp(page);
    await page.goto("/exercicios");

    const doPrograma = idsDoPrograma();
    // SPEC §22.12 item 1: "No meu programa" é um chip da folha de filtros
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByRole("button", { name: "No meu programa" }).click();
    await page.getByRole("button", { name: `Ver ${doPrograma.length} exercícios` }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByText(`${doPrograma.length} de ${TOTAL} exercícios`),
    ).toBeVisible();

    // e os cartões são mesmo os do programa
    await verTudo(page);
    const cartoes = page.getByRole("link", { name: /no programa/ });
    await expect(cartoes).toHaveCount(doPrograma.length);

    // um filtro por cima do outro
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByLabel("Grupo").selectOption("Peito");
    await page.getByRole("button", { name: /^Ver \d+ exercícios?$/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const n = await page.getByRole("link", { name: /no programa/ }).count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(doPrograma.length);

    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByRole("button", { name: "Limpar", exact: true }).click();
    await page.getByRole("button", { name: `Ver ${TOTAL} exercícios` }).click();
    await expect(page.getByText(`${TOTAL} exercícios`, { exact: true })).toBeVisible();
    await semRolagemHorizontal(page);
  });

  test("a ficha mostra o histórico e a linha do tempo do motor", async ({ page }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "A1" });
    const { inserirNoMock } = await import("./fixtures");
    await inserirNoMock(sessao, "sessions", [
      {
        id: "11111111-1111-4111-8111-111111111111",
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "concluida",
      },
    ]);
    await inserirNoMock(sessao, "session_sets", [
      {
        id: "22222222-2222-4222-8222-222222222221",
        session_id: "11111111-1111-4111-8111-111111111111",
        exercise_id: "supino-reto-com-barra",
        ordem_ex: 1,
        set_index: 1,
        tipo: "trabalho",
        reps: 8,
        carga_kg: 7.5,
        concluida: true,
        registrada_em: "2026-09-14T12:00:00.000Z",
      },
    ]);
    await inserirNoMock(sessao, "exercise_state", [
      { exercise_id: "supino-reto-com-barra", carga_atual_kg: 9.5 },
    ]);
    await inserirNoMock(sessao, "progression_events", [
      {
        id: "33333333-3333-4333-8333-333333333331",
        exercise_id: "supino-reto-com-barra",
        session_id: "11111111-1111-4111-8111-111111111111",
        data: "2026-09-14",
        de: { carga_kg: 7.5 },
        para: { carga_kg: 9.5 },
        motivo: "subiu",
      },
    ]);

    await fixarData(page, "2026-09-16T08:00:00-03:00");
    await entrarNoApp(page);
    await page.goto("/exercicios/supino-reto-com-barra");

    await expect(page.getByText("9,5 kg na barra").first()).toBeVisible();
    await expect(page.getByText("Recorde", { exact: true })).toBeVisible();
    await expect(page.getByText("7,5 kg", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Carga por sessão")).toBeVisible();
    await expect(page.getByText("14/09").first()).toBeVisible();
    await expect(page.getByText("subiu +2 kg no treino de 14/09")).toBeVisible();
    await semRolagemHorizontal(page);
  });
});

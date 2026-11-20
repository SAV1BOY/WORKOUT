import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, entrarNoApp, esperarServiceWorker, fixarData, inserirNoMock,
  lerDoMock, naFila, resetarMock, semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";
import { ajustar, campo, descanso, dialogo, editor, escolher, personalizar, pronto } from "./montar-modelo";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral } from "./treino-livre-ativo";

const PONTE = "Ponte de glúteos no tatame";
const REMADA = "Remada com elástico";
const FLEXAO = "Flexão de braço";
const busca = (page: Page) => editor(page).getByRole("searchbox", { name: "Buscar exercício pelo nome" });
const grupo = (page: Page) => editor(page).getByRole("combobox", { name: "Grupo muscular", exact: true });
const catalogo = (page: Page) => editor(page).getByRole("list", { name: "Catálogo", exact: true });
const opcao = (page: Page, nome: string) => catalogo(page).getByRole("button").filter({ has: page.getByText(nome, { exact: true }) });
const material = (page: Page) => editor(page).locator("summary").filter({ hasText: "Equipamentos disponíveis" });

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("Peito cruza a busca com tatame e elástico e leva os escolhidos com seus ajustes ao treino offline", async ({ page, context }) => {
  test.slow(); // O treino começa offline no worker e é conferido no servidor após a reconexão.
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await personalizar(page).press("Enter");
  await material(page).press("Enter");
  const inventario = editor(page).getByRole("group", { name: "Equipamento de hoje", exact: true });
  await inventario.getByRole("button", { name: "Só peso do corpo", exact: true }).click();
  for (const nome of ["Tatame", "Elástico (Super Band)"]) {
    await inventario.getByRole("checkbox", { name: nome, exact: true }).check();
  }
  await material(page).press("Enter");
  await escolher(page, PONTE);
  await escolher(page, REMADA);
  await ajustar(page).press("Enter");
  await campo(page, REMADA).selectOption("4");
  await descanso(page, REMADA).fill("95");
  await pronto(page);

  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await busca(page).fill("flexao");
  await expect(catalogo(page).getByRole("button")).toHaveCount(2);
  await expect(grupo(page)).toBeVisible();
  await grupo(page).selectOption("Peito");
  await expect(catalogo(page).getByRole("button")).toHaveCount(1);
  await expect(opcao(page, FLEXAO)).toBeVisible();
  await grupo(page).press("Home");
  await expect(grupo(page)).toHaveValue("todos");
  await expect(busca(page)).toHaveValue("flexao");
  await expect(material(page)).toContainText("Elástico e Tatame");
  await expect(opcao(page, "Flexão fechada")).toBeVisible();
  await expect(opcao(page, "Flexão inclinada")).toHaveCount(0); // Exigiria o banco mesmo dentro de Peito.
  await grupo(page).selectOption("Peito");
  await opcao(page, FLEXAO).press("Space");
  await expect(opcao(page, FLEXAO)).toHaveAttribute("aria-pressed", "true");

  await ajustar(page).press("Enter");
  await expect(campo(page, REMADA)).toHaveValue("4");
  await expect(descanso(page, REMADA)).toHaveValue("95");
  await page.keyboard.press("Escape");
  await expect(ajustar(page)).toBeFocused();
  await expect(grupo(page)).toHaveValue("Peito");
  await expect(busca(page)).toHaveValue("flexao");
  const escolhidos = editor(page).getByRole("list", { name: "Escolhidos", exact: true }).getByRole("button", { name: /^Tirar / });
  const nomes = [PONTE, REMADA, FLEXAO];
  await expect(escolhidos).toHaveCount(nomes.length);
  for (const [i, nome] of nomes.entries()) await expect(escolhidos.nth(i)).toHaveAccessibleName(`Tirar ${nome}`);
  await editor(page).getByRole("button", { name: "Começar com 3 exercícios", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText(nomes.map((nome, i) => `${i + 1}. ${nome}`));
  await expect.poll(() => naFila(page)).toBeGreaterThan(0);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);

  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  const sessoes = await lerDoMock<LinhaSessao>(conta, "sessions");
  expect(sessoes).toMatchObject([{ id, user_id: conta.userId, workout_id: "livre", plano: {
    itens: [{ exercicio_id: "ponte-de-gluteos-no-tatame" }, { exercicio_id: "remada-com-elastico", series: 4 }, { exercicio_id: "flexao-de-braco" }],
    descansos_por_exercicio: { "remada-com-elastico": 95 },
  } }]);
  expect(sessoes[0]?.plano?.equipamento_disponivel?.slice().sort()).toEqual(["super-band", "tatame"]);
});

test("limpar um grupo sem resultados devolve o foco e uma nova montagem começa em Todos", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const nome = "Treino no tatame";
  await inserirNoMock(conta, "modelos_de_treino", [{
    id: crypto.randomUUID(), user_id: conta.userId, nome, exercicios: ["ponte-de-gluteos-no-tatame"],
    equipamento_disponivel: ["tatame"], series_por_exercicio: null, descansos_por_exercicio: null,
  }]);
  await entrarNoApp(page);
  await personalizar(page).press("Enter");
  await busca(page).focus();
  await page.keyboard.press("Tab");
  await expect(grupo(page)).toBeFocused();
  expect((await grupo(page).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await grupo(page).selectOption("Peito");
  await busca(page).fill("remada");
  await expect(editor(page).getByRole("status")).toContainText("Nenhum exercício com os filtros atuais");
  await editor(page).getByRole("button", { name: "Limpar grupo", exact: true }).press("Enter");
  await expect(grupo(page)).toBeFocused();
  await expect(grupo(page)).toHaveValue("todos");
  await expect(busca(page)).toHaveValue("remada");
  await expect(opcao(page, REMADA)).toBeVisible();
  await semRolagemHorizontal(page);

  await grupo(page).selectOption("Peito");
  await editor(page).getByRole("button", { name: "Treinos salvos", exact: true }).press("Enter");
  await dialogo(page, "Treinos salvos").getByRole("button", { name: `Carregar ${nome}`, exact: true }).press("Enter");
  await expect(grupo(page)).toHaveValue("todos");
  await expect(busca(page)).toHaveValue("");
  await expect(material(page)).toContainText("Tatame");
  await expect(editor(page).getByRole("button", { name: `Tirar ${PONTE}`, exact: true })).toBeVisible();
  await grupo(page).selectOption("Peito");
  await page.keyboard.press("Escape");
  await expect(personalizar(page)).toBeFocused();
  await personalizar(page).press("Enter");
  await expect(grupo(page)).toHaveValue("todos");
  await expect(editor(page).getByRole("button", { name: `Tirar ${PONTE}`, exact: true })).toBeVisible();
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
});

import { expect, test, type Locator } from "@playwright/test";
import { acharExercicio } from "../lib/dados";
import {
  abrirVisaoGeral, comecarOTreinoDoDia, entrarNoApp, fixarData, HOJE_FIXO, inserirNoMock,
  lerDoMock, naFila, requisicoesDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";

const SUPINO = "supino-reto-com-barra";
const FLEXAO = acharExercicio("flexao-de-braco");

function verExecucao(folha: Locator) {
  return folha.getByRole("button", { name: "Ver execução de Flexão de braço", exact: true });
}

async function lerExecucao(folha: Locator) {
  const ver = verExecucao(folha);
  await ver.click();
  await expect(ver).toHaveAttribute("aria-expanded", "true");
  const descricao = folha.getByRole("region", { name: "Execução de Flexão de braço", exact: true });
  await expect(descricao.getByText(FLEXAO.montagem, { exact: true })).toBeVisible();
  await expect(descricao.getByRole("listitem")).toHaveText(FLEXAO.passos);
}

const aplicarFlexao = (folha: Locator) =>
  folha.getByRole("list", { name: "Exercícios alternativos" }).getByRole("button", { name: /^Flexão de braço / });

async function escritasNasTabelas() {
  return (await requisicoesDoMock()).filter(r => r.caminho.startsWith("/rest/v1/") && r.metodo !== "GET" && r.metodo !== "HEAD");
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, HOJE_FIXO);
});

test("comparar duas execuções e voltar funciona mesmo em navegador sem agrupamento nativo", async ({ page }) => {
  await usuarioComPerfil();
  await entrarNoApp(page);
  const abrir = page.getByRole("button", { name: "Substituir Supino reto com barra", exact: true });
  await abrir.click();
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  const lista = folha.getByRole("list", { name: "Exercícios alternativos" });
  // O Safari 16.4 abre <details>, mas ignora seu agrupamento por name.
  await lista.locator("details[name]").evaluateAll(elementos => {
    for (const elemento of elementos) elemento.removeAttribute("name");
  });
  const primeira = verExecucao(folha);
  const segunda = lista.getByRole("button", { name: "Ver execução de Supino inclinado com halteres", exact: true });
  await primeira.click();
  await expect(primeira).toHaveAttribute("aria-expanded", "true");
  await segunda.press("Space");
  await expect(segunda).toHaveAttribute("aria-expanded", "true");
  await expect.soft(primeira).toHaveAttribute("aria-expanded", "false");
  await page.evaluate(() => history.back());
  await expect(segunda).toBeFocused();
  await expect(segunda).toHaveAttribute("aria-expanded", "false");
  await expect(folha).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(abrir).toBeFocused();
  expect(await naFila(page)).toBe(0);
});

test("a lista do dia mostra como fazer a flexão com o tatame e só lembra a troca ao aplicá-la", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const anterior = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id: anterior, workout_id: "livre", fase: "fase1", data: "2026-09-13", status: "concluida",
  }]);
  await inserirNoMock(conta, "session_sets", [{
    id: crypto.randomUUID(), session_id: anterior, exercise_id: SUPINO, ordem_ex: 1, set_index: 1,
    tipo: "trabalho", concluida: true, reps: 8, carga_kg: 32.5,
  }]);
  const seriesAntes = await lerDoMock(conta, "session_sets");

  await entrarNoApp(page);
  const lista = page.getByRole("list", { name: "Exercícios de hoje" });
  const abrir = lista.getByRole("button", { name: "Substituir Supino reto com barra" });
  await abrir.click();
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  const entradaDoMaterial = folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" });
  await entradaDoMaterial.click();
  const material = folha.getByRole("group", { name: "Equipamento de hoje", exact: true });
  await material.getByRole("button", { name: "Só peso do corpo" }).click();
  for (const nome of ["Tatame", "Elástico (Super Band)"]) {
    await material.getByRole("checkbox", { name: nome, exact: true }).check();
  }
  await expect(material.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await entradaDoMaterial.click();

  const tatame = folha.getByRole("button", { name: "Tatame", exact: true });
  await tatame.click();
  const antes = await escritasNasTabelas();
  const proximos = folha.getByRole("radio", { name: "Usar nos próximos A1" });
  await proximos.check();
  await lerExecucao(folha);
  await expect(proximos).toBeChecked();
  await expect(tatame).toHaveAttribute("aria-pressed", "true");
  await verExecucao(folha).press("Escape");
  await expect(verExecucao(folha)).toBeFocused();
  await expect(verExecucao(folha)).toHaveAttribute("aria-expanded", "false");
  expect(await naFila(page)).toBe(0);
  expect(await escritasNasTabelas()).toEqual(antes);
  expect(await lerDoMock(conta, "trocas_do_programa")).toEqual([]);

  await aplicarFlexao(folha).click();
  await expect(lista.getByRole("button", { name: "Substituir Flexão de braço" })).toBeVisible();
  await expect.poll(() => lerDoMock(conta, "trocas_do_programa")).toMatchObject([{
    user_id: conta.userId, workout_id: "A1", exercicio_original_id: SUPINO, substituto_id: FLEXAO.id,
  }]);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await escritasNasTabelas()).toEqual([...antes, { metodo: "POST", caminho: "/rest/v1/trocas_do_programa" }]);
  expect(await lerDoMock(conta, "session_sets")).toEqual(seriesAntes);
});

test("a ficha permite desistir depois de ler a execução e escolher a flexão só para este treino", async ({ page }) => {
  const conta = await usuarioComPerfil();
  await entrarNoApp(page);
  const lista = page.getByRole("list", { name: "Exercícios de hoje" });
  const abrirFicha = lista.getByRole("button", { name: "Ficha: Supino reto com barra", exact: true });
  await abrirFicha.click();
  const ficha = page.getByRole("dialog");
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await ficha.getByRole("button", { name: "Tatame", exact: true }).click();
  const antes = await escritasNasTabelas();
  await lerExecucao(ficha);
  await verExecucao(ficha).click();
  await page.keyboard.press("Escape");
  await expect(abrirFicha).toBeFocused();
  expect(await escritasNasTabelas()).toEqual(antes);
  expect(await naFila(page)).toBe(0);

  await abrirFicha.click();
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await expect(ficha.getByRole("radio", { name: "Só neste treino" })).toBeChecked();
  await lerExecucao(ficha);
  await aplicarFlexao(ficha).click();
  await expect(ficha.getByRole("heading", { name: "Flexão de braço", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lista.getByRole("button", { name: "Ficha: Flexão de braço" })).toBeFocused();
  await comecarOTreinoDoDia(page);
  await abrirVisaoGeral(page);
  await expect(page.locator("#bloco-2")).toContainText("no lugar de Supino reto com barra");
  await expect(page.locator("#bloco-2").getByRole("heading", { name: "2. Flexão de braço" })).toBeVisible();
  expect(await lerDoMock(conta, "trocas_do_programa")).toEqual([]);
});

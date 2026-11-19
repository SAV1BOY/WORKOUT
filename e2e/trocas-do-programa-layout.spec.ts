import { expect, test } from "@playwright/test";
import {
  comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, fixarData, HOJE_FIXO,
  lerDoMock, resetarMock, semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";

for (const tema of ["light", "dark"] as const) {
  test(`seletor de troca a 360 px com fonte a 125% no tema ${tema}`, async ({ page }, info) => {
    await resetarMock();
    await usuarioComPerfil();
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await fixarData(page, HOJE_FIXO);
    await entrarNoApp(page);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${tema}\\b`));
    await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
    const abrir = page.getByRole("button", { name: "Substituir Supino reto com barra" });
    await abrir.click();
    const folha = page.getByRole("dialog", { name: "Substituir hoje" });
    const grupo = folha.getByRole("group", { name: "Aplicar a troca" });
    const hoje = grupo.getByRole("radio", { name: "Só neste treino" });
    const proximos = grupo.getByRole("radio", { name: "Usar nos próximos A1" });
    await expect(hoje).toBeChecked();
    await expect(grupo.locator("label")).toHaveCount(2);
    for (const rotulo of await grupo.locator("label").all()) {
      const caixa = await rotulo.boundingBox();
      expect(caixa!.width).toBeGreaterThanOrEqual(44);
      expect(caixa!.height).toBeGreaterThanOrEqual(44);
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(360);
      expect(await rotulo.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await hoje.focus();
    await info.attach(`so-neste-treino-${tema}`, { body: await page.screenshot(), contentType: "image/png" });
    await hoje.press("ArrowRight");
    await expect(proximos).toBeFocused();
    await expect(proximos).toBeChecked();
    await info.attach(`proximos-A1-${tema}`, { body: await page.screenshot(), contentType: "image/png" });

    const ultima = folha.getByRole("list", { name: "Exercícios alternativos" }).getByRole("button").last();
    await ultima.scrollIntoViewIfNeeded();
    await expect(ultima).toBeInViewport({ ratio: 0.95 });
    const geometria = await folha.evaluate(el => ({
      largura: el.scrollWidth - el.clientWidth, rolagem: el.scrollTop,
    }));
    expect(geometria.largura).toBeLessThanOrEqual(1);
    expect(geometria.rolagem).toBeGreaterThan(0);
    await semRolagemHorizontal(page);
    await ultima.press("Escape");
    await expect(folha).toBeHidden();
    await expect(abrir).toBeFocused();
  });
}

test("a ficha do dia lembra a troca e a ficha do player restaura os próximos A1", async ({ page }) => {
  await resetarMock();
  const conta = await usuarioComPerfil();
  await fixarData(page, HOJE_FIXO);
  await entrarNoApp(page);

  await page.getByRole("button", { name: "Ficha: Agachamento livre" }).click();
  const ficha = page.getByRole("dialog");
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await ficha.getByRole("radio", { name: "Usar nos próximos A1" }).check();
  await ficha.getByRole("list", { name: "Exercícios alternativos" })
    .getByRole("button", { name: /^Agachamento goblet / }).click();
  await expect(ficha.getByRole("heading", { name: "Agachamento goblet", exact: true })).toBeVisible();
  await expect.poll(() => lerDoMock(conta, "trocas_do_programa")).toMatchObject([{
    workout_id: "A1", exercicio_original_id: "agachamento-livre", substituto_id: "agachamento-goblet",
  }]);
  await page.keyboard.press("Escape");
  await expect(ficha).toBeHidden();

  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: "Como fazer: Agachamento goblet" }).click();
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await expect(ficha.getByRole("radio", { name: "Só neste treino" })).toBeChecked();
  await ficha.getByRole("button", { name: "Restaurar Agachamento livre nos próximos A1" }).click();
  await expect(ficha.getByRole("heading", { name: "Agachamento goblet", exact: true })).toBeVisible();
  await expect.poll(() => lerDoMock(conta, "trocas_do_programa")).toEqual([]);
});

test("a ficha de uma sessão livre troca a atividade sem criar preferência no programa", async ({ page }) => {
  await resetarMock();
  const conta = await usuarioComPerfil();
  await fixarData(page, HOJE_FIXO);
  await entrarNoApp(page);
  await page.goto("/exercicios/supino-reto-com-barra");
  await page.getByRole("button", { name: "Fazer agora" }).click();
  await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: "Como fazer: Supino reto com barra" }).click();
  const ficha = page.getByRole("dialog");
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  const opcoes = ficha.getByRole("list", { name: "Exercícios alternativos" });
  await expect(opcoes).toBeVisible();
  await expect(ficha.getByRole("group", { name: "Aplicar a troca" })).toHaveCount(0);
  await opcoes.getByRole("button", { name: /^Flexão de braço / }).click();
  await expect(ficha.getByRole("heading", { name: "Flexão de braço", exact: true })).toBeVisible();
  expect(await lerDoMock(conta, "sessions")).toMatchObject([{ workout_id: "livre" }]);
  expect(await lerDoMock(conta, "trocas_do_programa")).toEqual([]);
});

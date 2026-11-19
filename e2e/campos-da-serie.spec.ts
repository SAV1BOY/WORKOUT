import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, fixarData, lerDoMock,
  resetarMock, semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";

async function conferirValor(campo: Locator, valor: string) {
  await expect(campo).toHaveValue(valor);
  const excesso = await campo.evaluate((input: HTMLInputElement) => input.scrollWidth - input.clientWidth);
  expect.soft(excesso, `O valor ${valor} precisa caber inteiro, sem rolar dentro do campo`).toBeLessThanOrEqual(1);
}

async function tocarSimbolo(page: Page, nome: string) {
  const botao = page.getByRole("button", { name: nome, exact: true });
  const ponto = await botao.evaluate(elemento => {
    // Role apenas na vertical, como faz quem procura o controle pelo desenho do + ou −.
    const topo = window.scrollY + elemento.getBoundingClientRect().top - window.innerHeight / 3;
    window.scrollTo({ top: topo, left: 0, behavior: "instant" });
    const caixa = elemento.getBoundingClientRect();
    const icone = elemento.querySelector("svg")!.getBoundingClientRect();
    const x = icone.left + icone.width / 2;
    const y = icone.top + icone.height / 2;
    return { x, y, largura: caixa.width, altura: caixa.height,
      inteiro: caixa.left >= 0 && caixa.right <= document.documentElement.clientWidth,
      atingivel: elemento.contains(document.elementFromPoint(x, y)) };
  });
  expect(ponto.largura, nome).toBeGreaterThanOrEqual(56);
  expect(ponto.altura, nome).toBeGreaterThanOrEqual(56);
  expect.soft(ponto.inteiro, `Área de toque de ${nome} dentro da tela`).toBe(true);
  expect(ponto.atingivel, `Centro do símbolo de ${nome} recebe o toque`).toBe(true);
  await page.touchscreen.tap(ponto.x, ponto.y);
}

for (const [largura, fonte] of [[320, 200], [360, 125]] as const) {
  test(`edita e registra uma série com os números e os quatro controles visíveis a ${largura} px e fonte a ${fonte}%`, async ({ page }) => {
    await resetarMock();
    const conta = await usuarioComPerfil();
    await fixarData(page);
    await page.setViewportSize({ width: largura, height: 740 });
    await entrarNoApp(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await page.addStyleTag({ content: `html { font-size: ${fonte}% !important; }` });
    await page.evaluate(() => document.fonts.ready);
    const sessaoId = new URL(page.url()).pathname.split("/").at(-1)!;
    const reps = page.getByRole("textbox", { name: "repetições", exact: true });
    const carga = page.getByRole("textbox", { name: "carga na barra", exact: true });
    await conferirValor(reps, "5");
    await conferirValor(carga, "7,5");

    await tocarSimbolo(page, "Aumentar repetições");
    await conferirValor(reps, "6");
    await tocarSimbolo(page, "Diminuir repetições");
    await conferirValor(reps, "5");
    await tocarSimbolo(page, "Aumentar carga na barra");
    await conferirValor(carga, "11,5");
    await tocarSimbolo(page, "Diminuir carga na barra");
    await conferirValor(carga, "7,5");

    await carga.focus();
    await page.keyboard.press("Tab");
    const diminuir = page.getByRole("button", { name: "Diminuir carga na barra", exact: true });
    if (await diminuir.evaluate(botao => document.activeElement === botao)) await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Aumentar carga na barra", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await conferirValor(carga, "11,5");
    await carga.fill("");
    await carga.pressSequentially("107,5");
    await conferirValor(carga, "107,5");
    await carga.press("Enter");
    await conferirValor(carga, "107,5");
    await semRolagemHorizontal(page);

    await page.getByRole("button", { name: "Concluir série", exact: true }).tap();
    await expect(page.getByRole("timer", { name: "Descanso" })).toBeVisible();
    await expect.poll(() => lerDoMock(conta, "session_sets", `session_id=eq.${sessaoId}`)).toMatchObject([
      { exercise_id: "agachamento-livre", set_index: 1, tipo: "aquecimento", reps: 5, carga_kg: 107.5, concluida: true },
    ]);
  });
}

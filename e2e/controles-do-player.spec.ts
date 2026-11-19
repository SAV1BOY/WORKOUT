import { expect, test, type Page } from "@playwright/test";
import { comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, fixarData, resetarMock, usuarioComPerfil } from "./fixtures";

async function abrirPlayer(page: Page, tema: "light" | "dark", largura: number, fonte: number) {
  await resetarMock();
  await usuarioComPerfil();
  await fixarData(page);
  await page.setViewportSize({ width: largura, height: 740 });
  await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${tema}\\b`));
  await page.addStyleTag({ content: `html { font-size: ${fonte}% !important; }` });
  await page.evaluate(() => document.fonts.ready);
}

async function conferirControles(page: Page, nome: string) {
  const anterior = page.getByRole("button", { name: "Passo anterior", exact: true });
  const gravar = page.getByRole("button", { name: nome, exact: true });
  const proximo = page.getByRole("button", { name: "Próximo passo", exact: true });
  await expect(gravar).toHaveText(nome);
  await expect(gravar.locator("svg")).toBeVisible();
  const [esquerda, centro, direita] = await Promise.all([anterior, gravar, proximo].map(async botao => {
    const caixa = (await botao.boundingBox())!;
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeGreaterThanOrEqual(44);
    return caixa;
  }));
  expect(centro.height).toBeGreaterThanOrEqual(56);
  expect(centro.x - esquerda.x - esquerda.width).toBeGreaterThanOrEqual(24);
  expect(direita.x - centro.x - centro.width).toBeGreaterThanOrEqual(24);

  // O documento ainda mede 360 px quando as letras brancas saem do fundo do botão.
  const excessos = await gravar.evaluate(botao => {
    const fundo = botao.getBoundingClientRect();
    const excesso = (r: DOMRect) => Math.max(fundo.left - r.left, r.right - fundo.right, fundo.top - r.top, r.bottom - fundo.bottom, 0);
    const textos = document.createTreeWalker(botao, NodeFilter.SHOW_TEXT);
    const trecho = document.createRange();
    const letras: number[] = [];
    for (let no = textos.nextNode(); no; no = textos.nextNode()) {
      if (!no.textContent?.trim()) continue;
      trecho.selectNodeContents(no);
      letras.push(...Array.from(trecho.getClientRects(), excesso));
    }
    return { icone: excesso(botao.querySelector("svg")!.getBoundingClientRect()), texto: Math.max(...letras), linhas: letras.length };
  });
  expect(excessos.linhas).toBeGreaterThan(0);
  expect.soft(excessos.icone, `ícone de ${nome} fora do botão (px)`).toBeLessThanOrEqual(0.5);
  expect.soft(excessos.texto, `texto de ${nome} fora do botão (px)`).toBeLessThanOrEqual(0.5);
}

for (const tema of ["light", "dark"] as const) {
  test(`controles da série a 360 px com fonte a 125% no tema ${tema}`, async ({ page }) => {
    await abrirPlayer(page, tema, 360, 125);
    await conferirControles(page, "Concluir série");

    await page.getByRole("button", { name: "Passo anterior", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Concluir série", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("region", { name: "Descanso", exact: true })
      .getByRole("button", { name: /^Corrigir a série/ }).click();
    await conferirControles(page, "Série feita");
  });
}

test("a montagem fica inteiramente acima do rodapé a 320 px com fonte a 200%", async ({ page }) => {
  await abrirPlayer(page, "dark", 320, 200);
  const montagem = page.getByRole("button", { name: "Ver a montagem", exact: true });
  await expect(montagem).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const bordaLivre = await montagem.evaluate(botao => {
    const { left, width, bottom } = botao.getBoundingClientRect();
    return botao.contains(document.elementFromPoint(left + width / 2, bottom - 1));
  });
  expect(bordaLivre, "o último pixel do botão de montagem deve receber o toque").toBe(true);
  await montagem.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Montagem", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(montagem).toBeFocused();
});

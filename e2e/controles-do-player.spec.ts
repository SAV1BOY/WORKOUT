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
  const [esquerda, centro, direita] = await Promise.all([
    anterior.boundingBox(), gravar.boundingBox(), proximo.boundingBox(),
  ]);
  if (!esquerda || !centro || !direita) throw new Error("Os três controles da série precisam estar visíveis.");
  for (const caixa of [esquerda, centro, direita]) {
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeGreaterThanOrEqual(44);
  }
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
  const concluir = page.getByRole("button", { name: "Concluir série", exact: true });
  await expect(montagem).toBeVisible();
  // Esta fonte quebra o rótulo em mais uma linha quando o espaçamento aumenta.
  await page.addStyleTag({ content: 'button { font-family: "DejaVu Sans Mono", monospace !important; }' });
  const mudarEspaco = (espaco: string) =>
    page.addStyleTag({ content: `button { letter-spacing: ${espaco} !important; }` });
  const altura = () => concluir.evaluate(botao => botao.getBoundingClientRect().height);
  await mudarEspaco("normal");
  const alturaInicial = await altura();
  const posicao = () => page.evaluate(() => [window.scrollX, window.scrollY]);
  expect(await posicao(), "a sessão começou no topo").toEqual([0, 0]);

  await page.evaluate(() => window.scrollTo({ top: 140, behavior: "instant" }));
  await mudarEspaco("0.12em");
  await expect.poll(altura).toBeGreaterThan(alturaInicial + 1);
  expect(await posicao(), "a página manteve a posição de leitura").toEqual([0, 140]);
  await mudarEspaco("normal");
  await expect.poll(altura).toBe(alturaInicial);

  const montagemNoFim = () => montagem.evaluate(botao => {
    const pagina = document.documentElement;
    const { left, width, bottom } = botao.getBoundingClientRect();
    return Math.abs(pagina.scrollHeight - pagina.clientHeight - pagina.scrollTop) <= 1 &&
      botao.contains(document.elementFromPoint(left + width / 2, bottom - 1));
  });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(montagemNoFim).toBe(true);
  await mudarEspaco("0.12em");
  await expect.poll(altura).toBeGreaterThan(alturaInicial + 1);
  // A pessoa já tinha chegado ao fim. Uma segunda rolagem esconderia a regressão.
  await expect.poll(montagemNoFim).toBe(true);
  await montagem.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Montagem", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(montagem).toBeFocused();
});

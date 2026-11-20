import { expect, test, type Locator } from "@playwright/test";
import { entrarNoApp, fixarData, resetarMock, usuarioComPerfil } from "./fixtures";

const nomeLongo = "Desenvolvimento sentado com barra";

async function conferirAlvoFocado(alvo: Locator) {
  await expect(alvo).toBeFocused();
  const caixa = (await alvo.boundingBox())!;
  expect(caixa.width).toBeGreaterThanOrEqual(44);
  expect(caixa.height).toBeGreaterThanOrEqual(44);
  expect(caixa.x).toBeGreaterThanOrEqual(0);
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(320);
  await expect.poll(() => alvo.evaluate(el => {
    const r = el.getBoundingClientRect();
    return [r.top + 3, r.bottom - 3].every(y => el.contains(document.elementFromPoint(r.left + r.width / 2, y)));
  }), { message: "o alvo focado deve estar visível entre o cabeçalho e o rodapé" }).toBe(true);
}

test("reordenar os escolhidos pelo teclado em 320px com fonte a 200% mantém o foco e a busca", async ({ page }) => {
  await resetarMock();
  await usuarioComPerfil();
  await fixarData(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await entrarNoApp(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const personalizar = page.getByRole("button", { name: /Personalizar treino/ });
  await personalizar.press("Enter");
  const folha = page.getByRole("dialog", { name: "Crie o seu próprio" });
  const busca = folha.getByRole("searchbox", { name: "Buscar exercício pelo nome" });
  const catalogo = folha.getByRole("list", { name: "Catálogo" });
  for (const nome of ["Prancha", "Flexão de braço", nomeLongo]) {
    await busca.fill(nome);
    const resultado = catalogo.getByRole("button").filter({ has: page.getByText(nome, { exact: true }) });
    await resultado.press("Enter");
    await expect(resultado).toHaveAttribute("aria-pressed", "true");
  }
  const linhasDoNome = await catalogo.getByText(nomeLongo, { exact: true }).evaluate(el => {
    const texto = el.firstChild!;
    const palavra = "sentado";
    const inicio = texto.textContent!.indexOf(palavra);
    const intervalo = document.createRange();
    intervalo.setStart(texto, inicio);
    intervalo.setEnd(texto, inicio + palavra.length);
    return intervalo.getClientRects().length;
  });
  expect(linhasDoNome, "a imagem e a marca de seleção devem deixar espaço para ler a palavra sentado").toBe(1);

  const reordenar = folha.getByRole("button", { name: "Reordenar escolhidos", exact: true });
  await reordenar.focus();
  await conferirAlvoFocado(reordenar);
  await reordenar.press("Enter");
  const editor = page.getByRole("dialog", { name: "Reordenar escolhidos" });
  const titulo = editor.getByRole("heading", { name: "Reordenar escolhidos" });
  await expect(titulo).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const itens = editor.getByRole("list", { name: "Ordem dos exercícios escolhidos" }).getByRole("listitem");
  const subir = editor.getByRole("button", { name: "Subir " + nomeLongo, exact: true });
  const descer = editor.getByRole("button", { name: "Descer " + nomeLongo, exact: true });
  await expect(itens.last()).toContainText(nomeLongo);
  await expect(descer).toBeDisabled();
  await subir.focus();
  await conferirAlvoFocado(subir);
  await subir.press("Space");
  await expect(itens.nth(1)).toContainText(nomeLongo);
  await expect(subir).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(itens.first()).toContainText(nomeLongo);
  await expect(subir).toBeDisabled();
  await conferirAlvoFocado(descer);

  const texto = itens.first().getByText(new RegExp(nomeLongo));
  const limites = await texto.evaluate(el => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const caixa = r.getBoundingClientRect();
    return { esquerda: caixa.left, direita: caixa.right, topo: caixa.top, fundo: caixa.bottom };
  });
  expect(limites.esquerda).toBeGreaterThanOrEqual(0);
  expect(limites.direita).toBeLessThanOrEqual(320);
  for (const seta of [subir, descer]) {
    const caixa = (await seta.boundingBox())!;
    const sobrepoe = Math.min(caixa.x + caixa.width, limites.direita) > Math.max(caixa.x, limites.esquerda) + 1 &&
      Math.min(caixa.y + caixa.height, limites.fundo) > Math.max(caixa.y, limites.topo) + 1;
    expect(sobrepoe, "o nome deve ser legível ao lado das setas").toBe(false);
  }

  const pronto = editor.getByRole("button", { name: "Pronto", exact: true });
  await pronto.focus();
  await conferirAlvoFocado(pronto);
  await pronto.press("Enter");
  await conferirAlvoFocado(reordenar);
  await expect(busca).toHaveValue(nomeLongo);
  await reordenar.press("Enter");
  await titulo.press("Escape");
  await conferirAlvoFocado(reordenar);
  const escolhidos = folha.getByRole("list", { name: "Escolhidos" }).getByRole("listitem");
  await expect(escolhidos.first()).toContainText(nomeLongo);
  await expect(escolhidos.nth(1)).toContainText("Prancha");
  await expect(escolhidos.last()).toContainText("Flexão de braço");
  await busca.focus();
  await conferirAlvoFocado(busca);
  await catalogo.getByRole("button", { name: new RegExp("^" + nomeLongo + " ") }).press("Tab");
  const iniciar = folha.getByRole("button", { name: "Começar com 3 exercícios" });
  await conferirAlvoFocado(iniciar);
  expect(await iniciar.evaluate(el => {
    const botao = el.getBoundingClientRect();
    const texto = document.createRange();
    texto.selectNodeContents(el);
    return [...texto.getClientRects()].every(r => r.left >= botao.left && r.right <= botao.right);
  }), "o texto inteiro de Começar deve caber no botão").toBe(true);
  await iniciar.press("Escape");
  await expect(personalizar).toBeFocused();
});

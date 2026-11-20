import { expect, test, type Locator, type Page } from "@playwright/test";
import { entrarNoApp, fixarData, resetarMock, semRolagemHorizontal, usuarioComPerfil } from "./fixtures";
import { dialogo, editor, escolher, personalizar } from "./montar-modelo";

const botao = (grupo: Locator, nome: string) => grupo.getByRole("button", { name: nome, exact: true });
const painel = (page: Page) => dialogo(page, "Trocar exercício");

async function abrirMontagem(page: Page, nome: string) {
  await resetarMock();
  await usuarioComPerfil();
  await fixarData(page);
  await page.setViewportSize({ width: 320, height: 420 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrarNoApp(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await personalizar(page).press("Enter");
  await escolher(page, nome);
  return botao(editor(page), `Trocar ${nome}`);
}

// Quem volta pelo teclado deve ver o foco sem uma rolagem de ajuda do teste.
async function conferirAlvo(alvo: Locator, comFoco = false) {
  if (comFoco) await expect(alvo).toBeFocused();
  else await alvo.scrollIntoViewIfNeeded();
  await expect.poll(() => alvo.evaluate(el => {
    const r = el.getBoundingClientRect();
    const receptor = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      tamanho: r.width >= 44 && r.height >= 44,
      largura: r.left >= 0 && r.right <= document.documentElement.clientWidth,
      receptor: el.contains(receptor) ? "alvo" : receptor?.outerHTML.slice(0, 160) ?? "fora da tela",
    };
  }), { message: `Alvo legível e atingível ao centro: ${alvo}` }).toEqual({ tamanho: true, largura: true, receptor: "alvo" });
}

async function semRolagemLateral(page: Page, folha: Locator) {
  await semRolagemHorizontal(page);
  expect(await folha.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
}

test("Escape e Voltar recolhem a execução e devolvem o foco ao exercício da montagem", async ({ page }) => {
  const original = "Desenvolvimento sentado com barra";
  const destino = "Desenvolvimento com elástico";
  const trocar = await abrirMontagem(page, original);
  await conferirAlvo(botao(editor(page), `Tirar ${original}`));
  for (const voltar of [() => page.keyboard.press("Escape"), () => page.evaluate(() => history.back())]) {
    await conferirAlvo(trocar);
    await trocar.tap();
    const folha = painel(page);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(folha.getByRole("heading", { name: "Trocar exercício", exact: true })).toBeFocused();
    await folha.getByRole("searchbox").fill(destino);
    const lista = folha.getByRole("list", { name: "Exercícios alternativos" });
    const aplicar = lista.getByRole("button").filter({ has: page.getByText(destino, { exact: true }) });
    const ver = botao(lista, `Ver execução de ${destino}`);
    await aplicar.press("Tab");
    await conferirAlvo(ver, true);
    await page.keyboard.press("Space");
    const execucao = folha.getByRole("region", { name: `Execução de ${destino}`, exact: true });
    await expect(ver).toHaveAttribute("aria-expanded", "true");
    const passo = execucao.getByRole("listitem").last();
    await passo.scrollIntoViewIfNeeded();
    await expect(passo).toBeInViewport();
    await semRolagemLateral(page, folha);
    await voltar();
    await expect(execucao).toBeHidden();
    await expect(ver).toHaveAttribute("aria-expanded", "false");
    await conferirAlvo(ver, true);
    await voltar();
    await conferirAlvo(trocar, true);
    await semRolagemLateral(page, editor(page));
  }
  await trocar.press("Enter");
  const voltar = botao(painel(page), "Voltar");
  await conferirAlvo(voltar);
  await voltar.tap();
  await conferirAlvo(trocar, true);
});

test("os atalhos de material mantêm o foco e a troca por toque usa o tatame e o elástico marcados", async ({ page }) => {
  const original = "Crucifixo inverso";
  const destino = "Abertura de ombros";
  const trocar = await abrirMontagem(page, original);
  const material = editor(page).locator("summary").filter({ hasText: "Equipamentos disponíveis" });
  await conferirAlvo(material);
  await material.press("Enter");
  await page.keyboard.press("Tab");
  const grupo = editor(page).getByRole("group", { name: "Equipamento de hoje", exact: true });
  const corpo = botao(grupo, "Só peso do corpo");
  const todos = botao(grupo, "Usar todo o equipamento");
  const marcados = grupo.getByRole("checkbox", { checked: true });
  const quantidade = await grupo.getByRole("checkbox").count();
  await conferirAlvo(corpo, true);
  await page.keyboard.press("Enter");
  await expect(marcados).toHaveCount(0);
  await conferirAlvo(corpo, true);
  await page.keyboard.press("Tab");
  await conferirAlvo(todos, true);
  await page.keyboard.press("Enter");
  await expect(marcados).toHaveCount(quantidade);
  await conferirAlvo(todos, true);
  await page.keyboard.press("Shift+Tab");
  await conferirAlvo(corpo, true);
  await page.keyboard.press("Enter");
  for (const nome of ["Tatame", "Elástico (Super Band)"]) {
    const caixa = grupo.getByRole("checkbox", { name: nome, exact: true });
    const rotulo = grupo.locator("label").filter({ has: page.getByRole("checkbox", { name: nome, exact: true }) });
    await conferirAlvo(rotulo);
    await rotulo.tap();
    await expect(caixa).toBeChecked();
  }
  await expect(marcados).toHaveCount(2);
  await material.tap();
  await expect(material).toContainText("Elástico e Tatame");
  await trocar.press("Enter");
  const folha = painel(page);
  await expect(folha.locator("summary:visible").filter({ hasText: "Equipamentos disponíveis" })).toContainText("Elástico e Tatame");
  const filtros = folha.getByRole("group", { name: "Equipamento para a alternativa" });
  const lista = folha.getByRole("list", { name: "Exercícios alternativos" });
  for (const [filtro, nome, kit] of [
    ["Tatame", "Elevação em T no tatame", "Tatame"],
    ["Elástico", destino, "Elástico (Super Band)"],
  ] as const) {
    const controle = botao(filtros, filtro);
    await conferirAlvo(controle);
    await controle.tap();
    await expect(controle).toHaveAttribute("aria-pressed", "true");
    const opcao = lista.getByRole("button").filter({ has: page.getByText(nome, { exact: true }) });
    await expect(opcao).toContainText(kit);
    await conferirAlvo(opcao);
    await semRolagemLateral(page, folha);
    if (nome === destino) await opcao.tap();
  }
  const trocado = botao(editor(page), `Trocar ${destino}`);
  await conferirAlvo(trocado, true);
  const desfazer = botao(editor(page), "Desfazer troca");
  await conferirAlvo(desfazer);
  await desfazer.tap();
  await conferirAlvo(trocar, true);
  const tirar = botao(editor(page), `Tirar ${original}`);
  await conferirAlvo(tirar);
  await tirar.tap();
  await expect(trocar).toHaveCount(0);
  await semRolagemLateral(page, editor(page));
});

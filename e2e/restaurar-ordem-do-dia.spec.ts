import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, atualizarNoMock, definirCota, entrarNoApp, esperarAbaTreino, fixarData, HOJE_FIXO,
  irNaAba, lerDoMock, naFila, resetarMock, sessaoNoMock, usuarioComPerfil,
} from "./fixtures";

async function sair(page: Page) {
  await expect.poll(() => naFila(page)).toBe(0);
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/login$/);
}

test("restaurar pelo teclado a ordem de uma conta mantém a escolha da outra no mesmo aparelho", async ({ page }) => {
  test.slow();
  await resetarMock();
  await definirCota(3);
  await usuarioComPerfil();
  const email = "restaurar-ordem@example.test";
  const outra = await sessaoNoMock(email);
  await atualizarNoMock(outra, "profiles", `user_id=eq.${outra.userId}`, {
    nome: "Atleta", data_inicio: "2026-09-14", fase_atual: "fase1", fase_desde: "2026-09-14",
    prefs: { guia_visto: true },
  });
  await fixarData(page, HOJE_FIXO);
  await entrarNoApp(page);
  const editar = page.getByRole("button", { name: "Editar", exact: true });
  const editor = page.getByRole("region", { name: "Reordenar os exercícios" });
  const pronto = editor.getByRole("button", { name: "Pronto", exact: true });
  const restaurar = editor.getByRole("button", { name: "Voltar à ordem do programa" });
  const primeiro = page.getByRole("list", { name: "Exercícios de hoje" }).getByRole("listitem").first();

  await editar.press("Enter");
  await expect(restaurar).toBeDisabled();
  await editor.getByRole("button", { name: "Subir Supino reto com barra" }).press("Space");
  await pronto.press("Enter");
  await expect(primeiro).toContainText("1. Supino reto com barra");
  await sair(page);

  await entrarNoApp(page, email);
  await editar.press("Enter");
  const subirRemada = editor.getByRole("button", { name: "Subir Remada curvada pronada" });
  await subirRemada.press("Space");
  await subirRemada.press("Space");
  await pronto.press("Enter");
  await expect(primeiro).toContainText("1. Remada curvada pronada");
  await page.reload();
  await esperarAbaTreino(page);
  await expect(primeiro).toContainText("1. Remada curvada pronada");

  await page.setViewportSize({ width: 320, height: 740 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await editar.press("Enter");
  const linha = editor.getByRole("listitem").filter({ hasText: "Desenvolvimento com halteres" });
  const nome = linha.getByText(/^\d+\. Desenvolvimento com halteres$/);
  await nome.scrollIntoViewIfNeeded();
  const texto = await nome.evaluate(el => {
    const parte = document.createRange();
    parte.selectNodeContents(el);
    return parte.getBoundingClientRect().toJSON();
  });
  expect(texto.left).toBeGreaterThanOrEqual(0);
  expect(texto.right).toBeLessThanOrEqual(320);
  const setas = linha.getByRole("button");
  await expect(setas).toHaveCount(2);
  for (const seta of await setas.all()) {
    const caixa = (await seta.boundingBox())!;
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(320);
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeGreaterThanOrEqual(44);
    expect(caixa.y).toBeGreaterThanOrEqual(texto.bottom - 1);
  }
  await pronto.press("Shift+Tab");
  await expect(restaurar).toBeFocused();
  expect(await restaurar.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await restaurar.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Enter");
  await expect(restaurar).toBeDisabled();
  await pronto.press("Enter");
  await page.reload();
  await esperarAbaTreino(page);
  await expect(primeiro).toContainText("1. Agachamento livre");
  await sair(page);
  await entrarNoApp(page);
  await expect(primeiro).toContainText("1. Supino reto com barra");
});

test("Treinar mostra e retoma a ordem escolhida pelo teclado após recarregar", async ({ page }) => {
  test.slow();
  await resetarMock();
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  await fixarData(page, HOJE_FIXO);
  await entrarNoApp(page);
  await page.getByRole("button", { name: "Editar", exact: true }).press("Enter");
  const editor = page.getByRole("region", { name: "Reordenar os exercícios" });
  await editor.getByRole("button", { name: "Descer Agachamento livre" }).press("Space");
  await editor.getByRole("button", { name: "Pronto", exact: true }).press("Enter");
  await page.reload();
  await esperarAbaTreino(page);
  const primeiro = page.getByRole("list", { name: "Exercícios de hoje" }).getByRole("listitem").first();
  await expect(primeiro).toContainText("1. Supino reto com barra");

  await page.goto("/treinar");
  await expect(page.getByRole("heading", { level: 1, name: "Treinar" })).toBeVisible();
  await expect(primeiro).toContainText("1. Supino reto com barra");
  await page.getByRole("button", { name: "Começar o Treino A", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
  const urlDaSessao = page.url();
  await abrirVisaoGeral(page);
  const visao = page.getByRole("dialog", { name: "Visão geral do treino" });
  const bloco = visao.getByRole("heading", { level: 2 }).first();
  await expect(bloco).toHaveText("1. Supino reto com barra");
  await visao.getByRole("link", { name: "Continuar depois", exact: true }).press("Enter");
  await esperarAbaTreino(page);
  await page.reload();
  await esperarAbaTreino(page);
  await page.getByRole("link", { name: "Continuar", exact: true }).press("Enter");
  await expect(page).toHaveURL(urlDaSessao);
  await abrirVisaoGeral(page);
  await expect(bloco).toHaveText("1. Supino reto com barra");
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{
    id: new URL(urlDaSessao).pathname.split("/").at(-1), user_id: conta.userId,
  }]);
});

import { expect, test } from "@playwright/test";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, comecarNoPlayer, entrarNoApp, esperarAbaTreino,
  fixarData, lerDoMock, marcarSerieNaVisaoGeral, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { ajustar, campo, carregar, dialogo, editor, escolher, personalizar } from "./montar-modelo";
import { geral } from "./treino-livre-ativo";

test("salvar pelo Histórico conserva as quatro séries configuradas na ficha mesmo quando só uma foi feita", async ({ page }) => {
  test.slow(); // Percorre montagem, ficha, conclusão, Histórico e reabertura do modelo.
  const exercicio = "Remada com elástico";
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await entrarNoApp(page);
  await personalizar(page).click();
  await escolher(page, exercicio);
  await editor(page).getByRole("button", { name: "Começar com 1 exercício", exact: true }).click();
  await comecarNoPlayer(page);
  const sessaoId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button", { name: `Como fazer: ${exercicio}`, exact: true }).click();
  const ficha = page.getByRole("dialog", { name: exercicio, exact: true });
  await expect(ficha.getByRole("textbox", { name: "Séries", exact: true })).toHaveValue("3");
  await ficha.getByRole("button", { name: "Aumentar Séries", exact: true }).click();
  await expect(ficha.getByRole("textbox", { name: "Séries", exact: true })).toHaveValue("4");
  await ficha.getByRole("button", { name: "Fechar", exact: true }).first().click();
  await abrirVisaoGeral(page);
  const visao = geral(page);
  await expect(visao.getByRole("group", { name: /^Série \d+ — Remada com elástico$/ })).toHaveCount(4);
  await marcarSerieNaVisaoGeral(visao.getByRole("group", { name: `Série 1 — ${exercicio}`, exact: true }).getByRole("checkbox"));
  await visao.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("button", { name: "Salvar e voltar", exact: true }).click();
  await esperarAbaTreino(page);
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${sessaoId}`)).toMatchObject([{ status: "concluida" }]);
  expect(await lerDoMock(conta, "session_sets", `session_id=eq.${sessaoId}`)).toMatchObject([{ set_index: 1, tipo: "trabalho" }]);

  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Relatório" }).click();
  await abrirSecaoDoRelatorio(page, "historico");
  await page.getByRole("button", { name: /^Ver séries de Treino personalizado de / }).click();
  await dialogo(page, "Séries do treino").getByRole("button", { name: "Salvar como treino", exact: true }).click();
  const form = dialogo(page, "Salvar como treino");
  await form.getByRole("textbox", { name: "Nome do treino", exact: true }).fill("Remada em quatro");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo(page, "Séries do treino").getByRole("status").filter({ hasText: "Treino salvo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Treino", exact: true }).click();
  await carregar(page, "Remada em quatro");
  await ajustar(page).click();
  await expect(campo(page, exercicio)).toHaveValue("4");
  expect(await lerDoMock(conta, "sessions", "select=id")).toEqual([{ id: sessaoId }]);
});

import { expect, test } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral,
  entrarNoApp,
  esperarServiceWorker,
  fixarData,
  HOJE_FIXO,
  lerDoMock,
  naFila,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral, series } from "./treino-livre-ativo";

test("Personalizar inicia só com elástico e tatame e retoma a série marcada sem rede", async ({ page, context }) => {
  test.slow(); // Inclui a instalação do worker e uma navegação completa sem rede.
  await resetarMock();
  await fixarData(page, HOJE_FIXO);
  const conta = await usuarioComPerfil({
    prefs: { evitar_exercicios: ["remada-com-elastico"], preparacao_s: 0, avancar_sozinho: false },
  });
  await entrarNoApp(page);
  await page.getByRole("button", { name: /Personalizar treino/ }).click();
  const folha = page.getByRole("dialog", { name: "Crie o seu próprio" });
  const busca = folha.getByRole("searchbox", { name: "Buscar exercício pelo nome" });
  const opcoes = folha.getByRole("list", { name: "Catálogo" }).getByRole("button");
  await busca.fill("remada com elastico");
  const remada = opcoes.filter({ hasText: "Remada com elástico" });
  await expect(remada).toHaveAccessibleName("Remada com elástico 3 × 8–12 · Super Band");
  await busca.fill("remada");
  await expect(opcoes.last()).toHaveAccessibleName(/Remada com elástico/);
  await remada.focus();
  await page.keyboard.press("Enter");
  await expect(remada).toHaveAttribute("aria-pressed", "true");
  await busca.fill("ponte de glúteos");
  await opcoes.filter({ hasText: "Ponte de glúteos no tatame" }).click();
  const escolhidos = folha.getByRole("list", { name: "Escolhidos" }).getByRole("button");
  await expect(escolhidos.nth(0)).toHaveAccessibleName("Tirar Remada com elástico");
  await expect(escolhidos.nth(1)).toHaveAccessibleName("Tirar Ponte de glúteos no tatame");
  await folha.getByRole("button", { name: "Começar com 2 exercícios" }).click();
  await expect(page).toHaveURL(/\/treinar\/[\da-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await esperarServiceWorker(page);
  await abrirVisaoGeral(page);
  const visao = geral(page);
  const titulos = ["1. Remada com elástico", "2. Ponte de glúteos no tatame"];
  await expect(visao.getByRole("heading", { level: 2 })).toHaveText(titulos);
  for (const bloco of ["#bloco-1", "#bloco-2"]) {
    await expect(visao.locator(bloco).getByRole("checkbox", { checked: false })).toHaveCount(3);
  }

  await expect.poll(() => naFila(page)).toBe(0);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const primeira = visao.getByRole("checkbox", { name: "Série 1 concluída — Remada com elástico" });
  await primeira.check();
  await expect.poll(() => naFila(page)).toBeGreaterThan(0);
  expect(await series(conta, id)).toHaveLength(0);
  await semRedeNoWorker(worker);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await abrirVisaoGeral(page);
  await expect(visao.getByRole("heading", { level: 2 })).toHaveText(titulos);
  await expect(primeira).toBeChecked();
  await expect(visao.getByRole("checkbox", { checked: false })).toHaveCount(5);

  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await series(conta, id)).toMatchObject([{
    user_id: conta.userId, exercise_id: "remada-com-elastico", ordem_ex: 1, set_index: 1, concluida: true,
  }]);
  expect(await lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{
    id, user_id: conta.userId, workout_id: "livre", plano: { itens: [
      { exercicio_id: "remada-com-elastico", series: 3, min: 8, max: 12 },
      { exercicio_id: "ponte-de-gluteos-no-tatame", series: 3, min: 8, max: 12 },
    ] },
  }]);
});

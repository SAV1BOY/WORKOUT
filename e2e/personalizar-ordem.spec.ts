import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, comecarNoPlayer, entrarNoApp, esperarServiceWorker, fixarData,
  lerDoMock, naFila, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral, series } from "./treino-livre-ativo";

const FLEXAO = "Flexão de braço";
const REMADA = "Remada com elástico";
const PRANCHA = "Prancha";
const FECHADA = "Flexão fechada";
const folha = (page: Page) => page.getByRole("dialog", { name: "Crie o seu próprio", exact: true });
const editor = (page: Page) => page.getByRole("dialog", { name: "Reordenar escolhidos", exact: true });
const busca = (page: Page) => folha(page).getByRole("searchbox", { name: "Buscar exercício pelo nome" });
const opcao = (page: Page, nome: string) => folha(page).getByRole("list", { name: "Catálogo" })
  .getByRole("button").filter({ has: page.getByText(nome, { exact: true }) });

async function abrirComTresEscolhidos(page: Page) {
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await entrarNoApp(page);
  await page.getByRole("button", { name: /Personalizar treino/ }).click();
  for (const nome of [FLEXAO, REMADA, PRANCHA]) {
    await busca(page).fill(nome.toLocaleLowerCase("pt-BR"));
    await opcao(page, nome).click();
    await expect(opcao(page, nome)).toHaveAttribute("aria-pressed", "true");
  }
  const reordenar = folha(page).getByRole("button", { name: "Reordenar escolhidos", exact: true });
  await expect(reordenar).toBeVisible();
  await reordenar.click();
  return conta;
}

async function conferirEscolhidos(page: Page, nomes: string[]) {
  const itens = folha(page).getByRole("list", { name: "Escolhidos" }).getByRole("button", { name: /^Tirar / });
  await expect(itens).toHaveCount(nomes.length);
  for (const [i, nome] of nomes.entries()) {
    await expect(itens.nth(i)).toHaveAccessibleName(`Tirar ${nome}`);
  }
}

async function iniciar(page: Page) {
  await folha(page).getByRole("button", { name: "Começar com 3 exercícios", exact: true }).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

test("a ordem editada abre o treino personalizado e mantém a primeira série ao recarregar sem rede", async ({ page, context }) => {
  test.slow(); // Percorre montagem da sessão, recarga pelo worker e confirmação da série na volta da rede.
  const conta = await abrirComTresEscolhidos(page);
  const descer = editor(page).getByRole("button", { name: `Descer ${FLEXAO}`, exact: true });
  await descer.click();
  await descer.click();
  await editor(page).getByRole("button", { name: "Pronto", exact: true }).click();

  const nomes = [REMADA, PRANCHA, FLEXAO];
  await conferirEscolhidos(page, nomes);
  await expect(busca(page)).toHaveValue("prancha");
  await expect(opcao(page, PRANCHA)).toHaveAttribute("aria-pressed", "true");
  await busca(page).fill("");
  for (const nome of nomes) await expect(opcao(page, nome)).toHaveAttribute("aria-pressed", "true");

  const id = await iniciar(page);
  await esperarServiceWorker(page);
  await comecarNoPlayer(page);
  const movimento = page.getByRole("region", { name: REMADA, exact: true });
  await expect(movimento.getByText("Série 1 de 3 · exercício 1 de 3", { exact: true })).toBeVisible();
  const sessoes = () => lerDoMock<LinhaSessao>(conta, "sessions");
  await expect.poll(sessoes).toMatchObject([{
    id, user_id: conta.userId, workout_id: "livre", plano: { titulo: "Treino personalizado", itens: [
      { exercicio_id: "remada-com-elastico" }, { exercicio_id: "prancha" }, { exercicio_id: "flexao-de-braco" },
    ] },
  }]);

  await expect.poll(() => naFila(page)).toBe(0);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const reps = movimento.getByRole("textbox", { name: "repetições", exact: true });
  await reps.fill("11");
  await reps.press("Enter");
  await movimento.getByRole("button", { name: "Concluir série", exact: true }).click();
  await expect(page.getByRole("region", { name: "Descanso", exact: true })).toBeVisible();
  await expect.poll(() => naFila(page)).toBeGreaterThan(0);
  expect(await series(conta, id)).toHaveLength(0);

  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await abrirVisaoGeral(page);
  const visao = geral(page);
  await expect(visao.getByRole("heading", { level: 2 })).toHaveText(nomes.map((nome, i) => `${i + 1}. ${nome}`));
  await expect(visao.getByRole("checkbox", { checked: true })).toHaveCount(1);
  const primeira = visao.getByRole("group", { name: `Série 1 — ${REMADA}`, exact: true });
  await expect(primeira.getByRole("checkbox")).toBeChecked();
  await expect(primeira.getByRole("textbox", { name: "repetições" })).toHaveValue("11");

  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  await expect.poll(() => series(conta, id)).toMatchObject([{
    id: expect.any(String), session_id: id, user_id: conta.userId, exercise_id: "remada-com-elastico",
    ordem_ex: 1, set_index: 1, reps: 11, concluida: true,
  }]);
  expect(await sessoes()).toHaveLength(1);
});

test("tirar um movimento e acrescentar uma variação preserva a ordem dos demais", async ({ page }) => {
  const conta = await abrirComTresEscolhidos(page);
  await editor(page).getByRole("button", { name: `Subir ${PRANCHA}`, exact: true }).click();
  await editor(page).getByRole("button", { name: "Pronto", exact: true }).click();
  await folha(page).getByRole("button", { name: `Tirar ${FLEXAO}`, exact: true }).click();
  await conferirEscolhidos(page, [PRANCHA, REMADA]);
  await busca(page).fill("flexao");
  await expect(opcao(page, FLEXAO)).toHaveAttribute("aria-pressed", "false");
  await opcao(page, FECHADA).click();
  await conferirEscolhidos(page, [PRANCHA, REMADA, FECHADA]);
  const id = await iniciar(page);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{
    id, user_id: conta.userId, plano: { itens: [
      { exercicio_id: "prancha" }, { exercicio_id: "remada-com-elastico" }, { exercicio_id: "flexao-fechada" },
    ] },
  }]);
});

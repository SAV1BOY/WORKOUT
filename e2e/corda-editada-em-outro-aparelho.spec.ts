import { expect, test } from "@playwright/test";
import { controlarEnvioDaContagem } from "./controlar-envio-da-contagem";
import { abrirCorrecaoDaCorda, prepararCordaAntiga } from "./corda-antiga";
import { atualizarNoMock, esperarServiceWorker, inserirNoMock, lerDoMock, naFila } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

test("corrigir os saltos confere uma edição concorrente e mantém a nova nota no resumo sem rede", async ({ page, context }) => {
  test.setTimeout(90_000);
  await controlarEnvioDaContagem(page, "cardio_sessions");
  const { conta, id, linha } = await prepararCordaAntiga(page);
  const tabela = "cardio_sessions";
  const filtro = "id=eq." + id + "&user_id=eq." + conta.userId;
  await inserirNoMock(conta, tabela, [{ ...linha, saltos: 64, duracao_min: 12, notas: "Pausa no quarto bloco." }]);

  const resumo = await context.newPage();
  await resumo.goto("/cardio/corda?sessao=" + id);
  await esperarServiceWorker(resumo);
  await expect(resumo.getByText("Pausa no quarto bloco.", { exact: true })).toBeVisible();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const { formulario, conflito } = await abrirCorrecaoDaCorda(page, id);
  await formulario.getByRole("textbox", { name: "Saltos", exact: true }).fill("42");
  await formulario.getByRole("button", { name: "Confirmar correção", exact: true }).click();
  await expect(formulario).toHaveCount(0);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect(conflito).toContainText("64");

  await page.evaluate(id => {
    window.envioDaContagem.id = id;
    window.envioDaContagem.modo = "reter antes";
  }, id);
  const usar = conflito.getByRole("button", { name: "Usar a contagem do aparelho", exact: true });
  await usar.click();
  await expect.poll(() => page.evaluate(() => window.envioDaContagem.estado)).toBe("retida");
  const edicao = {
    saltos: 65, duracao_min: 18.5, esforco: "moderado", notas: "Completei dois blocos a mais.",
    feito: { repeticoes_cumpridas: 6, repeticoes_planejadas: 6, decorrido_s: 1110 },
  };
  await atualizarNoMock(conta, tabela, filtro, edicao);
  await page.evaluate(() => window.envioDaContagem.liberar());
  await conflito.getByRole("button", { name: "Rever valores", exact: true }).click();
  await expect(conflito).toContainText("65");
  expect(await lerDoMock(conta, tabela, filtro)).toMatchObject([edicao]);
  await usar.click();
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await lerDoMock(conta, tabela, filtro)).toMatchObject([{ ...edicao, id, tipo: "corda", saltos: 42 }]);

  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect((await resumo.reload())?.fromServiceWorker()).toBe(true);
  await expect(resumo.getByText(edicao.notas, { exact: true })).toBeVisible();
  await expect(resumo.getByText("6 de 6", { exact: true })).toBeVisible();
  const saltos = resumo.locator("dl > div").filter({ has: resumo.getByText("Saltos", { exact: true }) }).locator("dd");
  await expect(saltos).toHaveText("42");

  // Depois de esvaziar a fila, uma edição mais nova do histórico passa a valer também nesta aba.
  const novaNota = "Reconte na próxima semana.";
  await atualizarNoMock(conta, tabela, filtro, { saltos: 72, notas: novaNota });
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect(saltos).toHaveText("72");
  await expect(resumo.getByText(novaNota, { exact: true })).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(0);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect((await resumo.reload())?.fromServiceWorker()).toBe(true);
  await expect(saltos).toHaveText("72");
  await expect(resumo.getByText(novaNota, { exact: true })).toBeVisible();
});

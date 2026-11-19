import { expect, test } from "@playwright/test";
import { abrirSecaoDoRelatorio, entrarNoApp, esperarServiceWorker, fixarData, inserirNoMock, irNaAba, naFila, resetarMock, usuarioComPerfil } from "./fixtures";
import { semRedeNoWorker, workerDoApp } from "./rede-do-worker";

test("uma data do calendário abre pela primeira vez sem rede com o histórico da conta", async ({ page, context }) => {
  test.setTimeout(60_000);
  await resetarMock();
  const conta = await usuarioComPerfil({ data_inicio: "2026-08-03", fase_desde: "2026-08-03" });
  await fixarData(page, "2026-09-14T13:00:00-03:00");
  const id = crypto.randomUUID();
  const corrida = { id, user_id: conta.userId, data: "2026-08-18", tipo: "corrida", concluida: true,
    duracao_min: 37, distancia_km: 5.25, notas: "Corrida de agosto na pista." };
  await inserirNoMock(conta, "cardio_sessions", [corrida]);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  await page.getByRole("button", { name: "Todos os registros", exact: true }).click();
  const resumo = "/cardio/corrida?sessao=" + id;
  await expect(page.getByRole("list", { name: "Registros" }).getByRole("link")).toHaveAttribute("href", resumo);

  const caminho = "/calendario?dia=" + corrida.data;
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect((await page.goto(caminho))?.fromServiceWorker()).toBe(true);
  const titulo = page.getByRole("heading", { name: "Calendário", exact: true });
  await expect(titulo).toBeVisible();
  const dia = page.getByRole("list", { name: "Semana", exact: true }).getByRole("button", { name: /^terça 18\/08:/ });
  await expect(dia).toBeVisible();
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await dia.press("Enter");
  const abrir = page.getByRole("dialog").getByRole("link", { name: "Abrir o cardio", exact: true });
  await expect(abrir).toHaveAttribute("href", resumo);
  await abrir.press("Enter");
  await expect(page.getByText(corrida.notas, { exact: true })).toBeVisible();
  await expect(page.getByText("5,25 km", { exact: true })).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(0);

  await page.goto(caminho);
  await expect(dia).toBeVisible();
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  const semConexao = page.getByRole("heading", { name: "Sem conexão", exact: true });
  await expect(semConexao).toBeVisible();
  await expect(titulo).toHaveCount(0);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(semConexao).toBeVisible();
  await expect(titulo).toHaveCount(0);
});

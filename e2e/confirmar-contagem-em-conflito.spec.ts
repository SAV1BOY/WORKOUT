import { expect, test } from "@playwright/test";
import { abrirConflitosDoBackup } from "./contagens-em-conflito";
import { controlarEnvioDaContagem } from "./controlar-envio-da-contagem";
import { atualizarNoMock, lerDoMock, naFila } from "./fixtures";

test("uma edição entre a escolha e o envio exige reler a série e perder a confirmação não duplica a correção", async ({ page, context }) => {
  test.setTimeout(60_000);
  await controlarEnvioDaContagem(page, "session_sets");
  const { conta, id, series, dialogo, primeira, segunda } = await abrirConflitosDoBackup(page);
  await page.evaluate(serie => {
    window.envioDaContagem.id = serie;
    window.envioDaContagem.modo = "reter antes";
  }, series[0].id);
  const usar = primeira.getByRole("button", { name: "Usar a contagem do aparelho", exact: true });
  await usar.click();
  await expect.poll(() => page.evaluate(() => window.envioDaContagem.estado)).toBe("retida");
  await atualizarNoMock(conta, "session_sets", "id=eq." + series[0].id, { reps: 17, carga_kg: 41.5 });
  await page.evaluate(() => window.envioDaContagem.liberar());
  await primeira.getByRole("button", { name: "Rever valores", exact: true }).click();
  await expect(primeira).toContainText("17");
  const remota = () => lerDoMock(conta, "session_sets", "id=eq." + series[0].id);
  expect(await remota()).toMatchObject([{ reps: 17, carga_kg: 41.5 }]);

  await page.evaluate(() => { window.envioDaContagem.modo = "perder resposta"; });
  await usar.click();
  await expect.poll(() => page.evaluate(() => window.envioDaContagem.estado)).toBe("resposta perdida");
  expect(await remota()).toMatchObject([{ reps: 10, carga_kg: 41.5 }]);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(primeira).toHaveCount(0);
  await segunda.getByRole("button", { name: "Manter a série do histórico", exact: true }).click();
  await expect(segunda).toHaveCount(0);
  await expect(dialogo).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(0);
  const fim = await lerDoMock(conta, "session_sets", "session_id=eq." + id + "&order=set_index.asc");
  expect(fim).toMatchObject([
    { id: series[0].id, reps: 10, carga_kg: 41.5 },
    { id: series[1].id, reps: 18, exercise_id: "flexao-de-braco" },
  ]);
});

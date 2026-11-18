import { expect, test } from "@playwright/test";
import { entrarNoApp, fixarData, lerDoMock, resetarMock, usuarioComPerfil } from "./fixtures";

test("o aparelho recusa a cópia da troca e a transação também desfaz o item da fila", async ({ page, context }) => {
  await resetarMock();
  const conta = await usuarioComPerfil();
  await fixarData(page, "2026-09-14T08:00:00-03:00");
  await entrarNoApp(page);
  const supino = page.getByRole("button", { name: "Substituir Supino reto com barra" });
  await supino.click();
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  await folha.getByRole("radio", { name: "Usar nos próximos A1" }).check();
  await context.setOffline(true);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const [entrada] = args;
      if (this.name === "cache" && entrada?.valor?.["supino-reto-com-barra"] === "flexao-de-braco") {
        throw new DOMException("Armazenamento cheio", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await folha.getByRole("button", { name: /^Flexão de braço/ }).click();
  await expect(folha.getByRole("alert")).toContainText("Não foi possível guardar a mudança");
  const pendentes = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const consulta = banco.transaction("outbox").objectStore("outbox").index("tipo").count("troca_do_programa");
      consulta.onsuccess = () => { banco.close(); resolve(consulta.result); };
      consulta.onerror = () => { banco.close(); reject(consulta.error); };
    };
  }));
  expect(pendentes).toBe(0);
  await page.keyboard.press("Escape");
  await expect(supino).toBeVisible();
  await context.setOffline(false);
  expect(await lerDoMock(conta, "trocas_do_programa")).toEqual([]);
});

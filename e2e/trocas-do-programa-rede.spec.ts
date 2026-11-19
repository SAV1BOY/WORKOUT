import { performance } from "node:perf_hooks";
import { expect, test } from "@playwright/test";
import {
  abrirVisaoGeral, entrarNoApp, fixarData, inserirNoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";

test.use({ serviceWorkers: "block" }); // a interceptação deve alcançar o GET da preferência

test("Começar usa a troca do aparelho quando o Wi-Fi fica online mas o GET não responde", async ({ page }, info) => {
  await resetarMock();
  const conta = await usuarioComPerfil();
  await inserirNoMock(conta, "trocas_do_programa", [{
    user_id: conta.userId, workout_id: "A1", exercicio_original_id: "supino-reto-com-barra", substituto_id: "flexao-de-braco",
  }]);
  await fixarData(page, "2026-09-14T08:00:00-03:00");
  await entrarNoApp(page);
  await expect(page.getByRole("button", { name: "Substituir Flexão de braço" })).toBeVisible();

  // O aparelho conservou o programa. O cache geral do TanStack expirou entre as visitas.
  await page.goto("/robots.txt");
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const tx = banco.transaction("cache", "readwrite");
      tx.objectStore("cache").delete("react-query-v1");
      tx.oncomplete = () => { banco.close(); resolve(); };
      tx.onerror = () => { banco.close(); reject(tx.error); };
    };
  }));
  let pedidosPresos = 0;
  await page.route("**/rest/v1/trocas_do_programa?**", (pedido) => {
    if (pedido.request().method() === "GET") {
      pedidosPresos++;
      return; // Sem resposta até o AbortSignal do aplicativo. As demais rotas continuam normais.
    }
    return pedido.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  const iniciar = page.getByRole("button", { name: "Começar treino" });
  await expect(iniciar).toBeVisible();
  await expect.poll(() => pedidosPresos).toBeGreaterThan(0);
  const inicio = performance.now();
  await iniciar.click();
  await expect(page.getByRole("button", { name: "Começar agora" })).toBeVisible({ timeout: 15_000 });
  const duracao = Math.round(performance.now() - inicio);
  info.annotations.push({ type: "clique até o player, em ms", description: String(duracao) });
  console.log(`Começar → player com consulta de trocas pendurada: ${duracao} ms`);
  await abrirVisaoGeral(page);
  await expect(page.locator("#bloco-2").getByRole("heading", { name: "2. Flexão de braço" })).toBeVisible();
});

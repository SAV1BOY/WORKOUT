import { expect, test, type Page } from "@playwright/test";
import {
  atualizarNoMock, definirCota, EMAIL_DONO, entrarNoApp, fixarRelogio, irNaAba,
  naFila, resetarMock, sessaoNoMock, usuarioComPerfil,
} from "./fixtures";

async function entrarEConferirPerfil(page: Page, email: string, id: string, nome: string, fase: string) {
  const [resposta] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === "/rest/v1/profiles" && r.request().method() === "GET", { timeout: 15_000 }),
    entrarNoApp(page, email),
  ]);
  expect(resposta.ok()).toBe(true);
  const dados = await resposta.json();
  expect(Array.isArray(dados) ? dados : [dados]).toMatchObject([{ user_id: id, nome }]);
  await expect(page.getByRole("region", { name: "Treino", exact: true }).getByText(fase, { exact: true })).toBeVisible();
}

test("o login seguinte busca o perfil da própria conta quando a limpeza dos caches demora", async ({ page }) => {
  test.slow(); // Três logins no mesmo navegador, com uma recarga entre as duas saídas.
  await resetarMock();
  await definirCota(2);
  await fixarRelogio(page);
  const a = await usuarioComPerfil({ nome: "Ana" });
  const emailB = "perfil-b@example.test";
  const b = await sessaoNoMock(emailB);
  await atualizarNoMock(b, "profiles", `user_id=eq.${b.userId}`, {
    nome: "Beatriz", altura_cm: 175, data_inicio: "2026-09-14", fase_atual: "fase2", fase_desde: "2026-09-14", prefs: { guia_visto: true },
  });
  await entrarEConferirPerfil(page, EMAIL_DONO, a.userId, "Ana", "Fase 1");
  await irNaAba(page, "Mais");
  await expect.poll(() => naFila(page)).toBe(0);

  // Dentro de Sair, o navegador já apagou o IndexedDB quando começa a listar os caches do worker.
  const limpeza = await page.evaluateHandle(() => {
    const iniciou = Promise.withResolvers<void>();
    const continuar = Promise.withResolvers<void>();
    const listar = caches.keys.bind(caches);
    caches.keys = async () => {
      const nomes = await listar();
      iniciou.resolve();
      await continuar.promise;
      return nomes;
    };
    return { iniciou: iniciou.promise, liberar: continuar.resolve };
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await limpeza.evaluate(etapa => etapa.iniciou);
  // Dá ao debounce de 1 segundo a chance de gravar enquanto CacheStorage continua ocupado.
  await page.clock.runFor(1_100);
  await limpeza.evaluate(etapa => etapa.liberar());
  await expect(page).toHaveURL(/\/login$/);

  await entrarEConferirPerfil(page, emailB, b.userId, "Beatriz", "Fase 2");
  await page.reload();
  await expect(page.getByRole("region", { name: "Treino", exact: true }).getByText("Fase 2", { exact: true })).toBeVisible();
  await irNaAba(page, "Mais");
  await expect.poll(() => naFila(page)).toBe(0);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarEConferirPerfil(page, EMAIL_DONO, a.userId, "Ana", "Fase 1");
});

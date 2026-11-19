import { expect, test } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import { abrirSecaoDoRelatorio, entrarNoApp, fixarData, inserirNoMock, resetarMock, semRolagemHorizontal, usuarioComPerfil } from "./fixtures";

const TITULO = "Core no tatame com flexão de braço";
const ORIGEM = "a3fa9934-ab32-47cb-92e2-82c4b57222b5";

async function semearOrigem() {
  await resetarMock();
  const conta = await usuarioComPerfil();
  await inserirNoMock(conta, "sessions", [{
    id: ORIGEM, data: "2026-09-14", workout_id: "livre", fase: "fase1", status: "concluida",
    iniciada_em: "2026-09-14T07:00:00Z", concluida_em: "2026-09-14T07:30:00Z", duracao_s: 1800,
    plano: planoDaSessao(itensDeIds(["flexao-de-braco", "abdominal-supra"]), { titulo: TITULO }),
  }]);
  return conta;
}

for (const tema of ["light", "dark"] as const) {
  test(`repetir treino no histórico a 360 px com teclado e texto a 125% no tema ${tema}`, async ({ page }, info) => {
    await semearOrigem();
    await fixarData(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await entrarNoApp(page);
    await page.goto("/relatorio");
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${tema}\\b`));
    await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
    await abrirSecaoDoRelatorio(page, "historico");
    const registro = page.getByRole("list", { name: "Registros", exact: true })
      .getByRole("listitem").filter({ hasText: TITULO });
    const series = registro.getByRole("button", { name: `Ver séries de ${TITULO} de 14/09/2026`, exact: true });
    const repetir = registro.getByRole("button", { name: `Repetir treino: ${TITULO} de 14/09/2026`, exact: true });
    await expect(series.getByRole("button")).toHaveCount(0);
    await series.focus();
    await page.keyboard.press("Enter");
    const detalhe = page.getByRole("dialog", { name: "Séries do treino", exact: true });
    await expect(detalhe.getByRole("heading", { name: "Séries do treino", exact: true })).toBeFocused();
    await expect(detalhe).toContainText("Nenhuma série registrada neste treino.");
    expect(await detalhe.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await semRolagemHorizontal(page);
    await page.keyboard.press("Escape");
    await expect(series).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(repetir).toBeFocused();
    // Um viewport rolável ainda pode ter a navegação fixa por cima do botão.
    await repetir.evaluate(el => el.scrollIntoView({ block: "center" }));
    const caixa = await repetir.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(44);
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    expect(await repetir.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
    expect(caixa!.x).toBeGreaterThanOrEqual(0);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(360);
    expect(await registro.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.keyboard.press("Tab");
    const nota = registro.getByRole("button", { name: "Adicionar nota do treino" });
    await expect(nota).toBeFocused();
    expect((await nota.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Shift+Tab");
    await expect(repetir).toBeFocused();
    await semRolagemHorizontal(page);
    await info.attach(`repetir-treino-${tema}`, { body: await page.screenshot(), contentType: "image/png" });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url => /^\/treinar\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(ORIGEM));
  });
}

test.describe("feedback ao repetir", () => {
  test.use({ serviceWorkers: "block" });

  test("a consulta informa a abertura e uma falha permite tentar novamente no mesmo registro", async ({ page }) => {
    const conta = await semearOrigem();
    await inserirNoMock(conta, "sessions", [{
      id: "50399bbf-c54b-48ca-b266-3accdac06f7e", data: "2026-09-14", workout_id: "livre",
      fase: "fase1", status: "concluida", iniciada_em: "2026-09-14T06:00:00Z", concluida_em: "2026-09-14T06:20:00Z",
      plano: planoDaSessao(itensDeIds(["abdominal-supra"]), { titulo: "Abdominais" }),
    }]);
    await fixarData(page);
    await entrarNoApp(page);
    await page.goto("/relatorio");
    await abrirSecaoDoRelatorio(page, "historico");
    const lista = page.getByRole("list", { name: "Registros", exact: true });
    const registro = lista.getByRole("listitem").filter({ hasText: TITULO });
    const repetir = registro.getByRole("button", { name: /^Repetir treino:/ });
    const outra = lista.getByRole("button", { name: /^Repetir treino: Abdominais/ });
    await expect(repetir).toBeEnabled();
    let liberar!: () => void;
    const suspensa = new Promise<void>(resolver => { liberar = resolver; });
    await page.route(url => url.pathname === "/rest/v1/sessions" && url.searchParams.get("status") === "eq.em_andamento",
      async rota => {
        await suspensa;
        await rota.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "Indisponível" }) });
      }, { times: 1 });
    try {
      await repetir.click();
      await expect(repetir).toBeDisabled();
      await expect(repetir).toHaveAttribute("aria-busy", "true");
      await expect(repetir).toContainText("Abrindo treino");
      await expect(outra).toBeDisabled();
    } finally {
      liberar();
    }
    await expect(registro.getByRole("alert")).toBeVisible();
    await expect(repetir).toBeEnabled();
    await expect(outra).toBeEnabled();
    await repetir.click();
    await expect(page).toHaveURL(url => /^\/treinar\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(ORIGEM));
  });
});

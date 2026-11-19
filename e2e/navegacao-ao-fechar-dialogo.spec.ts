import { expect, test } from "@playwright/test";
import { entrarNoApp, fixarData, resetarMock, usuarioComPerfil } from "./fixtures";

declare global {
  interface Window {
    avisarFocoDoDia: (saiu: boolean) => Promise<void>;
  }
}

// A resposta do documento fica a cargo da rota do teste, inclusive quando é uma recarga.
test.use({ serviceWorkers: "block" });

const percursos = [
  { acao: "recarregar o histórico", inicio: "/calendario?dia=2026-08-17", botao: /^quarta 19\/08/, data: "19 de agosto", mes: "agosto" },
  { acao: "recarregar a programação futura", inicio: "/calendario", botao: /^sexta 16\/10/, data: "16 de outubro", mes: "outubro" },
  { acao: "abrir Mais", inicio: "/calendario", botao: /^quarta 16\/09/, data: "16 de setembro", mes: "setembro" },
] as const;

for (const percurso of percursos) {
  test(`fechar o diálogo deixa o navegador ${percurso.acao} mesmo com a resposta do documento pendente`, async ({ page }) => {
    await resetarMock();
    await usuarioComPerfil();
    await fixarData(page, "2026-09-14T08:00:00-03:00");
    await entrarNoApp(page);
    await page.goto(percurso.inicio);
    if (percurso.mes === "outubro") await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
    const dia = page.getByRole("button", { name: percurso.botao });
    const nomeDoDia = await dia.getAttribute("aria-label");
    await dia.click();
    await expect(page.getByRole("dialog")).toContainText(percurso.data + " de 2026");
    const fechamento = Promise.withResolvers<boolean>();
    await page.exposeFunction("avisarFocoDoDia", fechamento.resolve);
    await page.evaluate(nome => {
      document.addEventListener("focusin", evento => {
        if (evento.target instanceof HTMLButtonElement && evento.target.getAttribute("aria-label") === nome) {
          void window.avisarFocoDoDia(document.querySelector('[role="dialog"]') === null);
        }
      });
    }, nomeDoDia);

    const recarregar = percurso.acao !== "abrir Mais";
    const caminho = recarregar ? "/calendario" : "/mais";
    await page.route(url => url.pathname === caminho, async rota => {
      if (!rota.request().isNavigationRequest()) return rota.continue();
      // O documento antigo devolve o foco ao dia enquanto a resposta nova está em trânsito.
      await page.keyboard.press("Escape");
      expect(await fechamento.promise).toBe(true);
      await rota.continue();
    });
    const resposta = recarregar ? await page.reload() : await page.goto(caminho);
    expect(resposta?.ok()).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (recarregar) {
      await expect(page.getByRole("region", { name: `Mês de ${percurso.mes} de 2026` })).toBeVisible();
      await expect(dia).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Mais", exact: true, level: 1 })).toBeVisible();
    }
  });
}

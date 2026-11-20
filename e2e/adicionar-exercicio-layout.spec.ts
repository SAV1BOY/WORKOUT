import { expect, test, type Locator } from "@playwright/test";
import { abrirVisaoGeral, fixarData, resetarMock } from "./fixtures";
import { abrirCatalogo, busca, catalogo, geral, NOME, treinoAberto } from "./treino-livre-ativo";

function pontoDeToque(alvo: Locator) {
  return alvo.evaluate(el => {
    const r = el.getBoundingClientRect();
    const folha = el.closest('[role="dialog"]')!.getBoundingClientRect();
    const topo = Math.max(r.top, folha.top, 0);
    const fundo = Math.min(r.bottom, folha.bottom, innerHeight);
    const x = r.left + r.width / 2;
    const y = (topo + fundo) / 2;
    const alcancavel = fundo - topo >= 44 &&
      [y - 21, y, y + 21].every(altura => el.contains(document.elementFromPoint(x, altura)));
    return alcancavel ? { x, y } : null;
  });
}

test("o resultado do catálogo recebe foco e toque a 320 × 420 com fonte a 200%", async ({ page, context, browserName }) => {
  await resetarMock();
  await fixarData(page);
  await treinoAberto(page);
  await abrirVisaoGeral(page);
  await abrirCatalogo(page).click();
  await page.setViewportSize({ width: 320, height: 420 });
  await page.addStyleTag({ content: "html { font-size: 200% !important }" });

  const folha = catalogo(page);
  await expect(folha.getByRole("heading", { name: "Adicionar exercício" })).toBeFocused();
  await page.keyboard.press("Tab");
  const pesquisa = busca(page);
  await expect(pesquisa).toBeFocused();
  await pesquisa.fill(NOME);
  await page.keyboard.press("Tab");
  await expect(folha.getByRole("combobox", { name: "Grupo muscular" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" })).toBeFocused();
  await page.keyboard.press("Tab");
  const resultado = folha.getByRole("button", { name: `Adicionar ${NOME}`, exact: true });
  await expect(resultado).toBeFocused();
  await expect.poll(() => pontoDeToque(resultado), { message: "resultado focado na área de toque" }).not.toBeNull();

  if (browserName === "chromium") {
    // Partindo da busca, o gesto precisa revelar a linha sem ajuda de locator.tap().
    await pesquisa.focus();
    await expect.poll(() => pontoDeToque(resultado)).toBeNull();
    const gestos = await context.newCDPSession(page);
    try {
      await gestos.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 160, y: 380 }] });
      for (const y of [345, 300, 255, 210, 165, 120, 85]) {
        await gestos.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 160, y }] });
      }
      // Soltar o dedo ainda pode deixar a folha em movimento: o primeiro toque
      // nessa fase interrompe a inércia. Aguarda o fim da rolagem deste gesto.
      const rolagem = await folha.evaluateHandle(el => {
        const estado = { terminou: false };
        el.addEventListener("scrollend", () => { estado.terminou = true; }, { capture: true, once: true });
        return estado;
      });
      await gestos.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => rolagem.evaluate(estado => estado.terminou), { message: "fim da rolagem após soltar o dedo" }).toBe(true);
      await rolagem.dispose();
    } finally {
      await gestos.detach();
    }
    await expect.poll(() => pontoDeToque(resultado), { message: "resultado ao arrastar a folha" }).not.toBeNull();
  }
  const toque = await resultado.evaluateHandle(el => {
    const estado = { recebido: false };
    el.addEventListener("click", e => { estado.recebido = e.isTrusted; }, { once: true });
    return estado;
  });
  const ponto = (await pontoDeToque(resultado))!;
  await page.touchscreen.tap(ponto.x, ponto.y);
  await expect.poll(() => toque.evaluate(estado => estado.recebido), { message: "o toque acionou a linha do exercício" }).toBe(true);
  await toque.dispose();
  await expect(geral(page).getByRole("heading", { name: `3. ${NOME}`, exact: true })).toBeVisible();
  await expect(abrirCatalogo(page)).toBeFocused();
});

import { expect, test, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, comecarNoPlayer, entrarNoApp, esperarAbaTreino,
  esperarServiceWorker, fixarData, HOJE_FIXO, inserirNoMock, irNaAba, lerDoMock,
  resetarMock, semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

/** Procurar o botão rolando para baixo não pode esconder um alvo fora da largura da tela. */
async function tocarNoCentro(page: Page, nome: string) {
  const botao = page.getByRole("button", { name: nome, exact: true });
  const alvo = await botao.evaluate(el => {
    window.scrollTo({ left: 0, top: window.scrollY + el.getBoundingClientRect().top - innerHeight / 3, behavior: "instant" });
    const { left, right, top, width, height } = el.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    return { x, y, inteiro: left >= 0 && right <= document.documentElement.clientWidth,
      atingivel: el.contains(document.elementFromPoint(x, y)) };
  });
  expect(alvo.inteiro, `${nome} deve caber sem rolagem horizontal`).toBe(true);
  expect(alvo.atingivel, `${nome} deve receber o toque`).toBe(true);
  await page.touchscreen.tap(alvo.x, alvo.y);
}

async function abrirPrancha(page: Page) {
  await resetarMock();
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await fixarData(page);
  const id = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id, data: "2026-09-14", iniciada_em: HOJE_FIXO, status: "em_andamento", workout_id: "livre", fase: "fase1",
    plano: planoDaSessao(itensDeIds(["prancha-lateral"])),
  }]);
  await entrarNoApp(page);
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  const direito = page.getByRole("textbox", { name: "segundos do lado direito", exact: true });
  const esquerdo = page.getByRole("textbox", { name: "segundos do lado esquerdo", exact: true });
  const contagem = page.getByRole("timer", { name: "Contagem do exercício" });
  const hora = (segundos: number) => fixarData(page, new Date(Date.parse(HOJE_FIXO) + segundos * 1000).toISOString());
  return { conta, id, direito, esquerdo, contagem, hora };
}

test("a prancha lateral a 320 px permite tocar nos dois lados, retomar offline e registrar os tempos distintos", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const { conta, id, direito, esquerdo, contagem, hora } = await abrirPrancha(page);
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await direito.fill("35");
  await direito.press("Enter");
  await esquerdo.fill("50");
  await esquerdo.press("Enter");
  await tocarNoCentro(page, "Aumentar segundos do lado direito");
  await expect(direito).toHaveValue("40");
  await expect(esquerdo).toHaveValue("50");
  await tocarNoCentro(page, "Diminuir segundos do lado direito");
  await expect(direito).toHaveValue("35");
  await tocarNoCentro(page, "Aumentar segundos do lado direito");
  await tocarNoCentro(page, "Diminuir segundos do lado esquerdo");
  await expect(esquerdo).toHaveValue("45");
  await tocarNoCentro(page, "Aumentar segundos do lado esquerdo");
  await expect(esquerdo).toHaveValue("50");
  await expect(contagem).toHaveText("0:40");
  await semRolagemHorizontal(page);

  await tocarNoCentro(page, "Começar");
  await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
  await hora(2);
  await expect(contagem).toHaveText("0:38");
  await tocarNoCentro(page, "Pausar");
  await hora(12);
  await expect(contagem).toHaveText("0:38");
  await tocarNoCentro(page, "Continuar");
  await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
  await hora(15);
  await expect(contagem).toHaveText("0:35");
  await page.setViewportSize({ width: 740, height: 320 });
  await hora(16);
  await expect(contagem).toHaveText("0:34");
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeVisible();
  await expect(contagem).toHaveText("0:34");
  await hora(26);
  await expect(contagem).toHaveText("0:34");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await tocarNoCentro(page, "Continuar");
  await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
  await hora(28);
  await expect(contagem).toHaveText("0:32");
  await expect(esquerdo).toHaveValue("50");
  await page.getByRole("button", { name: "Concluir série", exact: true }).tap();
  await expect(page.getByRole("timer", { name: "Descanso", exact: true })).toBeVisible();
  expect(await lerDoMock(conta, "session_sets", `session_id=eq.${id}`)).toEqual([]);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => lerDoMock(conta, "session_sets", `session_id=eq.${id}`)).toMatchObject([
    { exercise_id: "prancha-lateral", tipo: "trabalho", set_index: 1, tempo_s: 8, tempo_s_lado2: 50, concluida: true },
  ]);
});

for (const esperado of [0, 35]) {
  const cenario = esperado === 0 ? "concluir no instante de começar" : "concluir sete segundos após o fim";
  test(`prancha lateral: ${cenario} registra ${esperado} s à direita e 25 s à esquerda`, async ({ page }) => {
    const { conta, id, direito, esquerdo, contagem, hora } = await abrirPrancha(page);
    await direito.fill("35");
    await direito.press("Enter");
    await esquerdo.fill("25");
    await esquerdo.press("Enter");
    await expect(contagem).toHaveText("0:35");
    await page.getByRole("button", { name: "Começar", exact: true }).tap();
    if (esperado === 35) {
      await hora(34);
      await expect(contagem).toHaveText("0:01");
      await hora(35);
      await expect(contagem).toHaveText("0:00");
      await hora(42);
    }
    await page.getByRole("button", { name: "Concluir série", exact: true }).tap();
    await expect(page.getByRole("timer", { name: "Descanso", exact: true })).toBeVisible();
    await expect.poll(() => lerDoMock(conta, "session_sets", `session_id=eq.${id}`)).toMatchObject([
      { exercise_id: "prancha-lateral", set_index: 1, tipo: "trabalho", tempo_s: esperado, tempo_s_lado2: 25, concluida: true },
    ]);

    await abrirVisaoGeral(page);
    await page.getByRole("dialog", { name: "Visão geral do treino" }).getByRole("button", { name: "Concluir", exact: true }).click();
    await page.getByRole("dialog", { name: "Treino concluído" }).getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);
    await irNaAba(page, "Relatório");
    await abrirSecaoDoRelatorio(page, "historico");
    await page.getByRole("list", { name: "Registros" }).getByRole("button", { name: /^Ver séries de / }).click();
    const linhas = page.getByRole("dialog", { name: "Séries do treino" }).getByRole("listitem");
    await expect(linhas).toHaveCount(1);
    await expect(linhas).toContainText([`${esperado} s à direita · 25 s à esquerda`]);
  });
}

import { expect, test } from "@playwright/test";
import { acharExercicio } from "../lib/dados";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { LinhaSerie, LinhaSessao, PlanoDaSessao } from "../lib/types";
import {
  avancarNoPlayerAte, comecarNoPlayer, entrarNoApp, esperarServiceWorker, fixarData,
  HOJE_FIXO, inserirNoMock, lerDoMock, naFila, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

test("consultar uma alternativa sem rede durante o descanso conserva o tempo e a série de supino", async ({ page, context }) => {
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, descanso_padrao_s: 90, avancar_sozinho: false } });
  const id = crypto.randomUUID();
  const supino = acharExercicio("supino-reto-com-barra");
  const flexao = acharExercicio("flexao-de-braco");
  const plano: PlanoDaSessao = {
    ...planoDaSessao(itensDeIds([supino.id])),
    equipamento_disponivel: ["tatame", "super-band"],
  };
  await inserirNoMock(conta, "sessions", [{
    id, data: "2026-09-14", workout_id: "livre", fase: "fase1", status: "em_andamento", iniciada_em: HOJE_FIXO, plano,
  }]);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  const tela = page.getByRole("region", { name: supino.nome, exact: true });
  await avancarNoPlayerAte(page, tela.getByText("Série 1 de 3 · exercício 1 de 1", { exact: true }));
  const reps = tela.getByRole("textbox", { name: "repetições", exact: true });
  await reps.fill("9");
  await reps.press("Enter");
  const carga = tela.getByRole("textbox", { name: "carga na barra", exact: true });
  await carga.fill("25,5");
  await carga.press("Enter");
  await tela.getByRole("button", { name: "Concluir série", exact: true }).click();
  const descanso = page.getByRole("region", { name: "Descanso", exact: true });
  const timer = descanso.getByRole("timer", { name: "Descanso", exact: true });
  await expect(timer).toHaveText("1:30");
  const series = () => lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}&tipo=eq.trabalho`);
  await expect.poll(series).toMatchObject([{ id: expect.any(String), exercise_id: supino.id, set_index: 1, reps: 9, carga_kg: 25.5 }]);
  const gravadas = await series();
  await expect.poll(() => naFila(page)).toBe(0);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);

  const comoFazer = descanso.getByRole("button", { name: `Como fazer: ${supino.nome}`, exact: true });
  await comoFazer.press("Enter");
  const ficha = page.getByRole("dialog", { name: supino.nome, exact: true });
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  const tatame = ficha.getByRole("button", { name: "Tatame", exact: true });
  await tatame.click();
  const ver = ficha.getByRole("button", { name: `Ver execução de ${flexao.nome}`, exact: true });
  await expect(ver).toBeVisible();
  await ver.press("Enter");
  const previa = ficha.getByRole("region", { name: `Execução de ${flexao.nome}`, exact: true });
  await expect(previa.getByText(flexao.montagem, { exact: true })).toBeVisible();
  await expect(previa.getByRole("listitem")).toHaveText(flexao.passos);
  await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 17_000).toISOString());
  await page.keyboard.press("Escape");
  await expect(previa).toBeHidden();
  await expect(ver).toBeFocused();
  await expect(tatame).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(comoFazer).toBeFocused();
  await expect(timer).toHaveText("1:13");
  await expect.poll(() => naFila(page)).toBe(0);

  await semRedeNoWorker(await workerDoApp(context));
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(timer).toHaveText("1:13");
  await descanso.getByRole("button", { name: "Pular descanso", exact: true }).click();
  await expect(tela.getByText("Série 2 de 3 · exercício 1 de 1", { exact: true })).toBeVisible();
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await series()).toEqual(gravadas);
  const [atual] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
  expect(atual?.plano).toEqual(plano);
});

import { expect, test } from "@playwright/test";
import { acharExercicio } from "../lib/dados";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { LinhaSerie, LinhaSessao, PlanoDaSessao } from "../lib/types";
import {
  avancarNoPlayerAte, comecarNoPlayer, entrarNoApp, esperarServiceWorker, fixarData,
  HOJE_FIXO, inserirNoMock, lerDoMock, naFila, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

test("buscar alternativas durante o descanso offline conserva o material, o relógio e a série de pullover", async ({ page, context }) => {
  test.slow(); // Abre a ficha no descanso e recarrega o player pelo service worker sem rede.
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, descanso_padrao_s: 90, avancar_sozinho: false } });
  const id = crypto.randomUUID();
  const pullover = acharExercicio("pullover-com-halter");
  const plano: PlanoDaSessao = {
    ...planoDaSessao(itensDeIds([pullover.id])),
    equipamento_disponivel: ["anilhas", "banco", "barra-macica", "cross-over", "halteres", "puxadores"],
  };
  await inserirNoMock(conta, "sessions", [{
    id, data: "2026-09-14", workout_id: "livre", fase: "fase1", status: "em_andamento", iniciada_em: HOJE_FIXO, plano,
  }]);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  const tela = page.getByRole("region", { name: pullover.nome, exact: true });
  await avancarNoPlayerAte(page, tela.getByText("Série 1 de 3 · exercício 1 de 1", { exact: true }));
  const reps = tela.getByRole("textbox", { name: "repetições", exact: true });
  await reps.fill("11");
  await reps.press("Enter");
  const carga = tela.getByRole("textbox", { name: "carga por halter", exact: true });
  await carga.fill("7,5");
  await carga.press("Enter");
  await tela.getByRole("button", { name: "Concluir série", exact: true }).click();
  const descanso = page.getByRole("region", { name: "Descanso", exact: true });
  const timer = descanso.getByRole("timer", { name: "Descanso", exact: true });
  await expect(timer).toHaveText("1:30");
  const series = () => lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}&tipo=eq.trabalho`);
  await expect.poll(series).toMatchObject([{ id: expect.any(String), exercise_id: pullover.id, set_index: 1, reps: 11, carga_kg: 7.5 }]);
  const gravadas = await series();
  await expect.poll(() => naFila(page)).toBe(0);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);

  const comoFazer = descanso.getByRole("button", { name: `Como fazer: ${pullover.nome}`, exact: true });
  await comoFazer.press("Enter");
  const ficha = page.getByRole("dialog", { name: pullover.nome, exact: true });
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  const outro = ficha.getByRole("button", { name: "Outro equipamento", exact: true });
  await outro.click();
  const linhas = ficha.getByRole("list", { name: "Exercícios alternativos" }).getByRole("listitem");
  const antes = await linhas.allTextContents();
  const busca = ficha.getByRole("searchbox", { name: "Buscar alternativa pelo nome" });
  await expect(busca).toBeVisible();
  await busca.fill("triangulo puxada");
  await expect(linhas).toHaveCount(1);
  const ver = linhas.getByRole("button", { name: "Ver execução de Puxada com triângulo", exact: true });
  await ver.press("Enter");
  await expect(ficha.getByRole("region", { name: "Execução de Puxada com triângulo" })).toBeVisible();
  await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 17_000).toISOString());
  await page.keyboard.press("Escape");
  await expect(ver).toBeFocused();
  await expect(busca).toHaveValue("triangulo puxada");

  await busca.fill("remada curvada");
  await expect(linhas).toHaveCount(2);
  await expect(linhas).toContainText(["Remada curvada supinada", "Remada curvada pronada"]);
  await busca.fill("agachamento goblet");
  await expect(linhas).toHaveCount(0);
  await expect(ficha.getByRole("status")).toHaveText("Nenhuma alternativa com esse nome.");
  await ficha.getByRole("button", { name: "Limpar busca", exact: true }).press("Enter");
  await expect(busca).toBeFocused();
  await expect(busca).toHaveValue("");
  await expect(outro).toHaveAttribute("aria-pressed", "true");
  await expect(linhas).toHaveText(antes);
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

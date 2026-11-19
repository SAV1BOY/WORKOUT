import { expect, test, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  avancarNoPlayerAte, comecarNoPlayer, entrarNoApp, esperarServiceWorker, fixarData,
  inserirNoMock, lerDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const SUPINO = "supino-reto-com-barra";
const AGACHAMENTO = "agachamento-frontal";

function sessao(data: string, exercicios: string[], concluida: boolean) {
  return {
    id: crypto.randomUUID(), workout_id: "livre", fase: "fase1", data,
    plano: planoDaSessao(itensDeIds(exercicios)), status: concluida ? "concluida" : "em_andamento",
    iniciada_em: data + "T07:00:00Z", concluida_em: concluida ? data + "T07:30:00Z" : null,
  };
}

function serie(treino: ReturnType<typeof sessao>, exercicio: string, numero: number, reps: number, carga: number) {
  return {
    id: crypto.randomUUID(), session_id: treino.id, exercise_id: exercicio, ordem_ex: 1,
    set_index: numero, reps, carga_kg: carga, tipo: "trabalho", concluida: true,
    registrada_em: `${treino.data}T07:0${numero}:00Z`,
  };
}

function segundaSerie(page: Page) {
  return page.getByText("Série 2 de 3 · exercício 1 de 2", { exact: true });
}

async function conferirSupino(page: Page) {
  const supino = page.getByRole("region", { name: "Supino reto com barra", exact: true });
  await expect(segundaSerie(page)).toBeVisible();
  await expect(supino.getByText(/^anterior\b/)).toHaveText("anterior: 22,5 kg na barra × 8");
}

test("o supino conserva a referência da segunda série após 124 séries mais recentes de outro exercício do treino, inclusive na reabertura offline", async ({ page, context }) => {
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  const supino = sessao("2026-05-04", [SUPINO], true);
  const agachamentos = Array.from({ length: 31 }, (_, i) => {
    const data = new Date(Date.UTC(2026, 4, 6 + i * 4)).toISOString().slice(0, 10);
    return sessao(data, [AGACHAMENTO], true);
  });
  const hoje = sessao("2026-09-14", [SUPINO, AGACHAMENTO], false);
  await inserirNoMock(conta, "sessions", [supino, ...agachamentos, hoje]);
  await inserirNoMock(conta, "session_sets", [
    serie(supino, SUPINO, 1, 10, 20), serie(supino, SUPINO, 2, 8, 22.5),
    ...agachamentos.flatMap(treino => [1, 2, 3, 4].map(n => serie(treino, AGACHAMENTO, n, 10, 30))),
  ]);

  // Confere no PostgREST do teste que a janela global realmente exclui o supino.
  const recentes = await lerDoMock<{ exercise_id: string }>(conta, "session_sets",
    "select=exercise_id&tipo=eq.trabalho&concluida=eq.true&order=registrada_em.desc&limit=120");
  expect(recentes.map(s => s.exercise_id)).toEqual(Array(120).fill(AGACHAMENTO));

  await entrarNoApp(page);
  await page.goto(`/treinar/${hoje.id}`);
  await comecarNoPlayer(page);
  await avancarNoPlayerAte(page, segundaSerie(page));
  await conferirSupino(page);

  const url = page.url();
  await esperarServiceWorker(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await page.close();
  const reaberta = await context.newPage();
  await fixarData(reaberta);
  await reaberta.goto(url);
  await conferirSupino(reaberta);
});

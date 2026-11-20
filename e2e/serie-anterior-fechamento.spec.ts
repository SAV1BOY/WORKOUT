import { expect, test } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, avancarNoPlayerAte, comecarNoPlayer, entrarNoApp,
  esperarAbaTreino, esperarServiceWorker, fixarData, inserirNoMock, irNaAba,
  marcarSerieNaVisaoGeral, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { FRONTAL, geral, NOME, series } from "./treino-livre-ativo";

test("repetir um treino encerrado sem rede compara com a série que acabou de ser salva no aparelho", async ({ page, context }) => {
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  const antiga = crypto.randomUUID();
  const atual = crypto.randomUUID();
  const titulo = "Treino livre de segunda";
  const plano = planoDaSessao(itensDeIds([FRONTAL]), { titulo });
  await inserirNoMock(conta, "sessions", [
    { id: antiga, data: "2026-09-07", status: "concluida", workout_id: "livre", fase: "fase1",
      plano: { ...plano, titulo: "Treino da semana passada" }, iniciada_em: "2026-09-07T10:00:00Z", concluida_em: "2026-09-07T10:30:00Z" },
    { id: atual, data: "2026-09-14", status: "em_andamento", workout_id: "livre", fase: "fase1",
      plano, iniciada_em: "2026-09-14T10:00:00Z" },
  ]);
  await inserirNoMock(conta, "session_sets", [{
    id: crypto.randomUUID(), session_id: antiga, exercise_id: FRONTAL, ordem_ex: 1, set_index: 1,
    tipo: "trabalho", reps: 6, carga_kg: 19.5, concluida: true, registrada_em: "2026-09-07T10:10:00Z",
  }]);
  await entrarNoApp(page);
  await page.goto(`/treinar/${atual}`);
  await comecarNoPlayer(page);
  const agachamento = page.getByRole("region", { name: NOME, exact: true });
  const primeira = agachamento.getByText(/^Série 1 de \d+ · exercício 1 de 1$/);
  const referencia = agachamento.getByText(/^anterior\b/);
  await avancarNoPlayerAte(page, primeira);
  await expect(referencia).toHaveText("anterior: 19,5 kg na barra × 6");

  await esperarServiceWorker(page);
  await abrirVisaoGeral(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const linha = geral(page).getByRole("group", { name: `Série 1 — ${NOME}`, exact: true });
  await linha.getByRole("textbox", { name: "repetições" }).fill("9");
  const carga = linha.getByRole("textbox", { name: "carga na barra" });
  await carga.fill("31,5");
  await marcarSerieNaVisaoGeral(linha.getByRole("checkbox"));
  await expect(carga).toHaveValue("31,5");
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog", { name: "Treino concluído" }).getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);

  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  const registro = page.getByRole("list", { name: "Registros" }).getByRole("listitem").filter({ hasText: titulo });
  await registro.getByRole("button", { name: /^Ver séries de / }).click();
  const detalhe = page.getByRole("dialog", { name: "Séries do treino" });
  await expect(detalhe).toContainText("9 repetições · 31,5 kg na barra");
  await detalhe.getByRole("button", { name: "Fechar", exact: true }).click();
  expect(await series(conta, atual)).toEqual([]);
  await registro.getByRole("button", { name: /^Repetir treino:/ }).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  expect(page.url()).not.toContain(atual);
  await comecarNoPlayer(page);
  await avancarNoPlayerAte(page, primeira);
  await expect(referencia).toHaveText("anterior: 31,5 kg na barra × 9");
});

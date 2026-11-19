import { expect, test, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  abrirVisaoGeral, avancarNoPlayerAte, atualizarNoMock, comecarNoPlayer, concluirSerie,
  definirCota, entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, inserirNoMock,
  irNaAba, lerDoMock, resetarMock, sessaoNoMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const SUPINO = "supino-reto-com-barra";
const NOME = "Supino reto com barra";
const PLANO = planoDaSessao(itensDeIds([SUPINO]));
const PREFS = { guia_visto: true, preparacao_s: 0, descanso_padrao_s: 60, avancar_sozinho: false };
const tela = (page: Page) => page.getByRole("region", { name: NOME, exact: true });
const referencia = (page: Page) => tela(page).getByText(/^anterior\b/);
const trabalho = (page: Page, n: number) => tela(page).getByText(`Série ${n} de 3 · exercício 1 de 1`, { exact: true });

async function criarSessao(conta: SessaoMock, data: string, concluida: boolean) {
  const id = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id, workout_id: "livre", fase: "fase1", data, plano: PLANO,
    status: concluida ? "concluida" : "em_andamento", iniciada_em: data + "T07:00:00Z",
    concluida_em: concluida ? data + "T07:30:00Z" : null,
  }]);
  return id;
}

function serie(session_id: string, data: string, set_index: number, reps: number, carga_kg: number) {
  return {
    id: crypto.randomUUID(), session_id, exercise_id: SUPINO, ordem_ex: 1, set_index, reps, carga_kg,
    tipo: "trabalho", concluida: true, registrada_em: `${data}T07:0${set_index}:00Z`,
  };
}

async function abrirPlayer(page: Page, id: string) {
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("o supino compara o número registrado, identifica a última série usada como alternativa e continua na mesma etapa sem rede", async ({ page, context }) => {
  const conta = await usuarioComPerfil({ prefs: PREFS });
  const antiga = await criarSessao(conta, "2026-09-10", true);
  const anterior = await criarSessao(conta, "2026-09-13", true);
  const atual = await criarSessao(conta, "2026-09-14", false);
  await inserirNoMock(conta, "session_sets", [
    serie(antiga, "2026-09-10", 1, 12, 17.5),
    serie(anterior, "2026-09-13", 3, 8, 22.5),
    { ...serie(anterior, "2026-09-13", 1, 12, 19.5), concluida: false },
    serie(anterior, "2026-09-13", 2, 10, 20),
    { ...serie(anterior, "2026-09-13", 1, 5, 7.5), tipo: "aquecimento" },
  ]);
  await entrarNoApp(page);
  await abrirPlayer(page, atual);
  await expect(tela(page).getByText("Aquecimento 1 de 2 · exercício 1 de 1", { exact: true })).toBeVisible();
  await expect(referencia(page)).toHaveCount(0);
  await avancarNoPlayerAte(page, trabalho(page, 1));
  await expect(referencia(page)).toHaveText("anterior · série 3: 22,5 kg na barra × 8");

  await concluirSerie(page);
  await expect(trabalho(page, 2)).toBeVisible();
  await expect(referencia(page)).toHaveText("anterior: 20 kg na barra × 10");
  const url = page.url();
  await esperarServiceWorker(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await page.close();
  const retomada = await context.newPage();
  try {
    await fixarData(retomada);
    await retomada.goto(url);
    await expect(trabalho(retomada, 2)).toBeVisible();
    await expect(referencia(retomada)).toHaveText("anterior: 20 kg na barra × 10");
    await concluirSerie(retomada);
    await expect(trabalho(retomada, 3)).toBeVisible();
    await expect(referencia(retomada)).toHaveText("anterior: 22,5 kg na barra × 8");
    await expect(retomada).toHaveURL(url);
    const anteriores = await lerDoMock(conta, "session_sets",
      `session_id=eq.${anterior}&tipo=eq.trabalho&concluida=eq.true&order=set_index.asc`);
    expect(anteriores).toMatchObject([{ set_index: 2, reps: 10, carga_kg: 20 }, { set_index: 3, reps: 8, carga_kg: 22.5 }]);

    // Outro aparelho corrige a terceira série enquanto este só tem a cópia anterior.
    await atualizarNoMock(conta, "session_sets", `session_id=eq.${anterior}&tipo=eq.trabalho&set_index=eq.3`, {
      reps: 7, carga_kg: 25.5,
    });
    await expect(referencia(retomada)).toHaveText("anterior: 22,5 kg na barra × 8");
    await comRedeNoWorker(await workerDoApp(context));
    await context.setOffline(false);
    await expect(referencia(retomada)).toHaveText("anterior: 25,5 kg na barra × 7");
    await expect(trabalho(retomada, 3)).toBeVisible();
  } finally {
    await retomada.close();
  }
});

test("depois de trocar de conta a referência do supino vem do treino dessa pessoa", async ({ page }) => {
  await definirCota(2);
  const primeira = await usuarioComPerfil({ prefs: PREFS });
  const email = "segunda.conta@example.test";
  const segunda = await sessaoNoMock(email);
  await atualizarNoMock(segunda, "profiles", `user_id=eq.${segunda.userId}`, {
    nome: "Ana", data_inicio: "2026-09-14", fase_atual: "fase1", prefs: PREFS,
  });
  const anteriorA = await criarSessao(primeira, "2026-09-13", true);
  const anteriorB = await criarSessao(segunda, "2026-09-12", true);
  await inserirNoMock(primeira, "session_sets", [serie(anteriorA, "2026-09-13", 1, 6, 31.5)]);
  await inserirNoMock(segunda, "session_sets", [serie(anteriorB, "2026-09-12", 1, 12, 11.5)]);
  const atualA = await criarSessao(primeira, "2026-09-14", false);
  const atualB = await criarSessao(segunda, "2026-09-14", false);
  await entrarNoApp(page);
  await abrirPlayer(page, atualA);
  await avancarNoPlayerAte(page, trabalho(page, 1));
  await expect(referencia(page)).toHaveText("anterior: 31,5 kg na barra × 6");
  await abrirVisaoGeral(page);
  await page.getByRole("link", { name: "Continuar depois" }).click();
  await esperarAbaTreino(page);
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, email);
  await abrirPlayer(page, atualB);
  await avancarNoPlayerAte(page, trabalho(page, 1));
  await expect(referencia(page)).toHaveText("anterior: 11,5 kg na barra × 12");
});

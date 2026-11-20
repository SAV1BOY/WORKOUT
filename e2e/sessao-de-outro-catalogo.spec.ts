import { expect, test, type Page } from "@playwright/test";
import type { ItemSaida } from "../lib/db";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { SessaoLocal } from "../lib/sessao";
import type { PlanoDaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, entrarNoApp, esperarServiceWorker, fixarData, HOJE_FIXO,
  inserirNoMock, lerDoMock, marcarSerieNaVisaoGeral, naFila, requisicoesDoMock, resetarMock,
  usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral, series } from "./treino-livre-ativo";

const NOVO = "movimento-de-outro-catalogo";
const SUPINO = "supino-reto-com-barra";
const ROSCA = "rosca-com-elastico";
const aviso = (page: Page) => page.getByRole("heading", { name: "Atualize o app para continuar este treino" });
type Copia = { id: string; dados: SessaoLocal; atualizadoEm: number };

// No ensaio offline, só o ID ativo vem de outro catálogo. A pessoa gravou as séries pelo player.
function aparelho(page: Page, id: string, substituirPor?: string) {
  return page.evaluate(({ id, substituirPor }) => new Promise<{ sessao?: Copia; fila: ItemSaida[] }>((ok, falha) => {
    const abertura = indexedDB.open("treino-terraco");
    abertura.onerror = () => falha(abertura.error);
    abertura.onsuccess = () => {
      const banco = abertura.result;
      const tx = banco.transaction(["sessaoAtiva", "outbox"], substituirPor ? "readwrite" : "readonly");
      const sessoes = tx.objectStore("sessaoAtiva");
      const local: IDBRequest<Copia | undefined> = sessoes.get(id);
      const fila = tx.objectStore("outbox").getAll();
      local.onsuccess = () => {
        if (substituirPor && local.result) {
          local.result.dados.blocos[0]!.exercicioId = substituirPor;
          sessoes.put(local.result);
        }
      };
      tx.oncomplete = () => { banco.close(); ok({ sessao: local.result, fila: fila.result }); };
      tx.onabort = () => { banco.close(); falha(tx.error); };
    };
  }), { id, substituirPor });
}

function serie(id: string, ordem: number, exercicio: string, reps: number) {
  return {
    id: crypto.randomUUID(), session_id: id, exercise_id: exercicio, ordem_ex: ordem,
    set_index: 1, tipo: "trabalho", reps, concluida: true, registrada_em: HOJE_FIXO,
  };
}

async function criarSessao(conta: SessaoMock, id: string, plano: PlanoDaSessao) {
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, workout_id: "livre", data: HOJE_FIXO.slice(0, 10), fase: "fase1",
    status: "em_andamento", iniciada_em: HOJE_FIXO, plano, nota_geral: "Nota deste treino",
  }]);
}

async function dadosNoServidor(conta: SessaoMock, id: string) {
  const sessoes = await lerDoMock(conta, "sessions", `id=eq.${id}`);
  const registros = await series(conta, id);
  const escritas = (await requisicoesDoMock()).filter(r => r.caminho.startsWith("/rest/v1/") && ["POST", "PATCH", "DELETE"].includes(r.metodo));
  return { sessoes, registros, escritas };
}

async function sairPeloHistorico(page: Page) {
  await expect(aviso(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Visão geral do treino" })).toHaveCount(0);
  const historico = page.getByRole("link", { name: "Ver histórico", exact: true });
  await expect(historico).toHaveAttribute("href", "/relatorio#historico");
  for (let i = 0; i < 12; i++) {
    if (await historico.evaluate(link => link === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(historico).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/relatorio#historico$/);
  await expect(page.locator('details[data-secao="historico"]')).toHaveAttribute("open", "");
}

test.beforeEach(async ({ page }) => { await resetarMock(); await fixarData(page); });

for (const origem of ["primeiro item", "substituto ativo", "substituto anterior", "série registrada"] as const) {
  test(`treino de outro aparelho com exercício desconhecido no campo ${origem} preserva posições e notas`, async ({ page }) => {
    const conta = await usuarioComPerfil();
    const id = crypto.randomUUID();
    const plano = planoDaSessao(itensDeIds([SUPINO, ROSCA]));
    if (origem === "primeiro item") plano.itens[0]!.exercicio_id = NOVO;
    if (origem === "substituto ativo" || origem === "substituto anterior") {
      const anterior = { exercicio_id: SUPINO, nota: "Nota do supino", aquecimento: [], trabalho: [1], ultima_firme: true };
      const outro = { ...anterior, exercicio_id: NOVO, nota: "Nota do outro movimento" };
      plano.trocas = { "1": origem === "substituto ativo" ? [outro, anterior] : [anterior, outro] };
    }
    await criarSessao(conta, id, plano);
    // Nas duas trocas, o plano é a única fonte do ID desconhecido.
    const primeira = serie(id, 1, origem === "primeiro item" || origem === "série registrada" ? NOVO : SUPINO, 9);
    await inserirNoMock(conta, "session_sets", [primeira, serie(id, 2, ROSCA, 11)]);
    await entrarNoApp(page);
    const antes = await dadosNoServidor(conta, id);
    expect(antes.registros.map(s => [s.ordem_ex, s.reps])).toEqual([[1, 9], [2, 11]]);
    const localAntes = await aparelho(page, id);
    expect(localAntes.sessao).toBeUndefined();
    await page.goto(`/treinar/${id}`);
    await sairPeloHistorico(page);
    expect(await aparelho(page, id)).toEqual(localAntes);
    expect(await dadosNoServidor(conta, id)).toEqual(antes);
  });
}

test("retomar sem rede um substituto desconhecido conserva a série pendente ao sair pelo Histórico", async ({ page, context }) => {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  const id = crypto.randomUUID();
  await criarSessao(conta, id, planoDaSessao(itensDeIds([SUPINO, ROSCA])));
  const anterior = serie(id, 2, ROSCA, 11);
  await inserirNoMock(conta, "session_sets", [anterior]);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.goto("/relatorio");
  await abrirSecaoDoRelatorio(page, "historico");
  await page.goto(`/treinar/${id}`);
  await abrirVisaoGeral(page);
  const visao = geral(page);
  await visao.locator("#bloco-1").getByRole("button", { name: /substituir hoje/i }).click();
  await page.getByRole("dialog", { name: "Substituir hoje" }).getByRole("button", { name: /^Flexão de braço\s/ }).click();
  await expect(visao.getByRole("heading", { name: "1. Flexão de braço" })).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(0);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  const segunda = visao.getByRole("group", { name: "Série 2 — Rosca com elástico", exact: true });
  await segunda.getByRole("textbox", { name: "repetições" }).fill("8");
  await marcarSerieNaVisaoGeral(segunda.getByRole("checkbox"));
  await expect.poll(() => naFila(page)).toBe(1);
  await page.goto("/relatorio");
  await expect(page.locator('details[data-secao="historico"]')).toBeVisible();
  const antes = await aparelho(page, id, NOVO);
  expect(antes.sessao?.dados.blocos[0]).toMatchObject({ originalId: SUPINO, exercicioId: NOVO, substituido: true });
  const feitas = antes.sessao?.dados.blocos[1]?.series.filter(s => s.concluida) ?? [];
  expect(feitas).toMatchObject([{ id: anterior.id, reps: 11 }, { reps: 8 }]);
  expect(antes.fila).toMatchObject([{ tipo: "serie", payload: { linha: { id: feitas[1]!.id, reps: 8 } } }]);
  const remoto = await dadosNoServidor(conta, id);
  expect(remoto.registros).toMatchObject([{ id: anterior.id, reps: 11 }]);
  await semRedeNoWorker(await workerDoApp(context));
  const documento = await page.goto(`/treinar/${id}`);
  expect(documento?.fromServiceWorker()).toBe(true);
  expect(documento?.status()).toBe(200);
  await sairPeloHistorico(page);
  expect(await aparelho(page, id)).toEqual(antes);
  expect(await dadosNoServidor(conta, id)).toEqual(remoto);
});

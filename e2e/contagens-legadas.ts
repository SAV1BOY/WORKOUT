import { expect, type Page } from "@playwright/test";
import { chaveDoDetalheDaSessao, chaveDoHistoricoNoDisco } from "../lib/chaves-do-historico";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import { abrirSecaoDoRelatorio, entrarNoApp, esperarServiceWorker, inserirNoMock, irNaAba, usuarioComPerfil } from "./fixtures";
import { FRONTAL } from "./treino-livre-ativo";

const DIA = "2026-09-14";
const TITULO = "Treino da varanda";

/** Formato que a versão anterior deixava no IndexedDB ao concluir o treino. */
export async function prepararFechamentoAntigo(page: Page, comWorker = true, cargaDaPrimeira = 21.5) {
  const conta = await usuarioComPerfil();
  const id = crypto.randomUUID();
  const plano = planoDaSessao(itensDeIds([FRONTAL]), { titulo: TITULO });
  const sessao = {
    id, user_id: conta.userId, workout_id: "livre", data: DIA, fase: "fase1",
    status: "em_andamento", iniciada_em: DIA + "T11:00:00Z", plano,
  };
  await inserirNoMock(conta, "sessions", [sessao]);
  await entrarNoApp(page);
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  await irNaAba(page, "Mais");
  await expect(page.getByRole("heading", { name: "Mais", exact: true })).toBeVisible();
  if (comWorker) await esperarServiceWorker(page);
  const fechada = {
    ...sessao, status: "concluida", concluida_em: DIA + "T11:30:00Z", duracao_s: 1800, nota_geral: "Voltei ao terraço.",
  };
  const serie = (indice: number, reps: number, carga: number) => ({
    id: crypto.randomUUID(), session_id: id, user_id: conta.userId, exercise_id: FRONTAL,
    ordem_ex: 1, set_index: indice, tipo: "trabalho", reps, carga_kg: carga,
    concluida: true, registrada_em: DIA + "T11:10:00Z",
  });
  const series = [serie(1, 9.5, cargaDaPrimeira), serie(2, 8.5, 23.5)] as const;
  // A pessoa corrigiu a primeira para 10 antes de concluir. A escrita 9,5 seguia na frente.
  const finais = [{ ...series[0], reps: 10 }, series[1]];
  const escritas = [...series, ...finais].map(linha => ({
    tabela: "session_sets", op: "upsert", onConflict: "id", linha,
  }));
  const agora = await page.evaluate(() => Date.now());
  const fila = [
    ...escritas.map(payload => ({ tipo: "serie", payload })),
    { tipo: "sessao", payload: { tabela: "sessions", op: "upsert", onConflict: "id", linha: fechada } },
  ].map(item => ({ ...item, alvo: "sessions:" + id, tentativas: 0, criadoEm: agora, proximaTentativa: agora }));
  const caches = [
    { chave: chaveDoHistoricoNoDisco(conta.userId), valor: [fechada] },
    { chave: chaveDoDetalheDaSessao(conta.userId, id), valor: finais },
  ].map(item => ({ ...item, atualizadoEm: agora }));
  await page.evaluate(async ({ fila, caches }) => {
    const banco = await new Promise<IDBDatabase>((ok, erro) => {
      const pedido = indexedDB.open("treino-terraco");
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => erro(pedido.error);
    });
    try {
      await new Promise<void>((ok, erro) => {
        const escrita = banco.transaction(["cache", "outbox"], "readwrite");
        escrita.oncomplete = () => ok();
        escrita.onabort = () => erro(escrita.error);
        for (const item of caches) escrita.objectStore("cache").put(item);
        for (const item of fila) escrita.objectStore("outbox").add(item);
      });
    } finally { banco.close(); }
  }, { fila, caches });
  return { conta, id, series };
}

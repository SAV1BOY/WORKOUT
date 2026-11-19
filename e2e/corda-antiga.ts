import { expect, type Page } from "@playwright/test";
import type { LinhaSessaoCardio } from "../lib/types";
import {
  abrirSecaoDoRelatorio, entrarNoApp, esperarAbaTreino, esperarServiceWorker,
  fixarData, irNaAba, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const DATA = "2026-09-14";

export function nomeDaCorda(id: string) {
  return `Corda · 14/09/2026 · Treino ${id.slice(-8)}`;
}

export async function abrirCorrecaoDaCorda(page: Page, id: string) {
  await page.getByRole("button", { name: "Corrigir contagens", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Corrigir contagens", exact: true });
  return {
    dialogo,
    formulario: dialogo.getByRole("form", { name: nomeDaCorda(id), exact: true }),
    conflito: dialogo.getByRole("group", { name: nomeDaCorda(id), exact: true }),
  };
}

/** O #52 enviava o número decimal digitado, recebia 22P02 e deixava a sessão concluída só na fila. */
export async function prepararCordaAntiga(page: Page, opcoes: { segunda?: boolean } = {}) {
  await resetarMock();
  await fixarData(page, DATA + "T13:00:00-03:00");
  const conta = await usuarioComPerfil({ semana_corda: 1 });
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");

  // Produz blocos, duração, estado do plano e UUID pelo mesmo player usado na sessão antiga.
  await page.goto("/cardio/corda");
  await page.getByRole("button", { name: "Começar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
  await fixarData(page, DATA + "T13:02:05-03:00");
  const timer = page.getByRole("region", { name: "Cronômetro dos blocos" });
  await expect(timer.getByText("bloco 2 de 6", { exact: true })).toBeVisible();
  await expect(timer.getByText("Descanso", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Encerrar e registrar", exact: true }).click();
  const fim = page.getByRole("dialog");
  await expect(fim).toContainText("2 de 6 blocos");
  await fim.getByRole("textbox", { name: "saltos", exact: true }).fill("42");
  await fim.getByRole("radio", { name: /forte/i }).click();
  await fim.getByLabel("Nota (opcional)").fill("Corda antes do almoço.");
  const worker = await workerDoApp(page.context());
  await semRedeNoWorker(worker);
  await page.context().setOffline(true);
  await fim.getByRole("button", { name: "Salvar e voltar", exact: true }).click();
  await esperarAbaTreino(page);

  // A versão atual recusa a fração na entrada. Reconstituímos o item individual sem alvo
  // e sua cópia local como ficaram no #52, depois da rejeição inicial do PostgreSQL.
  const { linha, segunda } = await page.evaluate(async ({ userId, comSegunda }) => {
    type Item = { id: number; tipo: string; payload: { tabela: string; linha: LinhaSessaoCardio } };
    const banco = await new Promise<IDBDatabase>((ok, erro) => {
      const p = indexedDB.open("treino-terraco");
      p.onsuccess = () => ok(p.result);
      p.onerror = () => erro(p.error);
    });
    try {
      return await new Promise<{ linha: LinhaSessaoCardio; segunda: LinhaSessaoCardio | null }>((ok, erro) => {
        const tx = banco.transaction(["cache", "outbox"], "readwrite");
        const fila = tx.objectStore("outbox");
        const leitura = fila.getAll();
        tx.onabort = () => erro(tx.error);
        leitura.onsuccess = () => {
          const original = (leitura.result as Item[]).find(i => i.tipo === "cardio" &&
            i.payload.linha?.user_id === userId && i.payload.linha?.notas === "Corda antes do almoço.");
          if (!original) { tx.abort(); return; }
          const linha = { ...original.payload.linha, saltos: 42.5 };
          const segunda = comSegunda ? { ...linha, id: crypto.randomUUID(), saltos: 71.5, notas: "Corda no fim do dia." } : null;
          const agora = Date.now();
          const item = (c: LinhaSessaoCardio, criadoEm: number) => ({
            tipo: "cardio", payload: { tabela: "cardio_sessions", op: "upsert", onConflict: "id", linha: c },
            tentativas: 1, erro: 'invalid input syntax for type integer (22P02)', criadoEm, proximaTentativa: agora + 300_000,
          });
          fila.put({ ...item(linha, agora), id: original.id });
          if (segunda) fila.add(item(segunda, agora + 1));
          tx.objectStore("cache").put({ chave: `cardio-do-historico:${userId}`,
            valor: segunda ? [linha, segunda] : [linha], atualizadoEm: agora });
          tx.oncomplete = () => ok({ linha, segunda });
        };
      });
    } finally { banco.close(); }
  }, { userId: conta.userId, comSegunda: opcoes.segunda === true });

  expect(linha.feito).toMatchObject({ blocos_cumpridos: 3, repeticoes_cumpridas: 2, decorrido_s: 125 });
  expect(linha.planejado).toMatchObject({ repeticoes: 6, tipo: "corda" });
  await comRedeNoWorker(worker);
  await page.context().setOffline(false);
  await page.goto("/mais");
  await expect(page.getByRole("heading", { name: "Mais", exact: true })).toBeVisible();
  return { conta, id: linha.id, data: linha.data, linha, segunda };
}

import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessao, PlanoDaSessao } from "../lib/types";
import { entrarNoApp, esperarServiceWorker, fixarData, HOJE_FIXO, inserirNoMock, lerDoMock, naFila, resetarMock, usuarioComPerfil } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

/** Segura a primeira gravação para que o segundo toque aconteça enquanto ela está pendente. */
async function reterFila(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const transacao = banco.transaction("outbox", "readwrite");
      const tabela = transacao.objectStore("outbox");
      let reter = true;
      window.addEventListener("liberar-fila-do-teste", () => { reter = false; }, { once: true });
      transacao.oncomplete = () => banco.close();
      transacao.onabort = () => { banco.close(); reject(transacao.error); };
      function aguardar() {
        tabela.count().onsuccess = () => {
          resolve();
          if (reter) aguardar();
        };
      }
      aguardar();
    };
  }));
}

async function abrirMaterial(page: Page) {
  await page.getByRole("button", { name: "Ajustar", exact: true }).click();
  const folha = page.getByRole("dialog", { name: "Ajustar" });
  await folha.locator("summary").filter({ hasText: "Equipamento de hoje" }).click();
  return folha.getByRole("group", { name: "Equipamento de hoje" });
}

test("o Ajustar do treino iniciado em outro aparelho guarda dois toques e preserva o plano e a série", async ({ page }) => {
  await resetarMock();
  const conta = await usuarioComPerfil();
  const id = "f0000000-1234-4000-8000-000000000001";
  const plano: PlanoDaSessao = {
    titulo: "Treino remoto", colecao: null, equipamento_disponivel: [],
    itens: [{ exercicio_id: "agachamento-livre", series: 2, tipo: "reps", min: 8, max: 12,
      unilateral: false, descanso_s: 60, descanso_texto: "60 s" }],
    trocas: { "1": [{ exercicio_id: "agachamento-goblet", trabalho: [1, 2], aquecimento: [], ultima_firme: true, nota: "Série do outro aparelho" }] },
  };
  await inserirNoMock(conta, "sessions", [{
    id, workout_id: "A1", fase: "fase1", data: "2026-09-14", status: "em_andamento",
    iniciada_em: "2026-09-14T09:00:00.000Z", plano,
  }]);
  await inserirNoMock(conta, "session_sets", [{
    id: "f0000000-1234-4000-8000-000000000002", session_id: id, exercise_id: "agachamento-goblet",
    ordem_ex: 1, set_index: 1, tipo: "trabalho", reps: 8, carga_kg: 12, concluida: true,
  }]);
  const series = () => lerDoMock(conta, "session_sets", `session_id=eq.${id}`);
  const seriesAntes = await series();
  await fixarData(page, HOJE_FIXO);
  await entrarNoApp(page);
  await expect(page.getByRole("link", { name: "Continuar", exact: true }).first()).toBeVisible();
  const grupo = await abrirMaterial(page);
  await expect(grupo.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await reterFila(page);
  try {
    await grupo.getByRole("checkbox", { name: "Tatame", exact: true }).check();
    await grupo.getByRole("checkbox", { name: "Elástico (Super Band)", exact: true }).check();
    await expect(grupo.getByRole("checkbox", { checked: true })).toHaveCount(2);
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event("liberar-fila-do-teste")));
  }
  await expect.poll(async () => {
    const [sessao] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
    return sessao?.plano && { ...sessao.plano, equipamento_disponivel: sessao.plano.equipamento_disponivel?.slice().sort() };
  }).toEqual({ ...plano, equipamento_disponivel: ["super-band", "tatame"] });
  expect(await series()).toEqual(seriesAntes);
});

test("o material do cartão remoto reabre sem rede quando a lista de leitura ainda tem o valor anterior", async ({ page, context }) => {
  await resetarMock();
  const conta = await usuarioComPerfil(), id = crypto.randomUUID();
  const plano = { itens: [{ exercicio_id: "agachamento-livre" }], equipamento_disponivel: ["tatame", "super-band"] };
  await inserirNoMock(conta, "sessions", [{
    id, workout_id: "A1", fase: "fase1", data: "2026-09-14", status: "em_andamento", iniciada_em: "2026-09-14T09:00:00Z", plano,
  }]);
  await fixarData(page, HOJE_FIXO);
  await page.addInitScript(id => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name !== "cache" || args[0]?.chave !== "react-query-v1") return put.apply(this, args);
      if (!navigator.onLine) throw new DOMException("Cache geral indisponível", "QuotaExceededError");
      const pedido = put.apply(this, args);
      const consultas = args[0].valor?.estado?.queries ?? [];
      if (consultas.some((q: { queryKey: string[] }) => q.queryKey[0] === "sessao" && q.queryKey[1] === id)) {
        this.transaction.addEventListener("complete", () => sessionStorage.setItem("cache-anterior-pronto", "sim"), { once: true });
      }
      return pedido;
    };
  }, id);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.goto("/");
  const equipamento = await abrirMaterial(page);
  await expect(equipamento.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("cache-anterior-pronto"))).toBe("sim");

  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  try {
    await equipamento.getByRole("button", { name: "Só peso do corpo" }).tap();
    await expect.poll(() => naFila(page)).toBe(1);
    const resposta = await page.reload();
    expect(resposta?.fromServiceWorker()).toBe(true);
    await expect((await abrirMaterial(page)).getByRole("checkbox", { checked: true })).toHaveCount(0);
    expect(await lerDoMock(conta, "sessions", "id=eq." + id)).toMatchObject([{ plano }]);
  } finally {
    await comRedeNoWorker(worker);
    await context.setOffline(false);
  }
  await expect.poll(async () => (await lerDoMock<LinhaSessao>(conta, "sessions", "id=eq." + id))[0]?.plano).toMatchObject({
    itens: plano.itens, equipamento_disponivel: [],
  });
});

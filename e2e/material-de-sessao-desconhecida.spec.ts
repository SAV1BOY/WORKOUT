import { expect, test, type Page } from "@playwright/test";
import { itensDoTreino, montarSessao, type SessaoLocal } from "../lib/sessao";
import { planoDaSessao } from "../lib/livre";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import {
  atualizarNoMock, entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, HOJE_FIXO, inserirNoMock, lerDoMock,
  naFila, ocuparArmazenamentoDaSessao, resetarMock, usuarioComPerfil,
} from "./fixtures";

const data = "2026-09-14";
const futuro = "agachamento-de-outra-versao";
const aviso = "Atualize o app para continuar este treino";

function planoDeOutraVersao() {
  const plano = planoDaSessao(itensDoTreino("A1"));
  const registro = (exercicio_id: string, nota: string) => ({
    exercicio_id, nota, trabalho: [1, 2], aquecimento: [], ultima_firme: null,
  });
  plano.trocas = {
    1: [registro(futuro, "Manter os dois apoios"), registro("agachamento-livre", "Nota do original")],
    2: [registro("flexao-de-braco", "No tatame"), registro("supino-reto-com-barra", "Nota do supino")],
  };
  return plano;
}

/** Simula o aparelho antigo que reconstruía o bloco original quando ignorava um substituto. */
async function guardarCopiaAntiga(page: Page, dados: SessaoLocal) {
  await page.evaluate(dados => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("treino-terraco");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("sessaoAtiva", "readwrite");
      tx.objectStore("sessaoAtiva").put({ id: dados.id, dados, atualizadoEm: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), dados);
}

/** Reproduz a janela em que o cache geral ainda não tinha a lista de sessões abertas. */
async function consultaGuardada(page: Page, chave: "sessoes" | "sessoes-abertas", retirar = false) {
  return page.evaluate(({ chave, retirar }) => new Promise<unknown>((resolve, reject) => {
    const req = indexedDB.open("treino-terraco");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("cache", retirar ? "readwrite" : "readonly");
      const cache = tx.objectStore("cache"), ler = cache.get("react-query-v1");
      let dados: unknown;
      ler.onsuccess = () => {
        const consultas = ler.result?.valor?.estado.queries ?? [];
        const indice = consultas.findIndex((q: { queryKey: string[] }) => q.queryKey[0] === chave);
        if (indice < 0) return;
        dados = consultas[indice].state.data;
        if (retirar) {
          consultas.splice(indice, 1);
          cache.put(ler.result);
        }
      };
      tx.oncomplete = () => { db.close(); resolve(dados); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), { chave, retirar });
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, HOJE_FIXO);
});

test("o plano bruto protege o A1 aberto: Ajustar mantém as preferências e Continuar leva ao histórico", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const id = crypto.randomUUID();
  const plano = planoDeOutraVersao();
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, data, fase: "fase1", workout_id: "A1", status: "em_andamento",
    iniciada_em: data + "T10:00:00Z", plano, nota_geral: "Sessão no terraço.",
  }]);
  await inserirNoMock(conta, "session_sets", [{
    id: crypto.randomUUID(), session_id: id, user_id: conta.userId, exercise_id: "flexao-de-braco",
    ordem_ex: 2, tipo: "trabalho", set_index: 1, reps: 7, concluida: true, registrada_em: data + "T10:08:00Z",
  }]);
  const sessoes = await lerDoMock(conta, "sessions"), series = await lerDoMock(conta, "session_sets");
  await entrarNoApp(page);
  // A cópia local antiga só conhece os movimentos do programa. A incompatibilidade
  // aparece exclusivamente no plano bruto que a aba recebe na lista de sessões abertas.
  const antiga = montarSessao({ id, userId: conta.userId, data, treinoId: "A1", fase: "fase1" });
  await guardarCopiaAntiga(page, antiga);
  await page.reload();
  await esperarAbaTreino(page);
  const hoje = page.getByRole("region", { name: "Hoje", exact: true });
  await expect(hoje.getByText(aviso)).toBeVisible();
  await expect(hoje.getByText(/\d+\/\d+ séries/)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Exercícios de hoje" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ajustar", exact: true }).tap();
  const ajustes = page.getByRole("dialog", { name: "Ajustar" });
  await expect(ajustes.getByLabel("Preparação (segundos)")).toBeVisible();
  await expect(ajustes.locator("summary").filter({ hasText: "Equipamento de hoje" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const continuar = hoje.getByRole("link", { name: "Continuar" });
  await expect(continuar).toHaveAttribute("href", "/treinar/" + id);
  await continuar.press("Enter");
  await expect(page.getByRole("heading", { name: aviso })).toBeVisible();
  await page.getByRole("link", { name: "Ver histórico" }).click();
  await expect(page).toHaveURL(url => url.pathname === "/relatorio" && url.hash === "#historico");
  await expect(page.locator('details[data-secao="historico"]')).toHaveAttribute("open", "");
  expect(await naFila(page)).toBe(0);
  expect(await lerDoMock(conta, "sessions")).toEqual(sessoes);
  expect(await lerDoMock(conta, "session_sets")).toEqual(series);
});

test("uma sessão incompatível de ontem guardada no aparelho preserva as escolhas de hoje", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const id = crypto.randomUUID(), ontem = "2026-09-13";
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, data: ontem, fase: "fase1", workout_id: "A1",
    status: "em_andamento", iniciada_em: ontem + "T10:00:00Z", plano: null,
  }]);
  await entrarNoApp(page);
  const banner = page.getByRole("region", { name: "Treino aberto" });
  await expect(banner.getByRole("button", { name: "Descartar", exact: true })).toBeVisible();
  const antiga = montarSessao({ id, userId: conta.userId, data: ontem, treinoId: "A1", fase: "fase1" });
  antiga.plano = planoDeOutraVersao();
  await guardarCopiaAntiga(page, antiga);
  await page.reload();
  await esperarAbaTreino(page);
  await expect(banner).toContainText(aviso);
  await expect(banner.getByRole("link", { name: "Continuar" })).toHaveAttribute("href", "/treinar/" + id);
  await expect(banner.getByRole("button", { name: "Descartar" })).toHaveCount(0);

  const lista = page.getByRole("list", { name: "Exercícios de hoje" });
  await lista.getByRole("button", { name: "Substituir Supino reto com barra" }).tap();
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  await folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" }).tap();
  await folha.getByRole("button", { name: "Só peso do corpo" }).tap();
  await expect(folha.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ajustar", exact: true }).tap();
  const ajustes = page.getByRole("dialog", { name: "Ajustar" });
  await ajustes.locator("summary").filter({ hasText: "Equipamento de hoje" }).tap();
  await expect(ajustes.getByRole("button", { name: "Só peso do corpo" })).toHaveAttribute("aria-disabled", "true");
  expect(await naFila(page)).toBe(0);
  expect(await lerDoMock(conta, "sessions")).toMatchObject([{ id, plano: null, status: "em_andamento" }]);
});

for (const retirarResumo of [false, true]) {
  test(`ao voltar sem rede o A1 protegido é retomado ${retirarResumo ? "sem a lista guardada" : "com o resumo antigo"}`, async ({ page, context }) => {
    const conta = await usuarioComPerfil(), id = crypto.randomUUID();
    const plano = planoDaSessao(itensDoTreino("A1"));
    await inserirNoMock(conta, "sessions", [{
      id, user_id: conta.userId, data, fase: "fase1", workout_id: "A1", status: "em_andamento",
      iniciada_em: data + "T10:00:00Z", plano,
    }]);
    await entrarNoApp(page);
    await esperarServiceWorker(page);
    await guardarCopiaAntiga(page, montarSessao({ id, userId: conta.userId, data, fase: "fase1", treinoId: "A1" }));
    const documento = await page.goto("/");
    expect(documento?.fromServiceWorker()).toBe(true);
    const hoje = page.getByRole("region", { name: "Hoje", exact: true });
    const continuar = hoje.getByRole("link", { name: "Continuar" });
    await expect(continuar).toHaveAttribute("href", "/treinar/" + id);
    await expect.poll(() => consultaGuardada(page, "sessoes-abertas")).toMatchObject([{ id, plano }]);
    // Outro aparelho fez a troca enquanto esta aba ainda mostrava o A1 anterior.
    await atualizarNoMock(conta, "sessions", "id=eq." + id, { plano: planoDeOutraVersao() });
    await continuar.tap();
    await expect(page.getByRole("heading", { name: aviso })).toBeVisible();
    const observadora = await context.newPage();
    await observadora.goto("/manifest.webmanifest"); // mesma origem, sem React gravando consultas
    await page.goto("/manifest.webmanifest");
    expect(await consultaGuardada(observadora, "sessoes-abertas", retirarResumo)).toMatchObject([{ id, plano }]);
    const worker = await workerDoApp(context);
    await semRedeNoWorker(worker);
    await context.setOffline(true);
    try {
      const liberar = retirarResumo ? await ocuparArmazenamentoDaSessao(observadora, id) : undefined;
      try {
        const volta = await page.goto("/");
        expect(volta?.fromServiceWorker()).toBe(true);
        if (liberar) await expect(hoje.getByRole("button", { name: "Procurando treino em andamento…" })).toBeDisabled();
      } finally {
        await liberar?.();
      }
      await expect(hoje.getByText(aviso)).toBeVisible();
      await expect(continuar).toHaveAttribute("href", "/treinar/" + id);
      await expect(page.getByRole("list", { name: "Exercícios de hoje" })).toHaveCount(0);
      await page.getByRole("button", { name: "Ajustar", exact: true }).tap();
      await expect(page.getByRole("dialog").getByLabel("Preparação (segundos)")).toBeVisible();
      await expect(page.getByRole("dialog").locator("summary").filter({ hasText: "Equipamento de hoje" })).toHaveCount(0);
      expect(await naFila(page)).toBe(0);
    } finally {
      await context.setOffline(false);
      await comRedeNoWorker(worker);
      await observadora.close();
    }
    expect(await lerDoMock(conta, "sessions")).toMatchObject([{ id, plano: planoDeOutraVersao(), status: "em_andamento" }]);
  });
}

test.describe("Revalidação das séries do A1", () => {
  test.use({ serviceWorkers: "block" }); // mantém o GET sob controle da rota do navegador

  test("a cópia conhecida libera o material e uma série desconhecida recebida depois protege a sessão", async ({ page }) => {
    const conta = await usuarioComPerfil(), id = crypto.randomUUID();
    const plano = planoDaSessao(itensDoTreino("A1"));
    await inserirNoMock(conta, "sessions", [{
      id, user_id: conta.userId, data, fase: "fase1", workout_id: "A1", status: "em_andamento",
      iniciada_em: data + "T10:00:00Z", plano,
    }]);
    await entrarNoApp(page);
    await guardarCopiaAntiga(page, montarSessao({ id, userId: conta.userId, data, fase: "fase1", treinoId: "A1" }));
    await page.goto("/creditos");
    await inserirNoMock(conta, "session_sets", [{
      id: crypto.randomUUID(), session_id: id, user_id: conta.userId, exercise_id: futuro,
      ordem_ex: 1, tipo: "trabalho", set_index: 1, reps: 8, concluida: true, registrada_em: data + "T10:08:00Z",
    }]);
    await fixarData(page, "2026-09-14T08:02:00-03:00"); // força a revalidação do cache da primeira visita

    const destaSessao = (url: URL) => url.pathname === "/rest/v1/session_sets" && url.searchParams.get("session_id") === "eq." + id;
    let liberar!: () => void;
    const liberada = new Promise<void>(resolve => { liberar = resolve; });
    let avisar!: () => void;
    const retida = new Promise<void>(resolve => { avisar = resolve; });
    await page.route(destaSessao, async rota => {
      avisar();
      await liberada;
      await rota.continue();
    });
    try {
      await page.goto("/");
      await retida;
      await page.getByRole("button", { name: "Ajustar", exact: true }).tap();
      const ajustes = page.getByRole("dialog", { name: "Ajustar" });
      const material = ajustes.locator("summary").filter({ hasText: "Equipamento de hoje" });
      await material.tap();
      await expect(ajustes.getByRole("button", { name: "Só peso do corpo" })).toBeEnabled();
      liberar();
      await expect(material).toHaveCount(0);
      await expect(ajustes.getByLabel("Preparação (segundos)")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("region", { name: "Hoje", exact: true })).toContainText(aviso);
      expect(await lerDoMock(conta, "sessions")).toMatchObject([{ id, plano }]);
      expect(await lerDoMock(conta, "session_sets")).toMatchObject([{ session_id: id, exercise_id: futuro, reps: 8 }]);
      expect(await naFila(page)).toBe(0);
    } finally {
      liberar();
    }
  });
});

test("a lista confirmada vazia e o histórico encerrado não reabrem cópias antigas ou de outra conta", async ({ page, context }) => {
  const conta = await usuarioComPerfil(), deOntem = "2026-09-13";
  const encerrada = montarSessao({ id: crypto.randomUUID(), userId: conta.userId, data: deOntem, fase: "fase1", treinoId: "A1" });
  const alheia = montarSessao({ id: crypto.randomUUID(), userId: crypto.randomUUID(), data, fase: "fase1", treinoId: "A1" });
  const semLinha = montarSessao({ id: crypto.randomUUID(), userId: conta.userId, data, fase: "fase1", treinoId: "A1" });
  await inserirNoMock(conta, "sessions", [{
    id: encerrada.id, user_id: conta.userId, data: deOntem, fase: "fase1", workout_id: "A1",
    status: "concluida", iniciada_em: deOntem + "T10:00:00Z", concluida_em: deOntem + "T10:20:00Z",
  }]);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  for (const local of [encerrada, alheia, semLinha]) await guardarCopiaAntiga(page, local);

  await fixarData(page, "2026-09-14T08:02:00-03:00");
  const leitura = page.waitForResponse(resposta => {
    const url = new URL(resposta.url());
    return url.pathname === "/rest/v1/sessions" && url.searchParams.get("status") === "eq.em_andamento";
  });
  const pagina = await page.goto("/");
  expect(pagina?.fromServiceWorker()).toBe(true);
  expect(await (await leitura).json()).toEqual([]);
  const hoje = page.getByRole("region", { name: "Hoje", exact: true });
  const comecar = hoje.getByRole("button", { name: "Começar treino", exact: true });
  await expect(comecar).toBeEnabled(); // prevalece a resposta do servidor, mesmo com outra cópia local em andamento

  await guardarCopiaAntiga(page, { ...semLinha, status: "abandonada" });
  await expect.poll(() => consultaGuardada(page, "sessoes")).toMatchObject([{ id: encerrada.id, status: "concluida" }]);
  await page.goto("/manifest.webmanifest");
  await consultaGuardada(page, "sessoes-abertas", true);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  try {
    await page.goto("/");
    await expect(comecar).toBeEnabled();
    await expect(page.getByRole("region", { name: "Treino aberto" })).toHaveCount(0);
    await comecar.tap();
    await expect(page).toHaveURL(/\/treinar\/[\da-f-]{36}$/);
    const novo = new URL(page.url()).pathname.split("/").at(-1);
    expect([encerrada.id, alheia.id, semLinha.id]).not.toContain(novo);
  } finally {
    await context.setOffline(false);
    await comRedeNoWorker(worker);
  }
  expect(await lerDoMock(conta, "sessions", "id=eq." + encerrada.id)).toMatchObject([{ status: "concluida" }]);
});

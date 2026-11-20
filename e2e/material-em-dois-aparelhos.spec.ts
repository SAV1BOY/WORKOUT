import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { ItemSaida } from "../lib/db";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { EscritaTabela } from "../lib/outbox-supabase";
import type { PlanoDaSessao } from "../lib/types";
import {
  abrirVisaoGeral, atualizarNoMock, comecarNoPlayer, entrarNoApp, esperarServiceWorker, fixarData,
  HOJE_FIXO, inserirNoMock, marcarSerieNaVisaoGeral, naFila, requisicoesDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { abrirCatalogo, busca, catalogo, geral, planoSalvo, series } from "./treino-livre-ativo";

const INICIAIS = ["flexao-de-braco", "agachamento-com-peso-corporal"] as const;
const PONTE = "ponte-de-gluteos-no-tatame";
const NOME_PONTE = "Ponte de glúteos no tatame";
const FAIXA = "Elástico (Super Band)";
const REVER = "Rever equipamento do treino";
const PRIMEIRA = "Série 1 — ";

test.beforeEach(() => resetarMock());

async function abrirPlayer(page: Page, id: string) {
  await fixarData(page);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.goto("/treinar/" + id);
  await comecarNoPlayer(page);
}

async function outroAparelho(browser: Browser, baseURL: string | undefined, id: string) {
  const dispositivo = await browser.newContext({
    ...devices["Pixel 5"], viewport: { width: 360, height: 740 }, baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo",
  });
  const page = await dispositivo.newPage();
  await abrirPlayer(page, id);
  return page;
}

async function preparar(page: Page, iniciais: readonly string[] = INICIAIS) {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  const id = crypto.randomUUID();
  const plano = planoDaSessao(itensDeIds(iniciais));
  plano.equipamento_disponivel = ["tatame", "super-band"];
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, data: "2026-09-14", workout_id: "livre", fase: "fase1",
    status: "em_andamento", iniciada_em: HOJE_FIXO, plano,
  }]);
  await abrirPlayer(page, id);
  return { conta, id, plano };
}

async function tirarElastico(page: Page) {
  await page.getByRole("button", { name: "Ajustar", exact: true }).tap();
  const ajustes = page.getByRole("dialog");
  await ajustes.locator("summary").filter({ hasText: "Equipamento de hoje" }).tap();
  const materiais = ajustes.getByRole("group", { name: "Equipamento de hoje", exact: true });
  await materiais.getByRole("checkbox", { name: FAIXA, exact: true }).uncheck();
  await expect(materiais.getByRole("checkbox", { checked: true })).toHaveCount(1);
  await expect(materiais.getByRole("checkbox", { name: "Tatame", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(ajustes).toBeHidden();
}

async function prepararPonteComSerieAtrasada(page: Page, browser: Browser, baseURL: string | undefined) {
  const context = page.context();
  const { conta, id } = await preparar(page);
  const outro = await outroAparelho(browser, baseURL, id);
  const retida = Promise.withResolvers<void>();
  const liberar = Promise.withResolvers<void>();
  await outro.exposeFunction("aguardarPrimeiraSerieDaPonte", () => {
    retida.resolve();
    return liberar.promise;
  });
  await outro.evaluate(() => {
    const buscar = window.fetch.bind(window);
    window.fetch = async (entrada, opcoes) => {
      const requisicao = new Request(entrada, opcoes);
      if (requisicao.method === "POST" && new URL(requisicao.url).pathname === "/rest/v1/session_sets") {
        await (window as unknown as { aguardarPrimeiraSerieDaPonte: () => Promise<void> }).aguardarPrimeiraSerieDaPonte();
      }
      return buscar(entrada, opcoes);
    };
  });
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await tirarElastico(page);
  await acrescentarPonte(outro);
  await retida.promise;
  expect((await planoSalvo(conta, id))?.ultima_inclusao?.estado).toBe("iniciada");
  expect(await series(conta, id)).toEqual([]);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { name: "3. " + NOME_PONTE })).toBeVisible();
  const grupo = geral(page).getByRole("group", { name: PRIMEIRA + NOME_PONTE, exact: true });
  await expect(grupo.getByRole("checkbox")).not.toBeChecked();
  return { conta, id, outro, worker, grupo, liberar };
}

test("a ponte chega antes da primeira série e a reabertura reúne as dez repetições do outro aparelho", async ({ page, browser, baseURL }) => {
  test.slow();
  const { conta, id, outro, liberar } = await prepararPonteComSerieAtrasada(page, browser, baseURL);
  liberar.resolve();
  await expect.poll(() => series(conta, id)).toMatchObject([{ exercise_id: PONTE, ordem_ex: 3, reps: 10 }]);
  await page.goto("/");
  await page.goto("/treinar/" + id);
  await verificarPonte(page);
  await outro.context().close();
});

test("digitar 17 quando chegam as dez repetições do outro aparelho conserva as duas séries", async ({ page, context, browser, baseURL }) => {
  test.slow();
  const { conta, id, outro, worker, grupo, liberar } = await prepararPonteComSerieAtrasada(page, browser, baseURL);
  // Mantém aberta só a transação que já recebeu B, enquanto o campo de A continua editável.
  const antes = Promise.withResolvers<string>();
  await page.exposeFunction("aoSegurarSerieRecebida", antes.resolve);
  await page.evaluate(id => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (valor, ...args) {
      const serie = valor?.dados?.blocos?.[2]?.series?.[0];
      if (this.name !== "sessaoAtiva" || valor.id !== id || serie?.reps !== 10 || !serie.concluida) return put.call(this, valor, ...args);
      IDBObjectStore.prototype.put = put;
      const ler = this.get(id);
      ler.onsuccess = () => {
        const informar = (window as unknown as { aoSegurarSerieRecebida: (id: string) => Promise<void> }).aoSegurarSerieRecebida;
        void informar(ler.result.dados.blocos[2].series[0].id);
      };
      let reter = true;
      window.addEventListener("soltar-serie-recebida", () => { reter = false; }, { once: true });
      const manterAtiva = () => { if (reter) this.get(id).onsuccess = manterAtiva; };
      manterAtiva();
      return put.call(this, valor, ...args);
    };
  }, id);
  liberar.resolve();
  await expect.poll(() => series(conta, id)).toMatchObject([{ exercise_id: PONTE, ordem_ex: 3, set_index: 1, reps: 10 }]);
  const [serieB] = await series(conta, id);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  const idDoRascunho = await antes.promise;
  expect(idDoRascunho).not.toBe(serieB!.id);
  const reps = grupo.getByRole("textbox", { name: "repetições", exact: true });
  await expect(reps).toHaveValue("12");
  await reps.fill("17");
  await expect(reps).toBeFocused();
  await expect(grupo.getByRole("checkbox")).not.toBeChecked();
  await page.evaluate(() => window.dispatchEvent(new Event("soltar-serie-recebida")));
  await expect(geral(page).getByRole("status").filter({ hasText: "A série 1 foi registrada em outro aparelho. Seu ajuste ficou na série 2." })).toBeVisible();
  const segunda = geral(page).getByRole("group", { name: "Série 2 — " + NOME_PONTE, exact: true });
  await expect(reps).toHaveValue("10");
  await expect(grupo.getByRole("checkbox")).toBeChecked();
  await expect(segunda.getByRole("textbox", { name: "repetições", exact: true })).toHaveValue("17");
  await expect(segunda.getByRole("textbox", { name: "repetições", exact: true })).toBeFocused();
  await expect(segunda.getByRole("checkbox")).not.toBeChecked();
  expect(await series(conta, id)).toEqual([serieB]);
  expect(await naFila(page)).toBe(0);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await verificarPonte(page);
  await expect(segunda.getByRole("textbox", { name: "repetições", exact: true })).toHaveValue("17");
  await expect(segunda.getByRole("checkbox")).not.toBeChecked();
  await marcarSerieNaVisaoGeral(segunda.getByRole("checkbox"));
  await expect.poll(() => naFila(page)).toBe(1);
  expect(await series(conta, id)).toEqual([serieB]);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => series(conta, id)).toMatchObject([
    serieB!, { id: idDoRascunho, exercise_id: PONTE, ordem_ex: 3, set_index: 2, reps: 17, concluida: true },
  ]);
  const posts = (await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho.split("?")[0] === "/rest/v1/session_sets");
  expect(posts).toHaveLength(2);
  const limpo = await outroAparelho(browser, baseURL, id);
  await verificarPonte(limpo);
  const confirmada = geral(limpo).getByRole("group", { name: "Série 2 — " + NOME_PONTE, exact: true });
  await expect(confirmada.getByRole("checkbox")).toBeChecked();
  await expect(confirmada.getByRole("textbox", { name: "repetições", exact: true })).toHaveValue("17");
  await limpo.context().close();
  await outro.context().close();
});

async function registrarSerie(page: Page, nome: string, reps: string) {
  const primeira = geral(page).getByRole("group", { name: PRIMEIRA + nome, exact: true });
  await primeira.getByRole("textbox", { name: "repetições", exact: true }).fill(reps);
  await marcarSerieNaVisaoGeral(primeira.getByRole("checkbox"));
}

async function acrescentarPonte(page: Page) {
  await abrirVisaoGeral(page);
  await abrirCatalogo(page).tap();
  await busca(page).fill(NOME_PONTE);
  await catalogo(page).getByRole("button", { name: "Adicionar " + NOME_PONTE, exact: true }).tap();
  await expect(geral(page).getByRole("heading", { name: "3. " + NOME_PONTE })).toBeVisible();
  await registrarSerie(page, NOME_PONTE, "10");
}

async function verificarPonte(page: Page) {
  await abrirVisaoGeral(page);
  await expect(geral(page).locator('[id^="bloco-"] h2')).toHaveText([
    "1. Flexão de braço", "2. Agachamento com peso corporal", "3. " + NOME_PONTE,
  ]);
  const grupo = geral(page).getByRole("group", { name: PRIMEIRA + NOME_PONTE, exact: true });
  await expect(grupo.getByRole("checkbox")).toBeChecked();
  await expect(grupo.getByRole("textbox", { name: "repetições", exact: true })).toHaveValue("10");
}

/** Só a escrita do equipamento muda de formato: reproduz o PATCH completo guardado pelo #73.
 * A série enfileirada depois e os UUIDs produzidos pelo player permanecem intactos. */
async function usarFilaLegada(page: Page, id: string, conta: string, escrita: EscritaTabela, reps = [11]) {
  return page.evaluate(({ alvo, id, conta, escrita, reps }) => new Promise<string[]>((resolve, reject) => {
    const req = indexedDB.open("treino-terraco");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction(["outbox", "sessaoAtiva"], "readwrite"), fila = tx.objectStore("outbox");
      const ler = fila.getAll();
      const seriesIds: string[] = [];
      ler.onsuccess = () => {
        const pendentes = (ler.result as ItemSaida[]).filter(item => item.alvo === alvo);
        const [equipamento, ...series] = pendentes;
        if (equipamento?.tipo !== "sessao" || series.length !== reps.length) { tx.abort(); return; }
        for (const [i, serie] of series.entries()) {
          const linha = (serie.payload as EscritaTabela)?.linha;
          if (serie.tipo !== "serie" || linha?.user_id !== conta || linha.session_id !== id || linha.reps !== reps[i] ||
            typeof linha.id !== "string") { tx.abort(); return; }
          seriesIds.push(linha.id);
        }
        fila.put({ ...equipamento, payload: escrita });
        const plano = escrita.linha?.plano as PlanoDaSessao;
        if (plano.descansos_por_exercicio) {
          const local = tx.objectStore("sessaoAtiva");
          const lerCopia = local.get(id);
          lerCopia.onsuccess = () => {
            const copia = lerCopia.result;
            if (copia?.dados?.userId !== conta || copia.dados.id !== id) { tx.abort(); return; }
            copia.dados.plano.descansos_por_exercicio = plano.descansos_por_exercicio;
            local.put(copia);
          };
        }
      };
      tx.oncomplete = () => { db.close(); resolve(seriesIds); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Esperava a escolha de material seguida pelas séries do player.")); };
    };
  }), { alvo: "sessions:" + id, id, conta, escrita, reps });
}

for (const escolha of ["Manter equipamento sincronizado", "Usar equipamento deste aparelho"] as const) {
  test(`fila antiga de material: ${escolha} conserva o bloco de outro aparelho e libera a próxima série`, async ({ page, context, browser, baseURL }) => {
    test.slow();
    const documentosDeMais: string[] = [];
    let consultasDeMais = 0;
    page.on("request", req => {
      const url = new URL(req.url());
      if (url.pathname !== "/mais") return;
      if (req.isNavigationRequest()) documentosDeMais.push(url.pathname);
      if (url.searchParams.has("_rsc")) consultasDeMais++;
    });
    const { conta, id, plano } = await preparar(page);
    const outro = await outroAparelho(browser, baseURL, id);
    const worker = await workerDoApp(context);
    await semRedeNoWorker(worker);
    await context.setOffline(true);
    await tirarElastico(page);
    await abrirVisaoGeral(page);
    await registrarSerie(page, "Flexão de braço", "11");
    await expect.poll(() => naFila(page)).toBe(2);
    const [serieA] = await usarFilaLegada(page, id, conta.userId, {
      tabela: "sessions", op: "update", filtro: { id, user_id: conta.userId, status: "em_andamento" },
      linha: { plano: { ...plano, equipamento_disponivel: ["tatame"] } },
    });
    await acrescentarPonte(outro);
    await expect.poll(() => series(conta, id)).toMatchObject([{ exercise_id: PONTE, ordem_ex: 3, reps: 10 }]);
    const [serieB] = await series(conta, id);
    const inclusao = (await planoSalvo(conta, id))!.ultima_inclusao;
    expect(inclusao).toMatchObject({ sessao_id: id, ordem: 3, exercicio_id: PONTE, estado: "iniciada" });
    await comRedeNoWorker(worker);
    await context.setOffline(false);
    if (escolha === "Manter equipamento sincronizado") {
      await page.setViewportSize({ width: 320, height: 420 });
      await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.setProperty("font-size", "200%", "important");
      }));
      await page.goto("/");
      const documentoGuardado = await page.evaluate(async () => (await caches.match(new URL("/mais", location.href)))?.headers.get("content-type") ?? "");
      expect(documentoGuardado).not.toContain("text/html");
      await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: /^Mais(?:,|$)/ }).click();
    } else {
      await page.goto("/mais#sincronizacao");
    }
    const painel = page.getByRole("region", { name: "Sincronização", exact: true });
    const rever = painel.getByRole("button", { name: REVER, exact: true });
    const folha = page.getByRole("dialog", { name: REVER, exact: true });
    const conferirAlvo = () => expect.poll(() => rever.evaluate(botao => {
      const r = botao.getBoundingClientRect();
      const secao = botao.closest('[role="region"], section')!.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      return { cabe: r.left >= Math.max(0, secao.left) && r.right <= Math.min(document.documentElement.clientWidth, secao.right),
        toque: r.width >= 44 && r.height >= 44 && [y - 21, y, y + 21].every(altura => botao.contains(document.elementFromPoint(x, altura))) };
    })).toEqual({ cabe: true, toque: true });
    if (escolha === "Manter equipamento sincronizado") {
      await rever.focus();
      await conferirAlvo();
    }
    await rever.press("Enter");
    const material = (titulo: string) => folha.locator("dl > div").filter({ hasText: titulo }).getByRole("definition");
    await expect(material("Neste aparelho")).toHaveText("Tatame");
    await expect(material("No treino sincronizado")).toContainText(FAIXA);
    await expect(folha).toContainText("Acrescentado no treino sincronizado · " + NOME_PONTE);
    await expect(folha.getByRole("listitem")).toHaveText("Flexão de braço · Série 1");
    await page.keyboard.press("Escape");
    await expect(rever).toBeFocused();
    if (escolha === "Manter equipamento sincronizado") await conferirAlvo();
    expect(await series(conta, id)).toEqual([serieB]);

    if (escolha === "Manter equipamento sincronizado") {
      expect(documentosDeMais).toEqual([]);
      expect(consultasDeMais).toBeGreaterThan(0);
      await semRedeNoWorker(worker);
      await context.setOffline(true);
      expect((await page.reload())?.fromServiceWorker()).toBe(true);
      expect(documentosDeMais).toEqual(["/mais"]);
      await rever.press("Enter");
      await expect(material("Neste aparelho")).toHaveText("Tatame");
      await folha.getByRole("button", { name: escolha, exact: true }).press("Enter");
      await expect(folha.getByRole("status")).toHaveText("Escolha salva neste aparelho.");
      expect(await series(conta, id)).toEqual([serieB]);
      await comRedeNoWorker(worker);
      await context.setOffline(false);
    } else {
      await rever.tap();
      await folha.getByRole("button", { name: escolha, exact: true }).tap();
    }
    await expect.poll(() => naFila(page)).toBe(0);
    const equipamento = escolha === "Manter equipamento sincronizado" ? plano.equipamento_disponivel : ["tatame"];
    expect(await planoSalvo(conta, id)).toMatchObject({ itens: [...INICIAIS, PONTE].map(exercicio_id => ({ exercicio_id })),
      ultima_inclusao: inclusao, equipamento_disponivel: equipamento });
    expect(await series(conta, id)).toMatchObject([{ id: serieA, exercise_id: INICIAIS[0], ordem_ex: 1, reps: 11 }, serieB!]);
    expect((await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho.split("?")[0] === "/rest/v1/session_sets")).toHaveLength(2);
    const limpo = await outroAparelho(browser, baseURL, id);
    await verificarPonte(limpo);
    const flexao = geral(limpo).getByRole("group", { name: PRIMEIRA + "Flexão de braço", exact: true });
    await expect(flexao.getByRole("checkbox")).toBeChecked();
    await expect(flexao.getByRole("textbox", { name: "repetições", exact: true })).toHaveValue("11");
    await limpo.context().close();
    await outro.context().close();
  });
}

test("cópia de edições conserva o descanso e a série da posição antiga, liberando a série compatível", async ({ page, context, browser, baseURL }) => {
  test.slow();
  const { conta, id, plano } = await preparar(page, [INICIAIS[0], PONTE]);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await tirarElastico(page);
  await abrirVisaoGeral(page);
  await registrarSerie(page, "Flexão de braço", "11");
  await registrarSerie(page, NOME_PONTE, "12");
  await expect.poll(() => naFila(page)).toBe(3);
  const antiga: EscritaTabela = {
    tabela: "sessions", op: "update", filtro: { id, user_id: conta.userId, status: "em_andamento" },
    linha: { plano: { ...plano, equipamento_disponivel: ["tatame"], descansos_por_exercicio: { [PONTE]: 55 } } },
  };
  const [flexao, ponteAntiga] = await usarFilaLegada(page, id, conta.userId, antiga, [11, 12]);
  // No plano de B a posição 2 é de agachamento. A ponte entra na 3 e recebe sua própria série.
  await atualizarNoMock(conta, "sessions", "id=eq." + id, {
    plano: { ...plano, itens: planoDaSessao(itensDeIds(INICIAIS)).itens },
  });
  const outro = await outroAparelho(browser, baseURL, id);
  await acrescentarPonte(outro);
  await expect.poll(() => series(conta, id)).toMatchObject([{ exercise_id: PONTE, ordem_ex: 3, reps: 10 }]);
  const [ponteB] = await series(conta, id);
  const remoto = await planoSalvo(conta, id);

  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await page.goto("/mais#sincronizacao");
  const painel = page.getByRole("region", { name: "Sincronização", exact: true });
  const folha = page.getByRole("dialog", { name: REVER, exact: true });
  await painel.getByRole("button", { name: REVER, exact: true }).press("Enter");
  const guardar = folha.getByRole("button", { name: "Guardar cópia e manter treino sincronizado", exact: true });
  const confirmar = folha.getByRole("button", { name: "Confirmar e guardar cópia", exact: true });
  await guardar.press("Enter");
  await folha.getByRole("button", { name: "Voltar", exact: true }).press("Enter");
  await expect(guardar).toBeVisible();
  expect(await series(conta, id)).toEqual([ponteB]);
  await guardar.press("Enter");
  await confirmar.press("Enter");
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await planoSalvo(conta, id)).toEqual(remoto);
  expect(await series(conta, id)).toMatchObject([{ id: flexao, exercise_id: INICIAIS[0], ordem_ex: 1, reps: 11 }, ponteB!]);

  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  const copias = "Cópias de edições do treino";
  await painel.getByRole("button", { name: copias, exact: true }).press("Enter");
  const arquivo = page.waitForEvent("download");
  await page.getByRole("dialog", { name: copias }).getByRole("button", { name: "Baixar cópia", exact: true }).press("Enter");
  const copia = JSON.parse(await readFile((await (await arquivo).path())!, "utf8"));
  expect(copia).toMatchObject({
    formato: "treino-terraco-edicoes-de-sessao-v1", conta: conta.userId, sessaoId: id, original: antiga,
    remota: { id, user_id: conta.userId, plano: remoto },
    seriesGuardadas: [{ id: ponteAntiga, exercicioId: PONTE, indice: 1, payload: { linha: {
      id: ponteAntiga, user_id: conta.userId, session_id: id, ordem_ex: 2, exercise_id: PONTE, reps: 12,
    } } }],
  });
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await page.goto("/treinar/" + id);
  await verificarPonte(page);
  await registrarSerie(page, "Agachamento com peso corporal", "9");
  await expect.poll(() => series(conta, id)).toMatchObject([
    { id: flexao, reps: 11 }, { exercise_id: INICIAIS[1], ordem_ex: 2, reps: 9 }, ponteB!,
  ]);
  await abrirCatalogo(page).tap();
  await busca(page).fill("Rosca com elástico");
  await catalogo(page).getByRole("button", { name: "Adicionar Rosca com elástico", exact: true }).tap();
  await expect.poll(async () => (await planoSalvo(conta, id))?.itens.map(i => i.exercicio_id)).toEqual([...INICIAIS, PONTE, "rosca-com-elastico"]);
  const depois = await planoSalvo(conta, id);
  expect(depois?.descansos_por_exercicio).toBeUndefined();
  expect(depois?.equipamento_disponivel).toEqual(plano.equipamento_disponivel);
  await outro.context().close();
});

for (const remessa of ["primeiro o equipamento", "primeiro o exercício"] as const) {
  test(`dois aparelhos no mesmo treino livre enviam ${remessa}`, async ({ page, context, browser, baseURL }) => {
    test.slow();
    const { conta, id } = await preparar(page);
    const outro = await outroAparelho(browser, baseURL, id);
    const espera = remessa === "primeiro o equipamento" ? outro.context() : context;
    const worker = await workerDoApp(espera);
    await semRedeNoWorker(worker);
    await espera.setOffline(true);
    await tirarElastico(page);
    if (remessa === "primeiro o equipamento") {
      await expect.poll(async () => (await planoSalvo(conta, id))?.equipamento_disponivel).toEqual(["tatame"]);
    } else {
      await expect.poll(() => naFila(page)).toBe(1);
    }
    await acrescentarPonte(outro);
    if (remessa === "primeiro o equipamento") {
      expect(await series(conta, id)).toEqual([]);
    } else {
      await expect.poll(() => series(conta, id)).toMatchObject([{ exercise_id: PONTE, reps: 10 }]);
    }
    await comRedeNoWorker(worker);
    await espera.setOffline(false);
    await expect.poll(() => naFila(remessa === "primeiro o equipamento" ? outro : page)).toBe(0);
    const atual = await planoSalvo(conta, id);
    expect(atual?.itens.map(i => i.exercicio_id)).toEqual([...INICIAIS, PONTE]);
    expect(atual?.equipamento_disponivel).toEqual(["tatame"]);
    expect(await series(conta, id)).toMatchObject([{ exercise_id: PONTE, ordem_ex: 3, reps: 10 }]);
    if (remessa === "primeiro o exercício") {
      await verificarPonte(page);
      await semRedeNoWorker(worker);
      await context.setOffline(true);
      expect((await page.reload())?.fromServiceWorker()).toBe(true);
      await verificarPonte(page);
    }
    const limpo = await outroAparelho(browser, baseURL, id);
    await verificarPonte(limpo);
    await limpo.context().close();
    await outro.context().close();
  });
}

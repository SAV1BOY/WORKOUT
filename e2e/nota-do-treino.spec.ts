import { expect, test, type Locator, type Page } from "@playwright/test";
import type { LinhaSessao, PlanoDaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, atualizarNoMock, avancarNoPlayerAte, comecarNoPlayer,
  definirCota, entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, HOJE_FIXO,
  inserirNoMock, irNaAba, lerDoMock, resetarMock, semRolagemHorizontal, sessaoNoMock,
  usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const DIA = "2026-09-14";
const ROSCA = "rosca-com-elastico";
const NOME = "Rosca com elástico";

async function semearTreino(
  conta: SessaoMock, titulo: string, status: "em_andamento" | "concluida",
  extras: { nota_geral?: string; notas?: string } = {},
) {
  const id = crypto.randomUUID();
  const plano: PlanoDaSessao = {
    titulo, colecao: null, itens: [{
      exercicio_id: ROSCA, tipo: "reps", series: 1, min: 8, max: 12,
      unilateral: false, descanso_s: 60, descanso_texto: "60 s",
    }],
  };
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, workout_id: "livre", fase: "fase1", data: DIA, status,
    iniciada_em: DIA + "T09:00:00Z", concluida_em: status === "concluida" ? DIA + "T09:25:00Z" : null,
    plano, ...extras,
  }]);
  return id;
}

async function sessaoNoServidor(conta: SessaoMock, id: string) {
  const [s] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
  if (!s) throw new Error(`Sessão de teste ausente no mock: ${id}`);
  return s;
}

async function historico(page: Page) {
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
}

function registro(page: Page, titulo: string) {
  return page.getByRole("list", { name: "Registros", exact: true })
    .getByRole("listitem").filter({ has: page.getByText(titulo, { exact: true }) });
}

const adicionar = (onde: Locator) => onde.getByRole("button", { name: "Adicionar nota do treino", exact: true });
const editar = (onde: Locator) => onde.getByRole("button", { name: "Editar nota do treino", exact: true });
const campo = (onde: Locator) => onde.getByRole("textbox", { name: "Nota do treino", exact: true });
const salvar = (onde: Locator) => onde.getByRole("button", { name: "Salvar nota", exact: true });
const resumo = (page: Page) => page.getByRole("dialog", { name: "Treino concluído", exact: true });

async function feedbackComSerieFeita(page: Page, id: string) {
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  const feedback = page.getByRole("region", { name: "Feedback do treino" });
  await avancarNoPlayerAte(page, feedback);
  return feedback;
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, HOJE_FIXO);
});

test("a Visão geral salva a nota digitada ao concluir, conserva as outras notas e repetir começa em branco", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const titulo = "Treino do meio-dia";
  const id = await semearTreino(conta, titulo, "em_andamento");
  const pessoal = "Usar o elástico verde.";
  const bloco = "Última série · fiz dez repetições.";
  const nota = "Hoje tive só 20 minutos.\nAmanhã, horário normal.";
  await inserirNoMock(conta, "exercise_state", [{
    user_id: conta.userId, exercise_id: ROSCA, nota_pessoal: pessoal,
  }]);
  await entrarNoApp(page);
  await page.goto(`/treinar/${id}`);
  await abrirVisaoGeral(page);
  const geral = page.getByRole("dialog", { name: "Visão geral do treino" });
  await geral.getByRole("checkbox", { name: `Série 1 concluída — ${NOME}` }).check();
  await geral.getByRole("textbox", { name: `Nota: ${NOME}` }).fill(bloco);
  await geral.getByRole("button", { name: "Concluir", exact: true }).click();
  const fim = resumo(page);
  await adicionar(fim).focus();
  await page.keyboard.press("Enter");
  await expect(campo(fim)).toBeFocused();
  await campo(fim).fill(nota);
  const gravacaoDaNota = page.waitForRequest(req => req.method() === "PATCH" &&
    new URL(req.url()).pathname === "/rest/v1/sessions" && req.postDataJSON()?.nota_geral === nota);
  await fim.getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  const patch = await gravacaoDaNota;
  expect(patch.postDataJSON()).toEqual({ nota_geral: nota });
  const filtros = new URL(patch.url()).searchParams;
  expect(filtros.get("id")).toBe(`eq.${id}`);
  expect(filtros.get("user_id")).toBe(`eq.${conta.userId}`);
  await expect.poll(() => sessaoNoServidor(conta, id)).toMatchObject({
    id, status: "concluida", nota_geral: nota, notas: `${NOME}: ${bloco}`,
  });
  await historico(page);
  const origem = registro(page, titulo);
  await expect(origem).toContainText(nota);
  await expect(editar(origem)).toBeVisible();
  await origem.getByRole("button", { name: /^Repetir treino/ }).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const novaId = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(novaId).not.toBe(id);
  await abrirVisaoGeral(page);
  await expect(geral.getByRole("textbox", { name: `Nota: ${NOME}` })).toHaveValue("");
  await geral.getByRole("checkbox", { name: `Série 1 concluída — ${NOME}` }).check();
  await geral.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(adicionar(fim)).toBeVisible();
  await adicionar(fim).click();
  await expect(campo(fim)).toHaveValue("");
  await expect.poll(() => sessaoNoServidor(conta, novaId)).toMatchObject({ status: "em_andamento", nota_geral: null });
  expect((await sessaoNoServidor(conta, id)).nota_geral).toBe(nota);
  expect(await lerDoMock(conta, "exercise_state", `exercise_id=eq.${ROSCA}`)).toMatchObject([{ nota_pessoal: pessoal }]);
});

test("salva no feedback sem rede, retoma, conclui com a edição e relê a sessão antes da sincronização", async ({ page, context }) => {
  const conta = await usuarioComPerfil();
  const titulo = "Treino ao ar livre";
  const anterior = "Treino antes do café";
  const id = await semearTreino(conta, titulo, "em_andamento");
  await semearTreino(conta, anterior, "concluida", { nota_geral: "Alonguei mais cedo." });
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await historico(page);
  await expect(registro(page, anterior)).toBeVisible();
  const feedback = await feedbackComSerieFeita(page, id);
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await adicionar(feedback).click();
  const rascunho = "Hoje estava calor.";
  await campo(feedback).fill(rascunho);
  await salvar(feedback).click();
  await expect(editar(feedback)).toBeFocused();
  await semRedeNoWorker(worker);
  await page.reload();
  await expect(feedback.getByText(rascunho, { exact: true })).toBeVisible();
  expect(await sessaoNoServidor(conta, id)).toMatchObject({ status: "em_andamento", nota_geral: null });
  const definitiva = "Hoje estava calor. Fiz uma pausa para beber água.";
  await editar(feedback).click();
  await campo(feedback).fill(definitiva);
  await feedback.getByRole("button", { name: "Concluir sem responder" }).click();
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await esperarAbaTreino(page);
  await historico(page);
  const linha = registro(page, titulo);
  await expect(linha).toContainText(definitiva);
  await expect(linha.getByText(/(?:^|· )1 série$/)).toBeVisible();
  await semRedeNoWorker(worker);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(linha).toContainText(definitiva);
  await expect(linha.getByText(/(?:^|· )1 série$/)).toBeVisible();
  await expect(registro(page, anterior)).toContainText("Alonguei mais cedo.");
  expect(await sessaoNoServidor(conta, id)).toMatchObject({ status: "em_andamento", nota_geral: null });
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => sessaoNoServidor(conta, id)).toMatchObject({
    user_id: conta.userId, status: "concluida", sensacao: null, nota_geral: definitiva,
  });
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(linha).toContainText(definitiva);
});

test("no histórico, editar e apagar offline afeta só o treino escolhido no mesmo dia", async ({ page, context }) => {
  const conta = await usuarioComPerfil();
  const titulo = "Sessão da noite";
  const id = await semearTreino(conta, titulo, "concluida", { nota_geral: "Caminhei antes." });
  const vizinha = "Sessão da manhã";
  const outraId = await semearTreino(conta, vizinha, "concluida", { nota_geral: "Antes do trabalho." });
  const antiga = "Treino antigo com bloco";
  const textoLegado = "Rosca com elástico: cotovelo alinhado.";
  const antigoId = await semearTreino(conta, antiga, "concluida", { notas: textoLegado });
  await entrarNoApp(page);
  await historico(page);
  const linha = registro(page, titulo);
  await expect(linha).toContainText("Caminhei antes.");
  await expect(adicionar(registro(page, antiga))).toBeVisible();
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await editar(linha).focus();
  await page.keyboard.press("Enter");
  await expect(campo(linha)).toBeFocused();
  const editada = "Descansei de manhã · treinei com disposição.";
  await campo(linha).fill(editada);
  await salvar(linha).click();
  await expect(editar(linha)).toBeFocused();
  await semRedeNoWorker(worker);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(linha).toContainText(editada);
  await expect(registro(page, vizinha)).toContainText("Antes do trabalho.");
  expect((await sessaoNoServidor(conta, id)).nota_geral).toBe("Caminhei antes.");
  await editar(linha).click();
  await linha.getByRole("button", { name: "Apagar nota", exact: true }).click();
  await expect(adicionar(linha)).toBeFocused();
  await semRedeNoWorker(worker);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(adicionar(linha)).toBeVisible();
  await expect(linha).not.toContainText(editada);
  await semRolagemHorizontal(page);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => sessaoNoServidor(conta, id)).toMatchObject({ status: "concluida", nota_geral: null });
  expect((await sessaoNoServidor(conta, outraId)).nota_geral).toBe("Antes do trabalho.");
  expect(await sessaoNoServidor(conta, antigoId)).toMatchObject({ notas: textoLegado, nota_geral: null });
});

test("se o aparelho recusar a nota pendente, o feedback permite corrigir e concluir com o texto", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const id = await semearTreino(conta, "Treino com pouco espaço", "em_andamento");
  await entrarNoApp(page);
  const feedback = await feedbackComSerieFeita(page, id);
  const nota = "Usei o tatame na sombra.";
  await adicionar(feedback).click();
  await campo(feedback).fill(nota);
  await page.evaluate(() => {
    const adicionarNaFila = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "outbox" && args[0]?.payload?.linha?.nota_geral) {
        IDBObjectStore.prototype.add = adicionarNaFila;
        throw new DOMException("Falta de espaço simulada", "QuotaExceededError");
      }
      return adicionarNaFila.apply(this, args);
    };
  });
  await feedback.getByRole("button", { name: "Concluir sem responder" }).click();
  await expect(feedback.getByRole("alert")).toBeVisible();
  await expect(campo(feedback)).toHaveValue(nota);
  await expect(campo(feedback)).toBeFocused();
  expect(await sessaoNoServidor(conta, id)).toMatchObject({ status: "em_andamento", nota_geral: null });
  await salvar(feedback).click();
  await expect(editar(feedback)).toBeFocused();
  await feedback.getByRole("button", { name: "Concluir sem responder" }).click();
  await expect.poll(() => sessaoNoServidor(conta, id)).toMatchObject({ status: "concluida", nota_geral: nota });
});

test("ao trocar de conta no aparelho, a segunda pessoa só relê as próprias notas offline", async ({ page, context }) => {
  await definirCota(2);
  const contaA = await usuarioComPerfil();
  const emailB = "notas.de.outra.pessoa@example.test";
  const contaB = await sessaoNoMock(emailB);
  await atualizarNoMock(contaB, "profiles", `user_id=eq.${contaB.userId}`, {
    nome: "Ana", data_inicio: DIA, fase_atual: "fase1", fase_desde: DIA, prefs: { guia_visto: true },
  });
  const titulo = "Treino das sete";
  const textoA = "Nota privada da primeira conta.";
  const textoB = "Anotação da segunda conta.";
  await semearTreino(contaA, titulo, "concluida", { nota_geral: textoA });
  await semearTreino(contaB, titulo, "concluida", { nota_geral: textoB });
  await entrarNoApp(page);
  await historico(page);
  await expect(registro(page, titulo)).toContainText(textoA);
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, emailB);
  await historico(page);
  const linha = registro(page, titulo);
  await expect(linha).toContainText(textoB);
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(linha).toContainText(textoB);
  await expect(page.getByRole("main")).not.toContainText(textoA);
  await editar(linha).click();
  await expect(campo(linha)).toHaveValue(textoB);
});

test("duas abas editando o mesmo histórico mantêm a última nota confirmada e avisam do conflito", async ({ page, context }) => {
  const conta = await usuarioComPerfil();
  const titulo = "Treino em duas abas";
  const id = await semearTreino(conta, titulo, "concluida", { nota_geral: "Texto original." });
  await entrarNoApp(page);
  await historico(page);
  const primeira = registro(page, titulo);
  await editar(primeira).click();
  const rascunho = "Rascunho da primeira aba.";
  await campo(primeira).fill(rascunho);
  const segunda = await context.newPage();
  await fixarData(segunda, HOJE_FIXO);
  await segunda.goto("/relatorio");
  await abrirSecaoDoRelatorio(segunda, "historico");
  const linha = registro(segunda, titulo);
  await editar(linha).click();
  const confirmada = "Horário corrigido pela segunda aba.";
  await campo(linha).fill(confirmada);
  await salvar(linha).click();
  await expect(linha).toContainText(confirmada);
  await expect.poll(() => sessaoNoServidor(conta, id)).toMatchObject({ nota_geral: confirmada });
  await salvar(primeira).click();
  await expect(primeira.getByRole("alert")).toContainText("A nota do treino mudou");
  await expect(campo(primeira)).toHaveValue(rascunho);
  await primeira.getByRole("button", { name: "Cancelar edição da nota" }).click();
  await editar(primeira).click();
  await expect(campo(primeira)).toHaveValue(confirmada);
  await editar(linha).click();
  const maisRecente = "Acrescentei o horário de término.";
  await campo(linha).fill(maisRecente);
  await salvar(linha).click();
  await expect.poll(() => sessaoNoServidor(conta, id)).toMatchObject({ nota_geral: maisRecente });
  // O texto que a primeira aba abriu está intocado. Salvar não deve desfazer a edição mais nova.
  await salvar(primeira).click();
  await expect(campo(primeira)).toBeHidden();
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(primeira).toContainText(maisRecente);
  expect((await sessaoNoServidor(conta, id)).nota_geral).toBe(maisRecente);
});

test("uma sessão aberta no cliente antigo recupera a nota de outro aparelho e passa a relê-la offline", async ({ page, context }) => {
  const conta = await usuarioComPerfil();
  const id = await semearTreino(conta, "Treino que ficou aberto", "em_andamento");
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  const feedback = await feedbackComSerieFeita(page, id);
  await expect(adicionar(feedback)).toBeVisible();
  // Sai do player antes de modelar o registro no formato antigo. Só o novo campo faltava no Dexie.
  await page.goto("/");
  await esperarAbaTreino(page);
  await page.evaluate(id => new Promise<void>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const tx = banco.transaction("sessaoAtiva", "readwrite");
      tx.oncomplete = () => { banco.close(); resolve(); };
      tx.onabort = () => { banco.close(); reject(tx.error); };
      const tabela = tx.objectStore("sessaoAtiva");
      const ler = tabela.get(id);
      ler.onsuccess = () => {
        if (!ler.result?.dados) { tx.abort(); return; }
        delete ler.result.dados.notaGeral;
        tabela.put(ler.result);
      };
    };
  }), id);
  const remota = "Atualizei a anotação em outro aparelho.";
  await atualizarNoMock(conta, "sessions", `id=eq.${id}&user_id=eq.${conta.userId}`, { nota_geral: remota });
  await page.goto(`/treinar/${id}`);
  await expect(feedback.getByText(remota, { exact: true })).toBeVisible();
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.reload();
  await editar(feedback).click();
  await expect(campo(feedback)).toHaveValue(remota);
  await feedback.getByRole("button", { name: "Cancelar edição da nota" }).click();
  const revisada = "Outro aparelho confirmou a revisão final.";
  await atualizarNoMock(conta, "sessions", `id=eq.${id}&user_id=eq.${conta.userId}`, { nota_geral: revisada });
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await page.reload();
  await expect(feedback.getByText(revisada, { exact: true })).toBeVisible();
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.reload();
  await expect(feedback.getByText(revisada, { exact: true })).toBeVisible();
  expect(await sessaoNoServidor(conta, id)).toMatchObject({ status: "em_andamento", nota_geral: revisada });
});

test("o histórico offline já mostra a nota se as métricas de séries ainda estão carregando", async ({ page, context }) => {
  const conta = await usuarioComPerfil();
  const titulo = "Treino com elástico";
  const nota = "Consegui manter o ritmo.";
  await semearTreino(conta, titulo, "concluida", { nota_geral: nota });
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await historico(page);
  await expect(registro(page, titulo)).toContainText(nota);
  // Esta cópia sincronizou o perfil e o histórico. Uma leitura auxiliar não ficou no aparelho.
  await expect.poll(() => page.evaluate(id => new Promise<boolean>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const pedido = banco.transaction("cache").objectStore("cache").get("react-query-v1");
      pedido.onsuccess = () => {
        banco.close();
        resolve(pedido.result?.valor?.estado?.queries?.some(
          (q: { queryKey: string[]; state: { data?: { user_id?: string } } }) =>
            q.queryKey[0] === "perfil" && q.state.data?.user_id === id,
        ) ?? false);
      };
    };
  }), conta.userId)).toBe(true);
  await page.goto("/robots.txt");
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const tx = banco.transaction("cache", "readwrite");
      tx.oncomplete = () => { banco.close(); resolve(); };
      tx.onabort = () => { banco.close(); reject(tx.error); };
      const tabela = tx.objectStore("cache");
      const pedido = tabela.get("react-query-v1");
      pedido.onsuccess = () => {
        const registro = pedido.result;
        registro.valor.estado.queries = registro.valor.estado.queries.filter(
          (q: { queryKey: string[] }) => !(q.queryKey[0] === "progresso" && q.queryKey[1] === "series-todas"),
        );
        tabela.put(registro);
      };
    };
  }));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (entrada, init) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada), location.href);
      if (!navigator.onLine && url.pathname === "/rest/v1/session_sets") {
        // O relatório deve ficar disponível antes do resultado, inclusive durante a tentativa de leitura.
        document.documentElement.dataset.aguardandoSeries = "true";
        return new Promise<Response>(() => {});
      }
      return original(entrada, init);
    };
  });
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.goto("/relatorio");
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(page.locator("html")).toHaveAttribute("data-aguardando-series", "true");
  await expect(registro(page, titulo)).toContainText(nota);
});

import { expect, test, type Locator, type Request } from "@playwright/test";
import { acharExercicio } from "../lib/dados";
import type { LinhaSessao } from "../lib/types";
import { abrirVisaoGeral, esperarServiceWorker, fixarData, HOJE_FIXO, lerDoMock, naFila, requisicoesDoMock, resetarMock } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { abrirCatalogo, busca, catalogo, geral, planoSalvo, series, timer, treinoAberto } from "./treino-livre-ativo";

const flexao = acharExercicio("flexao-de-braco");
const fechada = acharExercicio("flexao-fechada");
const ver = (folha: Locator, nome: string) => folha.getByRole("button", { name: `Ver execução de ${nome}`, exact: true });
const execucao = (folha: Locator, nome: string) => folha.getByRole("region", { name: `Execução de ${nome}`, exact: true });
const adicionarFlexao = (folha: Locator) => folha.getByRole("button", { name: `Adicionar ${flexao.nome}`, exact: true });

async function conferirInstrucoes(folha: Locator, exercicio: typeof flexao) {
  const previa = execucao(folha, exercicio.nome);
  await expect(previa.getByRole("heading", { name: "Montagem", exact: true })).toBeVisible();
  await expect(previa.getByText(exercicio.montagem, { exact: true })).toBeVisible();
  await expect(previa.getByRole("heading", { name: "Instruções", exact: true })).toBeVisible();
  await expect(previa.getByRole("listitem")).toHaveText(exercicio.passos);
}

const materialDaSessao = "/rest/v1/rpc/alterar_material_da_sessao";
const planoDaSessao = "/rest/v1/sessions";
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function alteraSessao(metodo: string, caminho: string) {
  return (metodo === "PATCH" && caminho === planoDaSessao) || (metodo === "POST" && caminho === materialDaSessao);
}

async function alteracoesDeSessao() {
  return (await requisicoesDoMock()).filter(r => alteraSessao(r.metodo, r.caminho)).map(r => r.caminho);
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("comparar duas execuções mantém os filtros e os dois Escapes devolvem o foco sem adicionar", async ({ page }) => {
  const { conta, id } = await treinoAberto(page);
  await abrirVisaoGeral(page);
  await abrirCatalogo(page).tap();
  const folha = catalogo(page);
  const material = folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" });
  const legenda = material.getByText("Equipamentos disponíveis", { exact: true });
  await legenda.scrollIntoViewIfNeeded();
  const ponto = await legenda.evaluate(elemento => {
    const texto = document.createRange();
    texto.selectNodeContents(elemento);
    const retangulo = texto.getBoundingClientRect();
    return { x: retangulo.left + retangulo.width / 2, y: retangulo.top + retangulo.height / 2 };
  });
  const toque = await material.evaluateHandle(resumo => {
    const registro = { alvo: "" };
    resumo.addEventListener("pointerdown", evento => {
      if (evento.target instanceof Element) registro.alvo = evento.target.localName;
    }, { once: true });
    return registro;
  });
  await page.touchscreen.tap(ponto.x, ponto.y);
  expect(await toque.evaluate(registro => registro.alvo)).toBe("summary");
  await toque.dispose();
  await page.keyboard.press("Tab");
  await expect(folha.getByRole("button", { name: "Só peso do corpo", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await folha.getByRole("checkbox", { name: "Tatame", exact: true }).check();
  await folha.getByRole("checkbox", { name: "Elástico (Super Band)", exact: true }).check();
  await material.tap();
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ equipamento_disponivel: ["tatame", "super-band"] });
  const anterior = await planoSalvo(conta, id);
  await expect.poll(() => naFila(page)).toBe(0);
  const alteracoesAntes = await alteracoesDeSessao();
  const grupo = folha.getByRole("combobox", { name: "Grupo muscular" });
  await grupo.selectOption("Peito");
  await busca(page).fill("flexao");
  await expect(adicionarFlexao(folha)).toBeVisible();
  await expect(ver(folha, "Flexão inclinada")).toHaveCount(0); // Precisa de banco.
  const primeira = ver(folha, flexao.nome);
  await expect(primeira).toBeVisible();
  await primeira.press("Enter");
  await conferirInstrucoes(folha, flexao);
  await primeira.press("Enter");
  await expect(primeira).toHaveAttribute("aria-expanded", "false");
  // A flexão fechada também usa o peso do corpo e pertence ao grupo Tríceps.
  await grupo.selectOption("todos");
  const segunda = ver(folha, fechada.nome);
  await primeira.press("Enter");
  await expect(primeira).toHaveAttribute("aria-expanded", "true");
  await segunda.press("Space");
  await conferirInstrucoes(folha, fechada);
  await expect(primeira).toHaveAttribute("aria-expanded", "false");
  await expect(execucao(folha, flexao.nome)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(segunda).toBeFocused();
  await expect(segunda).toHaveAttribute("aria-expanded", "false");
  await expect(busca(page)).toHaveValue("flexao");
  await expect(grupo).toHaveValue("todos");
  await expect(material).toContainText("Elástico e Tatame");
  await page.keyboard.press("Escape");
  await expect(folha).toBeHidden();
  await expect(abrirCatalogo(page)).toBeFocused();
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText(["1. Rosca com elástico", "2. Remada com elástico"]);
  expect(await planoSalvo(conta, id)).toEqual(anterior);
  expect(await series(conta, id)).toEqual([]);
  expect(await naFila(page)).toBe(0);
  expect(await alteracoesDeSessao()).toEqual(alteracoesAntes);
});

test("ler a execução no descanso offline só altera o plano ao adicionar e retoma a próxima série", async ({ page, context }) => {
  test.slow();
  const { conta, id } = await treinoAberto(page);
  await esperarServiceWorker(page);
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await expect(timer(page)).toHaveText("1:35");
  await expect.poll(() => series(conta, id)).toMatchObject([{ exercise_id: "rosca-com-elastico", concluida: true }]);
  await expect.poll(() => naFila(page)).toBe(0);
  const [serie] = await series(conta, id);
  const plano = await planoSalvo(conta, id);
  const alteracoesAntes = await alteracoesDeSessao();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  try {
    await abrirVisaoGeral(page);
    await abrirCatalogo(page).tap();
    const folha = catalogo(page);
    await busca(page).fill("flexao de braco");
    const previa = ver(folha, flexao.nome);
    await expect(previa).toBeVisible();
    await previa.tap();
    await conferirInstrucoes(folha, flexao);
    await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 17_000).toISOString());
    expect(await naFila(page)).toBe(0);
    await adicionarFlexao(folha).tap();
    await expect(abrirCatalogo(page)).toBeFocused();
    await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText(["1. Rosca com elástico", "2. Remada com elástico", "3. Flexão de braço"]);
    await expect(geral(page).getByRole("checkbox", { name: "Série 1 concluída — Rosca com elástico", exact: true })).toBeChecked();
    await expect.poll(() => naFila(page)).toBe(1);
    expect(await planoSalvo(conta, id)).toEqual(plano);
    await semRedeNoWorker(worker);
    expect((await page.reload())?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(url => url.pathname === `/treinar/${id}`);
    await expect(timer(page)).toHaveText("1:18");
    await page.getByRole("button", { name: "Pular descanso", exact: true }).click();
    await expect(page.getByText("Série 2 de 3 · exercício 1 de 3", { exact: true })).toBeVisible();
  } finally {
    await comRedeNoWorker(await workerDoApp(context));
    await context.setOffline(false);
  }
  await expect.poll(() => naFila(page)).toBe(0);
  expect((await planoSalvo(conta, id))?.itens.map(item => item.exercicio_id)).toEqual(["rosca-com-elastico", "remada-com-elastico", flexao.id]);
  expect(await alteracoesDeSessao()).toEqual([...alteracoesAntes, planoDaSessao]);
  expect(await series(conta, id)).toEqual([serie]);
});

test("o catálogo adota o material alterado em outra aba e deixa escolher um agachamento compatível", async ({ page, context }) => {
  test.slow();
  const { conta, id, plano } = await treinoAberto(page);
  await esperarServiceWorker(page);
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await expect.poll(() => series(conta, id)).toHaveLength(1);
  const [anterior] = await series(conta, id);
  await page.getByRole("button", { name: "Pular descanso", exact: true }).click();
  await abrirVisaoGeral(page);
  await abrirCatalogo(page).click();
  const folha = catalogo(page);
  const grupo = folha.getByRole("combobox", { name: "Grupo muscular" });
  await grupo.selectOption("Pernas");
  await busca(page).fill("agachamento");
  const frontal = acharExercicio("agachamento-frontal");
  const corporal = acharExercicio("agachamento-com-peso-corporal");
  await ver(folha, frontal.nome).press("Enter");
  await expect(execucao(folha, frontal.nome)).toBeVisible();

  const outra = await context.newPage();
  await fixarData(outra);
  await outra.goto(`/treinar/${id}`);
  await abrirVisaoGeral(outra);
  await abrirCatalogo(outra).click();
  await expect.poll(() => naFila(page)).toBe(0);
  const alteracoesAntes = await alteracoesDeSessao();
  const confirmadas: Request[] = [];
  context.on("response", resposta => {
    const pedido = resposta.request();
    if (resposta.ok() && alteraSessao(pedido.method(), new URL(pedido.url()).pathname)) confirmadas.push(pedido);
  });
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  try {
    const material = (onde: Locator) => onde.locator("summary").filter({ hasText: "Equipamentos disponíveis" });
    await material(catalogo(outra)).click();
    await catalogo(outra).getByRole("button", { name: "Só peso do corpo", exact: true }).click();
    await expect.poll(() => naFila(outra)).toBe(1); // A escolha da outra aba já foi gravada no aparelho.
    const adicionarFrontal = folha.getByRole("button", { name: `Adicionar ${frontal.nome}`, exact: true });
    await adicionarFrontal.press("Enter");
    await expect(material(folha)).toContainText("Só peso do corpo");
    await expect(adicionarFrontal).toHaveCount(0);
    await expect(ver(folha, frontal.nome)).toHaveCount(0);
    await expect(execucao(folha, frontal.nome)).toHaveCount(0);
    await expect(busca(page)).toBeFocused();
    await expect(busca(page)).toHaveValue("agachamento");
    await expect(grupo).toHaveValue("Pernas");
    expect(await naFila(page)).toBe(1);
    expect(await planoSalvo(conta, id)).toEqual(plano);
    await folha.getByRole("button", { name: `Adicionar ${corporal.nome}`, exact: true }).tap();
    await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText(["1. Rosca com elástico", "2. Remada com elástico", `3. ${corporal.nome}`]);
    await expect(page).toHaveURL(url => url.pathname === `/treinar/${id}`);
    expect(await naFila(page)).toBe(2);
  } finally {
    await comRedeNoWorker(await workerDoApp(context));
    await context.setOffline(false);
  }
  await expect.poll(() => naFila(page)).toBe(0);
  const [gravada] = await lerDoMock<LinhaSessao>(conta, "sessions", "id=eq." + id);
  expect(gravada).toMatchObject({
    id, user_id: conta.userId, revisao_equipamento: expect.stringMatching(uuid), plano: {
      equipamento_disponivel: [], itens: [...plano.itens, { exercicio_id: corporal.id }],
      ultima_inclusao: { id: expect.stringMatching(uuid), sessao_id: id, exercicio_id: corporal.id, ordem: 3, estado: "disponivel" },
    },
  });
  expect(await alteracoesDeSessao()).toEqual([...alteracoesAntes, materialDaSessao, planoDaSessao]);
  expect(confirmadas.map(pedido => new URL(pedido.url()).pathname)).toEqual([materialDaSessao, planoDaSessao]);
  const [material, inclusao] = confirmadas;
  expect(material!.postDataJSON()).toMatchObject({
    p_sessao: id, p_comando: gravada!.revisao_equipamento, p_de: plano.equipamento_disponivel, p_para: [],
  });
  expect(Object.fromEntries(new URL(inclusao!.url()).searchParams)).toMatchObject({ id: "eq." + id, user_id: "eq." + conta.userId, status: "eq.em_andamento" });
  expect(inclusao!.postDataJSON()).toEqual({ plano: gravada!.plano });
  expect(await series(conta, id)).toEqual([anterior]);
});

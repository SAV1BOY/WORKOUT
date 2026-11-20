import { expect, test, type Page } from "@playwright/test";
import type { ModeloDeTreino } from "../lib/modelo-de-treino";
import {
  entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, inserirNoMock, lerDoMock, naFila,
  requisicoesDoMock, resetarMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { ajustar, campo, carregar, descanso, dialogo, editor, personalizar, pronto } from "./montar-modelo";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const SUPINO = "supino-reto-com-barra";
const FLEXAO = "flexao-de-braco";
const REMADA = "remada-com-elastico";
const TABELA = "modelos_de_treino";
const copia = (page: Page) => editor(page).getByRole("button", { name: "Salvar como cópia", exact: true });
const atualizar = (page: Page) => editor(page).getByRole("button", { name: "Atualizar treino", exact: true });
const formulario = (page: Page) => dialogo(page, "Salvar como cópia");
const confirmar = (page: Page) => formulario(page).getByRole("button", { name: "Salvar", exact: true });
const nome = (page: Page) => formulario(page).getByRole("textbox", { name: "Nome do treino" });

async function preparar(page: Page) {
  const conta = await usuarioComPerfil();
  const original: ModeloDeTreino = {
    id: crypto.randomUUID(), user_id: conta.userId, nome: "Força de segunda", exercicios: [SUPINO, REMADA],
    equipamento_disponivel: null, series_por_exercicio: { [SUPINO]: 4, [REMADA]: 5 },
    descansos_por_exercicio: { [SUPINO]: 110, [REMADA]: 95 },
  };
  await inserirNoMock(conta, TABELA, [{ ...original }]);
  await entrarNoApp(page);
  await carregar(page, original.nome);
  await expect(copia(page)).toBeVisible();
  return { conta, original };
}

const modelos = (conta: SessaoMock) => lerDoMock<ModeloDeTreino>(conta, TABELA,
  "select=id,user_id,nome,exercicios,equipamento_disponivel,series_por_exercicio,descansos_por_exercicio");

async function enviosDeModelos() {
  return (await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho === "/rest/v1/" + TABELA).length;
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("uma variação feita offline conserva material, ordem e ajustes após recarga e sincroniza uma única cópia", async ({ page, context }) => {
  test.slow();
  const { conta, original } = await preparar(page);
  await esperarServiceWorker(page);
  const enviosAntes = await enviosDeModelos();
  const nomeNovo = "Segunda com tatame";
  const material = editor(page).locator("summary").filter({ hasText: "Equipamentos disponíveis" });
  await material.click();
  const kit = editor(page).getByRole("group", { name: "Equipamento de hoje", exact: true });
  await kit.getByRole("button", { name: "Só peso do corpo", exact: true }).click();
  for (const rotulo of ["Tatame", "Elástico (Super Band)"]) await kit.getByRole("checkbox", { name: rotulo, exact: true }).check();
  await material.click();
  await editor(page).getByRole("button", { name: "Trocar Supino reto com barra", exact: true }).click();
  const alternativas = dialogo(page, "Trocar exercício").getByRole("list", { name: "Exercícios alternativos" });
  await alternativas.getByRole("button", { name: /^Flexão de braço\s/ }).click();
  await ajustar(page).click();
  await campo(page, "Flexão de braço").selectOption("2");
  await descanso(page, "Flexão de braço").fill("70");
  await pronto(page);

  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await copia(page).press("Enter");
  await expect(nome(page)).toHaveValue("Cópia de " + original.nome);
  await nome(page).fill(nomeNovo);
  // Só a inclusão deste modelo na fila falha. A tentativa seguinte deve manter o mesmo UUID.
  const falha = await page.evaluateHandle(() => {
    const estado = { id: "" };
    const adicionar = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "outbox" && args[0]?.tipo === "modelo_de_treino") {
        IDBObjectStore.prototype.add = adicionar;
        estado.id = args[0].payload.linha.id;
        throw new DOMException("Sem espaço para a cópia", "QuotaExceededError");
      }
      return adicionar.apply(this, args);
    };
    return estado;
  });
  await confirmar(page).click();
  await expect(formulario(page).getByRole("alert")).toBeVisible();
  await expect(nome(page)).toHaveValue(nomeNovo);
  const id = await falha.evaluate(estado => estado.id);
  await falha.dispose();
  expect(id).toMatch(/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i);
  expect(id).not.toBe(original.id);
  expect(await naFila(page)).toBe(0);
  await confirmar(page).evaluate((alvo: HTMLButtonElement) => { alvo.click(); alvo.click(); });
  await expect(copia(page)).toBeFocused();
  await expect(page.getByText("Cópia salva.", { exact: true })).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(1);
  expect(await modelos(conta)).toEqual([original]);

  await page.keyboard.press("Escape");
  await expect(personalizar(page)).toBeFocused();
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await esperarAbaTreino(page);
  await carregar(page, original.nome);
  await expect(editor(page).getByRole("button", { name: "Tirar Supino reto com barra", exact: true })).toBeVisible();
  await ajustar(page).click();
  await expect(campo(page, "Supino reto com barra")).toHaveValue("4");
  await expect(descanso(page, "Supino reto com barra")).toHaveValue("110");
  await pronto(page);
  await editor(page).getByRole("button", { name: "Treinos salvos", exact: true }).click();
  const biblioteca = dialogo(page, "Treinos salvos");
  await expect(biblioteca.getByRole("button", { name: /^Carregar / })).toHaveCount(2);
  await biblioteca.getByRole("button", { name: "Carregar " + nomeNovo, exact: true }).click();
  const escolhidos = editor(page).getByRole("list", { name: "Escolhidos" }).getByRole("button", { name: /^Tirar / });
  await expect(escolhidos).toHaveCount(2);
  await expect(escolhidos.nth(0)).toHaveAccessibleName("Tirar Flexão de braço");
  await expect(escolhidos.nth(1)).toHaveAccessibleName("Tirar Remada com elástico");
  await expect(material).toContainText("Elástico e Tatame");
  await ajustar(page).click();
  await expect(campo(page, "Flexão de braço")).toHaveValue("2");
  await expect(descanso(page, "Flexão de braço")).toHaveValue("70");
  await expect(campo(page, "Remada com elástico")).toHaveValue("5");
  await expect(descanso(page, "Remada com elástico")).toHaveValue("95");
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  const salvos = await modelos(conta);
  expect(salvos).toHaveLength(2);
  expect(salvos.find(m => m.id === original.id)).toEqual(original);
  const variacao = salvos.find(m => m.id === id);
  expect(variacao).toEqual({
    id, user_id: conta.userId, nome: nomeNovo, exercicios: [FLEXAO, REMADA],
    equipamento_disponivel: expect.arrayContaining(["super-band", "tatame"]),
    series_por_exercicio: { [FLEXAO]: 2, [REMADA]: 5 }, descansos_por_exercicio: { [FLEXAO]: 70, [REMADA]: 95 },
  });
  expect(variacao?.equipamento_disponivel).toHaveLength(2);
  expect(await enviosDeModelos()).toBe(enviosAntes + 1);
  expect(await lerDoMock(conta, "sessions")).toEqual([]);
});

test("a edição logo depois de copiar o modelo altera só a cópia que ficou aberta", async ({ page }) => {
  const { conta, original } = await preparar(page);
  const sugerido = "Cópia de " + original.nome;
  await copia(page).click();
  await nome(page).fill("Descartado");
  await formulario(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(copia(page)).toBeFocused();
  expect(await modelos(conta)).toEqual([original]);
  await copia(page).click();
  await expect(nome(page)).toHaveValue(sugerido);
  await confirmar(page).click();
  await expect(copia(page)).toBeFocused();
  await expect.poll(() => modelos(conta)).toHaveLength(2);
  const nova = (await modelos(conta)).find(m => m.id !== original.id)!;
  expect(nova).toEqual({ ...original, id: expect.any(String), nome: sugerido });
  await editor(page).getByRole("button", { name: "Tirar Remada com elástico", exact: true }).click();
  await atualizar(page).click();
  const edicao = dialogo(page, "Atualizar treino");
  await expect(edicao.getByRole("textbox", { name: "Nome do treino" })).toHaveValue(sugerido);
  const revisado = "Segunda de supino";
  await edicao.getByRole("textbox", { name: "Nome do treino" }).fill(revisado);
  await edicao.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect.poll(() => modelos(conta)).toEqual(expect.arrayContaining([original, {
    ...nova, nome: revisado, exercicios: [SUPINO], series_por_exercicio: { [SUPINO]: 4 }, descansos_por_exercicio: { [SUPINO]: 110 },
  }]));
  expect(await modelos(conta)).toHaveLength(2);
  expect(await lerDoMock(conta, "sessions")).toEqual([]);
});

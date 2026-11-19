import { expect, test, type Locator, type Page } from "@playwright/test";
import type { LinhaSerie } from "../lib/types";
import {
  abrirVisaoGeral, atualizarNoMock, comecarNoPlayer, comecarOTreinoDoDia, definirCota,
  entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, HOJE_FIXO, inserirNoMock,
  lerDoMock, resetarMock, semRolagemHorizontal, sessaoNoMock,
} from "./fixtures";

const ATLETA = "equipamento-a@example.test";
const OUTRA_CONTA = "equipamento-b@example.test";
const FAIXA = "Elástico (Super Band)";
const KIT = [FAIXA, "Tatame"];

async function prepararConta(email: string) {
  const conta = await sessaoNoMock(email);
  await atualizarNoMock(conta, "profiles", `user_id=eq.${conta.userId}`, {
    nome: "Atleta", data_inicio: "2026-09-14", fase_atual: "fase1", fase_desde: "2026-09-14",
    prefs: { guia_visto: true },
  });
  return conta;
}

async function abrirEquipamento(folha: Locator, titulo = "Equipamentos disponíveis") {
  await folha.locator("summary").filter({ hasText: titulo }).click();
  const grupo = folha.getByRole("group", { name: "Equipamento de hoje", exact: true });
  await expect(grupo).toBeVisible();
  return grupo;
}

async function abrirAjustes(page: Page) {
  await page.getByRole("button", { name: "Ajustar", exact: true }).click();
  return abrirEquipamento(page.getByRole("dialog"), "Equipamento de hoje");
}

async function fechar(page: Page, folha = page.getByRole("dialog")) {
  await page.keyboard.press("Escape");
  await expect(folha).toBeHidden();
}

async function escolherKit(grupo: Locator) {
  await grupo.getByRole("button", { name: "Só peso do corpo" }).click();
  for (const nome of KIT) await grupo.getByRole("checkbox", { name: nome, exact: true }).check();
}

async function verificarKit(grupo: Locator, nomes: string[]) {
  await expect(grupo.getByRole("checkbox", { checked: true })).toHaveCount(nomes.length);
  for (const nome of nomes) await expect(grupo.getByRole("checkbox", { name: nome, exact: true })).toBeChecked();
}

async function verificarPadrao(grupo: Locator) {
  const total = await grupo.getByRole("checkbox").count();
  expect(total).toBeGreaterThan(2);
  await expect(grupo.getByRole("checkbox", { checked: true })).toHaveCount(total);
}

function alternativa(folha: Locator, nome: string) {
  return folha.getByRole("list", { name: "Exercícios alternativos" })
    .getByRole("button", { name: new RegExp(`^${nome}(?:\\s|$)`) });
}

async function verificarMontagens(folha: Locator, disponiveis: string[]) {
  const opcoes = folha.getByRole("list", { name: "Exercícios alternativos" }).locator(":scope > li");
  await expect(opcoes.first()).toBeVisible();
  for (const opcao of await opcoes.all()) {
    const escolher = opcao.locator(":scope > button");
    await expect(escolher).toHaveCount(1);
    const montagem = await escolher.locator("span:nth-child(2)").innerText();
    const materiais = montagem.split(" · ").at(-1)!.split(/ ou | \+ /);
    for (const material of materiais) expect(["Peso do corpo", ...disponiveis], montagem).toContain(material);
  }
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await definirCota(3);
  await page.setViewportSize({ width: 360, height: 740 });
  await fixarData(page, HOJE_FIXO);
});

test("tatame e elástico filtram dois movimentos e só liberam o supino com a montagem completa", async ({ page }) => {
  await prepararConta(ATLETA);
  await entrarNoApp(page, ATLETA);
  const ajustes = await abrirAjustes(page);
  await verificarPadrao(ajustes);
  await escolherKit(ajustes);
  await semRolagemHorizontal(page);
  for (const nome of KIT) {
    const label = ajustes.locator("label").filter({ has: page.getByRole("checkbox", { name: nome, exact: true }) });
    const caixa = await label.boundingBox();
    expect(caixa?.height).toBeGreaterThanOrEqual(44);
    expect(caixa?.width).toBeGreaterThanOrEqual(44);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(360);
  }
  await fechar(page);

  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  await page.getByRole("button", { name: "Substituir Remada curvada pronada" }).click();
  await expect(alternativa(folha, "Remada com elástico")).toBeVisible();
  await expect(alternativa(folha, "Remada baixa na polia")).toHaveCount(0);
  await verificarMontagens(folha, KIT);
  await fechar(page, folha);

  await page.getByRole("button", { name: "Substituir Supino reto com barra" }).click();
  await expect(alternativa(folha, "Flexão de braço")).toBeVisible();
  await verificarMontagens(folha, KIT);
  const supino = alternativa(folha, "Supino reto com halteres");
  const edicao = await abrirEquipamento(folha);
  await verificarKit(edicao, KIT);
  await edicao.getByRole("checkbox", { name: "Halteres", exact: true }).check();
  await edicao.getByRole("checkbox", { name: "Banco", exact: true }).check();
  await expect(supino).toHaveCount(0);
  await edicao.getByRole("checkbox", { name: "Anilhas", exact: true }).check();
  await expect(supino).toBeVisible();
  await edicao.getByRole("button", { name: "Só peso do corpo" }).click();
  await verificarKit(edicao, []);
  await expect(supino).toHaveCount(0);
  await expect(alternativa(folha, "Flexão de braço")).toBeVisible();
  await verificarMontagens(folha, []);
  await edicao.getByRole("button", { name: "Usar todo o equipamento" }).click();
  await verificarPadrao(edicao);
  await expect(supino).toBeVisible();
  await semRolagemHorizontal(page);
});

test("a ficha, o player e a visão geral compartilham o material mesmo offline, sem alterar séries e trocas lembradas", async ({ page, context }) => {
  test.slow(); // cruza duas sessões de verdade, duas recargas offline e a fila que registra as séries
  const conta = await prepararConta(ATLETA);
  await inserirNoMock(conta, "trocas_do_programa", [{
    user_id: conta.userId, workout_id: "A1", exercicio_original_id: "agachamento-livre", substituto_id: "agachamento-goblet",
  }]);
  const preferencias = await lerDoMock(conta, "trocas_do_programa");
  await entrarNoApp(page, ATLETA);
  await esperarServiceWorker(page);
  await escolherKit(await abrirAjustes(page));
  await fechar(page);

  await page.getByRole("button", { name: "Ficha: Agachamento goblet" }).click();
  const ficha = page.getByRole("dialog");
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await verificarKit(await abrirEquipamento(ficha), KIT);
  await fechar(page, ficha);
  await comecarOTreinoDoDia(page);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await comecarNoPlayer(page);
  await verificarKit(await abrirAjustes(page), KIT);
  await fechar(page);
  await page.getByRole("button", { name: "Como fazer: Agachamento goblet" }).click();
  await ficha.getByRole("button", { name: "Substituir", exact: true }).click();
  await verificarKit(await abrirEquipamento(ficha), KIT);
  await fechar(page, ficha);

  await abrirVisaoGeral(page);
  const bloco = page.locator("#bloco-1");
  const segunda = bloco.getByRole("group", { name: "Série 2 — Agachamento goblet", exact: true }).getByRole("checkbox");
  await segunda.click();
  await expect(segunda).toBeChecked();
  const buscarSeries = () => lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}&concluida=eq.true`);
  await expect.poll(buscarSeries).toHaveLength(1);
  const original = await buscarSeries();
  expect(original[0]).toMatchObject({ id: expect.any(String), set_index: 2, exercise_id: "agachamento-goblet" });

  await context.setOffline(true);
  await bloco.getByRole("button", { name: /substituir hoje/i }).click();
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  const material = await abrirEquipamento(folha);
  await verificarKit(material, KIT);
  await material.getByRole("button", { name: "Só peso do corpo" }).click();
  await verificarKit(material, []);
  await fechar(page, folha);
  await page.reload();
  await abrirVisaoGeral(page);
  await expect(segunda).toBeChecked();
  await page.locator("#bloco-3").getByRole("button", { name: /substituir hoje/i }).click();
  const remada = alternativa(folha, "Remada com elástico");
  const depois = await abrirEquipamento(folha);
  await verificarKit(depois, []);
  await expect(remada).toHaveCount(0);
  await depois.getByRole("checkbox", { name: FAIXA, exact: true }).check();
  await expect(remada).toBeVisible();
  await fechar(page, folha);
  await page.reload();
  await abrirVisaoGeral(page);
  await bloco.getByRole("button", { name: /substituir hoje/i }).click();
  await verificarKit(await abrirEquipamento(folha), [FAIXA]);
  await fechar(page, folha);
  await expect(segunda).toBeChecked();
  await context.setOffline(false);
  await expect.poll(async () => {
    const [sessao] = await lerDoMock<{ plano: { equipamento_disponivel?: string[] } | null }>(conta, "sessions", `id=eq.${id}`);
    return sessao?.plano?.equipamento_disponivel;
  }).toEqual(["super-band"]);
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  await expect.poll(async () => (await lerDoMock(conta, "sessions", `id=eq.${id}`))[0]?.status).toBe("concluida");
  expect(await buscarSeries()).toEqual(original);
  expect(await lerDoMock(conta, "trocas_do_programa")).toEqual(preferencias);

  // Outra sessão do MESMO dia deve nascer com o inventário completo.
  await page.goto("/treinar");
  await page.getByRole("button", { name: "Começar o Treino A" }).click();
  await abrirVisaoGeral(page);
  await expect(page).not.toHaveURL(new RegExp(id));
  await expect(bloco.getByRole("heading", { name: "1. Agachamento goblet" })).toBeVisible();
  await bloco.getByRole("button", { name: /substituir hoje/i }).click();
  await verificarPadrao(await abrirEquipamento(folha));
});

test("a seleção do treino em preparação fica isolada ao trocar de conta no mesmo aparelho", async ({ page }) => {
  await prepararConta(ATLETA);
  await prepararConta(OUTRA_CONTA);
  await entrarNoApp(page, ATLETA);
  await escolherKit(await abrirAjustes(page));
  await fechar(page);
  await page.reload();
  await verificarKit(await abrirAjustes(page), KIT);
  await fechar(page);
  await page.goto("/mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, OUTRA_CONTA);
  const ajustes = await abrirAjustes(page);
  await verificarPadrao(ajustes);
  await fechar(page);
  await page.getByRole("button", { name: "Substituir Supino reto com barra" }).click();
  await expect(alternativa(page.getByRole("dialog"), "Supino reto com halteres")).toBeVisible();
});

test("se falta espaço ao começar, o aparelho conserva a seleção para tentar de novo", async ({ page }) => {
  const conta = await prepararConta(ATLETA);
  await entrarNoApp(page, ATLETA);
  await escolherKit(await abrirAjustes(page));
  await fechar(page);
  // A sessão local já foi escrita na transação quando a inclusão na fila encontra a quota.
  await page.evaluate(() => {
    const adicionar = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "outbox" && args[0]?.tipo === "sessao") {
        IDBObjectStore.prototype.add = adicionar;
        throw new DOMException("Armazenamento cheio", "QuotaExceededError");
      }
      return adicionar.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.getByText("Não consegui começar o treino agora.", { exact: true })).toBeVisible();
  expect(await lerDoMock(conta, "sessions")).toEqual([]);
  const locais = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const total = banco.transaction("sessaoAtiva").objectStore("sessaoAtiva").count();
      total.onsuccess = () => { banco.close(); resolve(total.result); };
      total.onerror = () => { banco.close(); reject(total.error); };
    };
  }));
  expect(locais).toBe(0);

  await page.reload();
  await verificarKit(await abrirAjustes(page), KIT);
  await fechar(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await verificarKit(await abrirAjustes(page), KIT);
  await expect.poll(() => lerDoMock(conta, "sessions")).toMatchObject([{
    status: "em_andamento", plano: { equipamento_disponivel: expect.arrayContaining(["tatame", "super-band"]) },
  }]);
});

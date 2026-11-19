import { expect, test, type Locator, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { LinhaSerie } from "../lib/types";
import {
  abrirVisaoGeral, comecarNoPlayer, entrarNoApp, esperarServiceWorker, fixarData, HOJE_FIXO,
  inserirNoMock, irNaAba, lerDoMock, naFila, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { FRONTAL, geral, NOME, series, treinoAberto } from "./treino-livre-ativo";

const ERRO = /Use um número inteiro\./;
const concluir = (page: Page) => page.getByRole("button", { name: "Concluir série", exact: true });

async function colar(campo: Locator, texto: string) {
  const page = campo.page();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
  await campo.focus();
  await campo.press("ControlOrMeta+a");
  await page.evaluate(valor => navigator.clipboard.writeText(valor), texto);
  await campo.press("ControlOrMeta+v");
}

/** Conta as escritas, pois duas tentativas com o mesmo ID deixam apenas uma linha no servidor. */
function enviosDaSerie(page: Page, sessaoId: string) {
  const envios: LinhaSerie[] = [];
  page.on("request", pedido => {
    if (pedido.method() !== "POST" || new URL(pedido.url()).pathname !== "/rest/v1/session_sets") return;
    const dados: LinhaSerie | LinhaSerie[] = pedido.postDataJSON();
    for (const linha of Array.isArray(dados) ? dados : [dados]) {
      if (linha.session_id === sessaoId) envios.push(linha);
    }
  });
  return envios;
}

async function conferirFracao(campo: Locator) {
  await expect(campo).toHaveValue(/^9[.,]5$/);
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  await expect(campo).toHaveAccessibleDescription(ERRO);
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("o player mantém 9,5 visível para correção e envia uma só série de 9 repetições com 27,5 kg após reconectar", async ({ page, context }) => {
  const { id, conta } = await treinoAberto(page, { comFrontal: true });
  const envios = enviosDaSerie(page, id);
  const reps = page.getByRole("textbox", { name: "repetições", exact: true });
  const carga = page.getByRole("textbox", { name: "carga na barra", exact: true });
  await expect(reps).toHaveAttribute("inputmode", "numeric");
  await expect(carga).toHaveAttribute("inputmode", "decimal");
  await esperarServiceWorker(page);
  await expect.poll(() => naFila(page)).toBe(0);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);

  await carga.fill("27,5");
  await carga.press("Enter");
  await reps.fill("");
  await reps.pressSequentially("9,5");
  await reps.press("Tab");
  await expect(reps).not.toBeFocused();
  await conferirFracao(reps);
  await concluir(page).tap();
  await expect(reps).toBeFocused();
  await conferirFracao(reps);
  await expect(page.getByRole("timer", { name: "Descanso" })).toHaveCount(0);
  expect(await naFila(page)).toBe(0);
  expect(envios).toEqual([]);

  await colar(reps, "2147483648");
  await concluir(page).tap();
  await expect(reps).toBeFocused();
  await expect(reps).toHaveValue("2147483648");
  await expect(reps).toHaveAttribute("aria-invalid", "true");
  await expect(reps).toHaveAccessibleDescription(/O maior valor permitido é 2\.147\.483\.647\./);
  expect(await naFila(page)).toBe(0);

  await reps.fill("2147483647");
  await page.getByRole("button", { name: "Aumentar repetições", exact: true }).tap();
  await expect(reps).toHaveValue(/^(2147483647|2\.147\.483\.647)$/);
  await reps.fill("9");
  await reps.press("Enter");
  await expect(reps).not.toHaveAttribute("aria-invalid", "true");
  await expect(carga).toHaveValue("27,5");
  await concluir(page).tap();
  await expect(page.getByRole("timer", { name: "Descanso" })).toBeVisible();
  await expect.poll(() => naFila(page)).toBeGreaterThan(0);
  expect(await series(conta, id)).toEqual([]);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  const esperado = { exercise_id: FRONTAL, tipo: "trabalho", set_index: 1, reps: 9, carga_kg: 27.5 };
  expect(await series(conta, id)).toMatchObject([esperado]);
  expect(envios).toMatchObject([esperado]);
});

test("na Visão geral a colagem de 9.5 bloqueia apenas a linha editada, conserva o foco ao confirmar e permite corrigir", async ({ page }) => {
  const { conta, id } = await treinoAberto(page, { comFrontal: true });
  const envios = enviosDaSerie(page, id);
  await abrirVisaoGeral(page);
  const linha = (n: number) => geral(page).getByRole("group", { name: `Série ${n} — ${NOME}`, exact: true });
  const reps = linha(1).getByRole("textbox", { name: "repetições", exact: true });
  const marcar = linha(1).getByRole("checkbox");
  await expect(reps).toHaveAttribute("inputmode", "numeric");
  await colar(reps, "9.5");
  await reps.press("Enter");
  await expect(reps).toBeFocused();
  await conferirFracao(reps);
  await marcar.tap();
  await expect(marcar).not.toBeChecked();
  await expect(reps).toBeFocused();
  expect(await series(conta, id)).toEqual([]);
  expect(envios).toEqual([]);

  await linha(2).getByRole("textbox", { name: "repetições", exact: true }).fill("7");
  await linha(2).getByRole("checkbox").tap();
  await expect(linha(2).getByRole("checkbox")).toBeChecked();
  await conferirFracao(reps);
  await reps.fill("9");
  await marcar.tap();
  await expect(marcar).toBeChecked();
  const esperado = [{ set_index: 2, reps: 7 }, { set_index: 1, reps: 9 }];
  await expect.poll(() => envios).toMatchObject(esperado);
  await expect.poll(() => naFila(page)).toBe(0);
  const gravadas = await series(conta, id);
  expect(gravadas).toHaveLength(2);
  expect(gravadas).toEqual(expect.arrayContaining(esperado.map(s => expect.objectContaining(s))));
});

test("a prancha impede iniciar com segundos fracionários, aceita 13 s e o IMC preserva altura decimal", async ({ page }) => {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  const id = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id, data: "2026-09-14", iniciada_em: HOJE_FIXO, status: "em_andamento", workout_id: "livre", fase: "fase1",
    plano: planoDaSessao(itensDeIds(["prancha"])),
  }]);
  await inserirNoMock(conta, "body_weights", [{ data: "2026-09-14", peso_kg: 85 }]);
  await entrarNoApp(page);
  await irNaAba(page, "Corpo");
  const imc = page.getByRole("region", { name: "IMC", exact: true });
  await imc.getByRole("button", { name: "Editar altura" }).click();
  const altura = imc.getByRole("textbox", { name: "altura em cm", exact: true });
  await altura.fill("185,5");
  await imc.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect.poll(async () => (await lerDoMock<{ altura_cm: number }>(conta, "profiles"))[0]?.altura_cm).toBe(185.5);

  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  const segundos = page.getByRole("textbox", { name: "segundos", exact: true });
  const iniciar = page.getByRole("button", { name: "Começar", exact: true });
  const envios = enviosDaSerie(page, id);
  await expect(segundos).toHaveAttribute("inputmode", "numeric");
  await colar(segundos, "9.5");
  await iniciar.tap();
  await conferirFracao(segundos);
  await expect(segundos).toBeFocused();
  await expect(iniciar).toBeVisible();
  await expect(page.getByRole("button", { name: "Pausar", exact: true })).toHaveCount(0);
  await concluir(page).tap();
  await expect(segundos).toBeFocused();
  expect(await series(conta, id)).toEqual([]);
  expect(envios).toEqual([]);
  await segundos.fill("13");
  await segundos.press("Enter");
  await expect(page.getByRole("timer", { name: "Contagem do exercício", exact: true })).toHaveText("0:13");
  await concluir(page).tap();
  const esperado = { exercise_id: "prancha", set_index: 1, tipo: "trabalho", tempo_s: 13, concluida: true };
  await expect.poll(() => series(conta, id)).toMatchObject([esperado]);
  expect(envios).toMatchObject([esperado]);
});

test("fechar a ficha com 1,5 em Séries conserva as três séries da prescrição", async ({ page }) => {
  await treinoAberto(page, { comFrontal: true });
  const abrir = page.getByRole("button", { name: `Como fazer: ${NOME}`, exact: true });
  const ficha = page.getByRole("dialog", { name: NOME, exact: true });
  const quantidade = ficha.getByRole("textbox", { name: "Séries", exact: true });
  await abrir.click();
  await expect(quantidade).toHaveValue("3");
  await quantidade.press("ControlOrMeta+a");
  await quantidade.pressSequentially("1,5");
  await expect(quantidade).toHaveValue("1,5");
  await ficha.getByRole("button", { name: "Fechar", exact: true }).last().click();
  await expect(ficha).toBeHidden();
  await abrir.click();
  await expect(quantidade).toHaveValue("3");
  await page.keyboard.press("Escape");
  await abrirVisaoGeral(page);
  for (const numero of [1, 2, 3]) {
    await expect(geral(page).getByRole("group", { name: `Série ${numero} — ${NOME}`, exact: true })).toBeVisible();
  }
});

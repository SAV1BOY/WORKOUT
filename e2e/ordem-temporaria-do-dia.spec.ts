import { expect, test, type Page } from "@playwright/test";
import { chaveDaOrdemDoDia } from "../lib/ordem";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, entrarNoApp, esperarAbaTreino, fixarData, lerDoMock,
  ocuparArmazenamentoDaSessao, resetarMock, usuarioComPerfil,
} from "./fixtures";

async function editar(page: Page, ...acoes: string[]) {
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const editor = page.getByRole("region", { name: "Reordenar os exercícios" });
  for (const acao of acoes) await editor.getByRole("button", { name: acao, exact: true }).click();
  await editor.getByRole("button", { name: "Pronto", exact: true }).click();
}

const primeiro = (page: Page) => page.getByRole("list", { name: "Exercícios de hoje" }).getByRole("listitem").first();
const rascunho = (page: Page, chave: string) => page.evaluate(chave => localStorage.getItem(chave), chave);

for (const [cenario, outraEdita] of [
  ["consome o rascunho anterior ao recuperar o armazenamento", false],
  ["preserva o novo rascunho feito em outra aba durante a criação", true],
] as const) {
  test(`restaurar a ordem temporariamente ${cenario}`, async ({ page, context }) => {
    test.slow();
    await resetarMock();
    await fixarData(page);
    const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
    await entrarNoApp(page);
    const chave = chaveDaOrdemDoDia(conta.userId, "2026-09-14", "A1");
    await editar(page, "Subir Supino reto com barra");

    const outra = await context.newPage();
    await fixarData(outra);
    await outra.goto("/");
    await esperarAbaTreino(outra);
    await expect(primeiro(outra)).toContainText("1. Supino reto com barra");
    const anterior = await rascunho(outra, chave);
    expect(anterior).not.toBeNull();

    // Só a tentativa de restaurar falha. Ao começar, o aparelho pode consumir o rascunho.
    await page.evaluate(chaveBloqueada => {
      const remover = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (chave) {
        if (chave === chaveBloqueada) {
          Storage.prototype.removeItem = remover;
          throw new DOMException("Armazenamento bloqueado", "SecurityError");
        }
        return remover.call(this, chave);
      };
    }, chave);
    await editar(page, "Voltar à ordem do programa");
    await expect(page.getByText("O aparelho não conseguiu guardar a ordem. Ela vale enquanto esta tela estiver aberta.")).toBeVisible();
    await expect(primeiro(page)).toContainText("1. Agachamento livre");
    expect(await rascunho(outra, chave)).toBe(anterior);

    let rascunhoEsperado: string | null = null;
    const liberar = await ocuparArmazenamentoDaSessao(outra, "ordem-temporaria");
    try {
      await page.getByRole("button", { name: "Começar treino", exact: true }).first().click();
      if (outraEdita) {
        await editar(outra, "Subir Remada curvada pronada", "Subir Remada curvada pronada");
        await expect(primeiro(outra)).toContainText("1. Remada curvada pronada");
        rascunhoEsperado = await rascunho(outra, chave);
        expect(rascunhoEsperado).not.toBe(anterior);
        expect(rascunhoEsperado).not.toBeNull();
      }
    } finally {
      await liberar();
    }
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
    await abrirVisaoGeral(page);
    const visao = page.getByRole("dialog", { name: "Visão geral do treino" });
    await expect(visao.getByRole("heading", { level: 2 }).first()).toHaveText("1. Agachamento livre");
    const id = new URL(page.url()).pathname.split("/").at(-1);
    await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{ id, workout_id: "A1" }]);
    expect(await rascunho(outra, chave)).toBe(rascunhoEsperado);
  });
}

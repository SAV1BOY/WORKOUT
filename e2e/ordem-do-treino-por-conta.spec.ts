import { expect, test, type Page } from "@playwright/test";
import { acharExercicio, programa } from "../lib/dados";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, atualizarNoMock, comecarOTreinoDoDia, definirCota, entrarNoApp, esperarAbaTreino,
  fixarData, HOJE_FIXO, irNaAba, lerDoMock, naFila, resetarMock, sessaoNoMock, type SessaoMock,
} from "./fixtures";

async function criarAtleta(email: string) {
  const conta = await sessaoNoMock(email);
  await atualizarNoMock(conta, "profiles", `user_id=eq.${conta.userId}`, {
    nome: "Atleta", altura_cm: 175, data_inicio: "2026-09-14", fase_atual: "fase1", fase_desde: "2026-09-14",
    prefs: { guia_visto: true, preparacao_s: 0 },
  });
  return conta;
}

async function sair(page: Page) {
  await expect.poll(() => naFila(page)).toBe(0);
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function iniciarA1(page: Page, conta: SessaoMock, primeiro: string, segundo: string) {
  await comecarOTreinoDoDia(page);
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await abrirVisaoGeral(page);
  const blocos = page.getByRole("dialog", { name: "Visão geral do treino" }).getByRole("heading", { level: 2 });
  await expect(blocos.nth(0)).toHaveText(`1. ${primeiro}`);
  await expect(blocos.nth(1)).toHaveText(`2. ${segundo}`);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{
    id, user_id: conta.userId, workout_id: "A1", status: "em_andamento",
  }]);
  const [sessao] = await lerDoMock<LinhaSessao>(conta, "sessions");
  const itens = sessao!.plano?.itens ?? programa.treinos.A1.exercicios;
  expect(itens.slice(0, 2).map(item => acharExercicio(item.exercicio_id).nome)).toEqual([primeiro, segundo]);
  return id;
}

test("começar o A1 em outra conta no mesmo aparelho preserva a ordem de cada pessoa", async ({ page }) => {
  test.slow(); // O mesmo navegador entra três vezes e abre dois treinos.
  await resetarMock();
  await definirCota(2);
  await fixarData(page, HOJE_FIXO);
  const emailA = "ordem-a@example.test";
  const emailB = "ordem-b@example.test";
  const a = await criarAtleta(emailA);
  const b = await criarAtleta(emailB);
  const agachamento = "Agachamento livre";
  const supino = "Supino reto com barra";
  const primeiro = page.getByRole("list", { name: "Exercícios de hoje" })
    .getByRole("listitem").first().getByRole("button", { name: /^Ficha:/ });

  await entrarNoApp(page, emailA);
  await expect(primeiro).toHaveAccessibleName(`Ficha: ${agachamento}`);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const editor = page.getByRole("region", { name: "Reordenar os exercícios" });
  await editor.getByRole("button", { name: "Descer Agachamento livre", exact: true }).click();
  await editor.getByRole("button", { name: "Pronto", exact: true }).click();
  await page.reload();
  await expect(primeiro).toHaveAccessibleName(`Ficha: ${supino}`);
  await sair(page);

  await entrarNoApp(page, emailB);
  await expect(primeiro).toHaveAccessibleName(`Ficha: ${agachamento}`);
  const idB = await iniciarA1(page, b, agachamento, supino);
  expect(await lerDoMock(a, "sessions")).toEqual([]);
  await page.getByRole("link", { name: "Continuar depois", exact: true }).click();
  await esperarAbaTreino(page);
  await sair(page);

  await entrarNoApp(page, emailA);
  await expect(primeiro).toHaveAccessibleName(`Ficha: ${supino}`);
  const idA = await iniciarA1(page, a, supino, agachamento);
  expect(idA).not.toBe(idB);
  expect((await lerDoMock<LinhaSessao>(b, "sessions")).map(sessao => sessao.id)).toEqual([idB]);
});

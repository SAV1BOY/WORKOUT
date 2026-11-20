import { expect, test, type Locator, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, comecarNoPlayer, entrarNoApp, esperarAbaTreino, esperarServiceWorker,
  fixarData, lerDoMock, marcarSerieNaVisaoGeral, naFila, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { abrirCatalogo, catalogo, geral, series } from "./treino-livre-ativo";

const FAIXA = "Elástico (Super Band)";
const REMADA = "Remada com elástico";
const FLEXAO = "Flexão de braço";
const SUPINO = "Supino reto com halteres";
const folha = (p: Page) => p.getByRole("dialog", { name: "Crie o seu próprio", exact: true });
const busca = (p: Page) => folha(p).getByRole("searchbox", { name: "Buscar exercício pelo nome" });
const opcoes = (p: Page) => folha(p).getByRole("list", { name: "Catálogo" }).locator("button[aria-pressed]");
const opcao = (p: Page, nome: string) => opcoes(p).filter({ has: p.getByText(nome, { exact: true }) });

async function preparar(page: Page) {
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await entrarNoApp(page);
  return conta;
}

async function abrirPersonalizado(page: Page) {
  await page.getByRole("button", { name: /Personalizar treino/ }).click();
  await expect(folha(page)).toBeVisible();
}

async function abrirMaterial(dialogo: Locator, titulo = "Equipamentos disponíveis") {
  const resumo = dialogo.locator("summary").filter({ hasText: titulo });
  await expect(resumo).toBeVisible();
  await resumo.click();
  const grupo = dialogo.getByRole("group", { name: "Equipamento de hoje", exact: true });
  await expect(grupo).toBeVisible();
  return grupo;
}

async function selecionarKit(grupo: Locator) {
  await grupo.getByRole("button", { name: "Só peso do corpo", exact: true }).click();
  for (const nome of ["Tatame", FAIXA]) await grupo.getByRole("checkbox", { name: nome, exact: true }).check();
}

async function conferirMaterial(grupo: Locator, nomes: string[]) {
  await expect(grupo.getByRole("checkbox", { checked: true })).toHaveCount(nomes.length);
  for (const nome of nomes) await expect(grupo.getByRole("checkbox", { name: nome, exact: true })).toBeChecked();
}

async function iniciar(page: Page, quantidade: 1 | 2) {
  const nome = quantidade === 1 ? "Começar com 1 exercício" : "Começar com 2 exercícios";
  await folha(page).getByRole("button", { name: nome, exact: true }).click();
  await expect(page).toHaveURL(/\/treinar\/[\da-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

test("só peso do corpo e os kits completos filtram o catálogo sem perder um exercício escolhido", async ({ page }) => {
  const conta = await preparar(page);
  await abrirPersonalizado(page);
  await expect(opcao(page, SUPINO)).toBeVisible();
  const total = await opcoes(page).count();
  await opcao(page, SUPINO).click();
  const material = await abrirMaterial(folha(page));
  await material.getByRole("button", { name: "Só peso do corpo", exact: true }).click();
  await expect(opcoes(page)).toHaveCount(9);
  await expect(opcao(page, FLEXAO)).toHaveAccessibleName(/· Peso do corpo$/);
  await expect(opcao(page, "Prancha")).toBeVisible();
  await expect(opcao(page, REMADA)).toHaveCount(0);
  await expect(opcao(page, SUPINO)).toHaveCount(0);
  const escolhido = folha(page).getByRole("list", { name: "Escolhidos" }).getByRole("button", { name: `Tirar ${SUPINO}`, exact: true });
  await expect(escolhido).toBeVisible();
  await material.getByRole("checkbox", { name: "Tatame", exact: true }).check();
  await material.getByRole("checkbox", { name: FAIXA, exact: true }).check();
  await expect(opcoes(page)).toHaveCount(24);
  await expect(opcao(page, FLEXAO)).toHaveAccessibleName(/· Peso do corpo ou Tatame$/);
  await busca(page).fill("remada");
  await expect(opcoes(page)).toHaveCount(1);
  await expect(opcao(page, REMADA)).toBeVisible();

  // Só halteres e banco ainda deixam a montagem do supino sem anilhas.
  await busca(page).fill("supino reto");
  await expect(opcoes(page)).toHaveCount(0);
  await folha(page).getByRole("button", { name: "Limpar busca", exact: true }).click();
  await expect(opcoes(page)).toHaveCount(24);
  await conferirMaterial(material, ["Tatame", FAIXA]);
  await busca(page).fill("supino reto");
  await material.getByRole("checkbox", { name: "Halteres", exact: true }).check();
  await material.getByRole("checkbox", { name: "Banco", exact: true }).check();
  await expect(opcao(page, SUPINO)).toHaveCount(0);
  await material.getByRole("checkbox", { name: "Anilhas", exact: true }).check();
  await expect(opcao(page, SUPINO)).toHaveAttribute("aria-pressed", "true");
  await material.getByRole("button", { name: "Usar todo o equipamento", exact: true }).click();
  await busca(page).fill("");
  await expect(opcoes(page)).toHaveCount(total);

  await material.getByRole("button", { name: "Só peso do corpo", exact: true }).click();
  const id = await iniciar(page, 1);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{
    id, user_id: conta.userId, plano: { itens: [{ exercicio_id: "supino-reto-com-halteres" }], equipamento_disponivel: [] },
  }]);
});

test("começar sem rede leva tatame e elástico à sessão reordenada e sincroniza a primeira série uma vez", async ({ page, context }) => {
  test.slow(); // Criação, registro e recarga da sessão ocorrem com a rede do navegador e do worker desligada.
  const conta = await preparar(page);
  await esperarServiceWorker(page);
  await abrirPersonalizado(page);
  await selecionarKit(await abrirMaterial(folha(page)));
  await opcao(page, FLEXAO).click();
  await opcao(page, REMADA).click();
  await folha(page).getByRole("button", { name: "Reordenar escolhidos", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Reordenar escolhidos", exact: true });
  await editor.getByRole("button", { name: `Subir ${REMADA}`, exact: true }).click();
  await editor.getByRole("button", { name: "Pronto", exact: true }).click();
  await expect(folha(page).getByRole("button", { name: "Começar com 2 exercícios", exact: true })).toBeEnabled();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const id = await iniciar(page, 2);
  await comecarNoPlayer(page);
  const primeira = page.getByRole("region", { name: REMADA, exact: true });
  const reps = primeira.getByRole("textbox", { name: "repetições", exact: true });
  await reps.fill("11");
  await reps.press("Enter");
  await primeira.getByRole("button", { name: "Concluir série", exact: true }).click();
  await expect(page.getByRole("region", { name: "Descanso", exact: true })).toBeVisible();
  await expect.poll(() => naFila(page)).toBeGreaterThan(0);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText([`1. ${REMADA}`, `2. ${FLEXAO}`]);
  await expect(geral(page).getByRole("checkbox", { checked: true })).toHaveCount(1);
  await abrirCatalogo(page).click();
  await conferirMaterial(await abrirMaterial(catalogo(page)), ["Tatame", FAIXA]);
  await catalogo(page).getByRole("searchbox", { name: "Buscar exercício pelo nome" }).fill("remada baixa na polia");
  await expect(catalogo(page).getByRole("button", { name: "Adicionar Remada baixa na polia", exact: true })).toHaveCount(0);

  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  const [sessao] = await lerDoMock<LinhaSessao>(conta, "sessions");
  expect(sessao).toMatchObject({ id, user_id: conta.userId, workout_id: "livre",
    plano: { itens: [{ exercicio_id: "remada-com-elastico" }, { exercicio_id: "flexao-de-braco" }] } });
  expect(sessao?.plano?.equipamento_disponivel?.slice().sort()).toEqual(["super-band", "tatame"]);
  expect(await series(conta, id)).toMatchObject([{
    session_id: id, user_id: conta.userId, exercise_id: "remada-com-elastico", ordem_ex: 1, set_index: 1, reps: 11, concluida: true,
  }]);
});

test("a escolha do treino personalizado respeita o rascunho de A1 e a próxima sessão volta ao inventário completo", async ({ page }) => {
  test.slow(); // Conclui um treino e inicia outro no mesmo dia para conferir a separação.
  const conta = await preparar(page);
  const ajustesDoDia = async () => {
    await page.getByRole("button", { name: "Ajustar", exact: true }).click();
    return abrirMaterial(page.getByRole("dialog", { name: "Ajustar", exact: true }), "Equipamento de hoje");
  };
  const a1 = await ajustesDoDia();
  await a1.getByRole("button", { name: "Só peso do corpo", exact: true }).click();
  await a1.getByRole("checkbox", { name: "Halteres", exact: true }).check();
  await page.keyboard.press("Escape");
  await abrirPersonalizado(page);
  const inventario = await abrirMaterial(folha(page));
  const total = await inventario.getByRole("checkbox").count();
  await expect(inventario.getByRole("checkbox", { checked: true })).toHaveCount(total);
  await selecionarKit(inventario);
  await opcao(page, FLEXAO).click();
  const primeira = await iniciar(page, 1);
  await abrirVisaoGeral(page);
  await marcarSerieNaVisaoGeral(
    geral(page).getByRole("checkbox", { name: `Série 1 concluída — ${FLEXAO}`, exact: true }),
  );
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog", { name: "Treino concluído", exact: true }).getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  await conferirMaterial(await ajustesDoDia(), ["Halteres"]);
  await page.keyboard.press("Escape");

  await abrirPersonalizado(page);
  const novo = await abrirMaterial(folha(page));
  await expect(novo.getByRole("checkbox", { checked: true })).toHaveCount(total);
  await opcao(page, SUPINO).click();
  const segunda = await iniciar(page, 1);
  expect(segunda).not.toBe(primeira);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: "Ajustar", exact: true }).click();
  const daSessao = await abrirMaterial(page.getByRole("dialog", { name: "Ajustar", exact: true }), "Equipamento de hoje");
  await expect(daSessao.getByRole("checkbox", { checked: true })).toHaveCount(total);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions")).toHaveLength(2);
  const [encerrada] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${primeira}`);
  expect(encerrada?.status).toBe("concluida");
  expect(encerrada?.plano?.equipamento_disponivel?.slice().sort()).toEqual(["super-band", "tatame"]);
});

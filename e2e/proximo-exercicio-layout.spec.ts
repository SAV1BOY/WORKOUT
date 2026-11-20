import { expect, test } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  abrirVisaoGeral, comecarNoPlayer, comecarOTreinoDoDia, definirCota, entrarNoApp,
  fixarData, HOJE_FIXO, inserirNoMock, lerDoMock, ocuparArmazenamentoDaSessao, resetarMock, sessaoNoMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";

const exercicios = ["rosca-com-elastico", "agachamento-livre", "desenvolvimento-com-halteres"];
const nome = "Desenvolvimento com halteres";

async function criarTreinoLivre(conta: SessaoMock) {
  const id = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id, workout_id: "livre", fase: "fase1", data: "2026-09-14", iniciada_em: HOJE_FIXO,
    status: "em_andamento", plano: planoDaSessao(itensDeIds(exercicios)),
  }]);
  return id;
}

test("o teclado escolhe o próximo exercício sem sair da Visão geral em 320px a 200%", async ({ page }) => {
  await resetarMock();
  await fixarData(page);
  await page.setViewportSize({ width: 320, height: 740 });
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  const id = await criarTreinoLivre(conta);
  await entrarNoApp(page);
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const abrirVisao = page.getByRole("button", { name: "Visão geral do treino", exact: true });
  await abrirVisao.press("Enter");
  const visao = page.getByRole("dialog", { name: "Visão geral do treino" });
  const controle = visao.getByRole("button", { name: "Próximo exercício", exact: true });
  await visao.getByRole("button", { name: "Adicionar exercício", exact: true }).press("Tab");
  await expect(controle).toBeFocused();
  await controle.press("Space");
  const candidato = visao.getByRole("button", { name: `Fazer ${nome} a seguir`, exact: true });
  await expect(visao.getByText("Escolha o exercício que vem depois do atual.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await controle.press("Tab");
  await expect(candidato).toBeFocused();
  for (const alvo of [candidato, controle]) {
    const caixa = (await alvo.boundingBox())!;
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeGreaterThanOrEqual(44);
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(320);
    expect(await alvo.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  }
  // O rodapé fixo cobre parte da viewport quando a fonte está ampliada.
  expect(await candidato.evaluate(el => {
    const caixa = el.getBoundingClientRect();
    return [caixa.top + 2, caixa.bottom - 2].every(y => el.contains(document.elementFromPoint(caixa.left + caixa.width / 2, y)));
  })).toBe(true);
  await candidato.press("Escape");
  await expect(visao).toBeVisible();
  await expect(controle).toBeFocused();
  await expect(controle).toHaveAttribute("aria-expanded", "false");
  await controle.press("Enter");
  await controle.press("Tab");
  await expect(candidato).toBeFocused();
  const liberar = await ocuparArmazenamentoDaSessao(page, id);
  try {
    await candidato.press("Enter");
    await expect(visao.getByText("Guardando a sequência…")).toBeVisible();
    await expect(candidato).toBeFocused();
    await expect(controle).toHaveAttribute("aria-expanded", "true");
    await expect(visao.getByRole("heading", { name: "2. Agachamento livre", exact: true })).toBeVisible();
  } finally {
    await liberar();
  }
  await expect(visao.getByText(`Próximo exercício: ${nome}.`, { exact: true })).toBeVisible();
  await expect(controle).toBeFocused();
  await expect(controle).toHaveAttribute("aria-expanded", "false");
  await expect(visao.getByRole("heading", { name: "2. " + nome, exact: true })).toBeVisible();
  await controle.press("Escape");
  await expect(abrirVisao).toBeFocused();
  const atual = page.getByRole("heading", { name: "Rosca com elástico", exact: true });
  await expect(atual).toBeVisible();
  const titulo = (await atual.boundingBox())!;
  const acoes = atual.locator("..").getByRole("button");
  await expect(acoes).toHaveCount(3);
  for (const acao of await acoes.all()) {
    const caixa = (await acao.boundingBox())!;
    expect(caixa.y).toBeGreaterThanOrEqual(titulo.y + titulo.height - 1);
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(320);
  }
});

test("a ordem do treino livre só é editável para a própria sessão livre ativa", async ({ page }) => {
  await resetarMock();
  await definirCota(3);
  await fixarData(page);
  await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  const outra = await sessaoNoMock("proximo-movimento@example.test");
  const id = await criarTreinoLivre(outra);
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await abrirVisaoGeral(page);
  const visao = page.getByRole("dialog", { name: "Visão geral do treino" });
  await expect(visao.getByRole("heading", { name: "1. Agachamento livre" })).toBeVisible();
  await expect(visao.getByRole("button", { name: "Próximo exercício", exact: true })).toHaveCount(0);
  await page.goto(`/treinar/${id}`);
  await expect(page.getByText(/Não achei este treino|Não consegui carregar este treino/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Próximo exercício", exact: true })).toHaveCount(0);
  const [sessao] = await lerDoMock(outra, "sessions", `id=eq.${id}`);
  expect(sessao?.plano).toEqual(planoDaSessao(itensDeIds(exercicios)));
});

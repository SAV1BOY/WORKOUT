import { expect, type Page } from "@playwright/test";
import type { LinhaSerie, LinhaSessao, PlanoDaSessao, Prefs } from "../lib/types";
import { comecarNoPlayer, entrarNoApp, HOJE_FIXO, inserirNoMock, lerDoMock, usuarioComPerfil, type SessaoMock } from "./fixtures";

const ROSCA = "rosca-com-elastico";
const REMADA = "remada-com-elastico";
export const FRONTAL = "agachamento-frontal";
export const NOME = "Agachamento frontal";

export const geral = (page: Page) => page.getByRole("dialog", { name: "Visão geral do treino" });
export const abrirCatalogo = (page: Page) => geral(page).getByRole("button", { name: "Adicionar exercício", exact: true });
export const catalogo = (page: Page) => page.getByRole("dialog", { name: "Adicionar exercício", exact: true });
export const busca = (page: Page) => catalogo(page).getByRole("searchbox", { name: "Buscar exercício pelo nome" });
export const timer = (page: Page) => page.getByRole("region", { name: "Descanso", exact: true }).getByRole("timer");

export async function treinoAberto(page: Page, opcoes: {
  prepararCargaOffline?: boolean; prefs?: Prefs; comFrontal?: boolean; apenasUmaSerie?: boolean;
} = {}) {
  const primeiro = opcoes.comFrontal ? FRONTAL : ROSCA;
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false, ...opcoes.prefs } });
  const id = crypto.randomUUID();
  const plano: PlanoDaSessao = {
    titulo: "Treino livre de segunda", colecao: null,
    equipamento_disponivel: ["super-band", "tatame", "anilhas", "barra-macica", "cavalete"],
    descansos_por_exercicio: { [primeiro]: 95 },
    itens: (opcoes.apenasUmaSerie ? [primeiro] : [primeiro, REMADA]).map(exercicio_id => ({
      exercicio_id, tipo: "reps", series: opcoes.apenasUmaSerie ? 1 : 3, min: 8, max: 12, unilateral: false, descanso_s: 60, descanso_texto: "60 s",
    })),
  };
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, workout_id: "livre", fase: "fase1", data: "2026-09-14",
    iniciada_em: new Date(HOJE_FIXO).toISOString(), status: "em_andamento", plano,
  }]);
  await inserirNoMock(conta, "exercise_state", [{
    user_id: conta.userId, exercise_id: FRONTAL, carga_atual_kg: 31.5, reps_alvo: 7, falhas_seguidas: 0,
    incremento_reduzido: false, exigir_rep_extra: false, semana_leve: false, sessoes_graca: 0, desativado: false,
  }]);
  await entrarNoApp(page);
  if (opcoes.prepararCargaOffline) {
    await page.goto(`/exercicios/${FRONTAL}`);
    await expect(page.getByText(/31,5 kg/).first()).toBeVisible();
  }
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  await expect(page.getByRole("heading", { name: opcoes.comFrontal ? NOME : "Rosca com elástico", exact: true })).toBeVisible();
  return { conta, id, plano };
}

export function series(conta: SessaoMock, id: string) {
  return lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}&order=ordem_ex.asc`);
}

export async function planoSalvo(conta: SessaoMock, id: string) {
  const [sessao] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
  return sessao?.plano;
}

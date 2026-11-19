import { expect, test, type Locator, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  avancarNoPlayerAte, comecarNoPlayer, entrarNoApp, fixarData, HOJE_FIXO,
  inserirNoMock, lerDoMock, resetarMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";

const SUPINO = "supino-reto-com-barra";
const FLEXAO = "flexao-de-braco";
const NOME = "Supino reto com barra";
const ONTEM = "2026-09-13";

async function guardarTreinoAnterior(conta: SessaoMock, titulo: string, hora: string, reps: number, kg: number) {
  const id = crypto.randomUUID();
  const instante = `${ONTEM}T${hora}:00:00Z`;
  await inserirNoMock(conta, "sessions", [{
    id, data: ONTEM, workout_id: "livre", fase: "fase1", status: "concluida",
    iniciada_em: instante, concluida_em: `${ONTEM}T${hora}:30:00Z`, duracao_s: 1800,
    plano: planoDaSessao(itensDeIds([SUPINO, FLEXAO]), { titulo }),
  }]);
  const serie = { session_id: id, tipo: "trabalho", set_index: 1, concluida: true, registrada_em: instante };
  await inserirNoMock(conta, "session_sets", [
    { ...serie, id: crypto.randomUUID(), exercise_id: SUPINO, ordem_ex: 1, reps: 8, carga_kg: kg },
    { ...serie, id: crypto.randomUUID(), exercise_id: FLEXAO, ordem_ex: 2, reps },
  ]);
}

async function consultarTreino(
  page: Page, tela: Locator, titulo: string, repsDaFlexao: number, duranteConsulta?: () => Promise<void>,
) {
  const abrirFicha = tela.getByRole("button", { name: `Como fazer: ${NOME}`, exact: true });
  await abrirFicha.press("Enter");
  const ficha = page.getByRole("dialog", { name: NOME, exact: true });
  const linha = ficha.getByRole("button", { name: `Ver séries de ${titulo} de 13/09/2026`, exact: true });
  await expect(linha).toBeVisible();
  await linha.press("Enter");
  const detalhe = page.getByRole("dialog", { name: "Séries do treino", exact: true });
  await expect(detalhe).toHaveAccessibleDescription(`${titulo} · 13/09/2026`);
  // A flexão só aparece no treino anterior, e seus valores distinguem os UUIDs do mesmo dia.
  const flexao = detalhe.getByRole("region", { name: "Flexão de braço", exact: true });
  await expect(flexao.getByRole("listitem")).toHaveCount(1);
  await expect(flexao.getByText(`${repsDaFlexao} repetições`, { exact: true })).toBeVisible();
  await duranteConsulta?.();
  await page.keyboard.press("Escape");
  await expect(detalhe).toBeHidden();
  await expect(linha).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(ficha).toBeHidden();
  await expect(abrirFicha).toBeFocused();
}

test("consulta os treinos de origem na ficha da série e do descanso sem perder a edição nem o prazo", async ({ page }) => {
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { guia_visto: true, preparacao_s: 0, descanso_padrao_s: 90, avancar_sozinho: false } });
  await guardarTreinoAnterior(conta, "Supino no almoço", "12", 11, 22.5);
  await guardarTreinoAnterior(conta, "Treino da noite", "18", 15, 40);
  const atual = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id: atual, data: "2026-09-14", workout_id: "livre", fase: "fase1", status: "em_andamento",
    iniciada_em: HOJE_FIXO, plano: planoDaSessao(itensDeIds([SUPINO])),
  }]);
  await entrarNoApp(page);
  await page.goto(`/treinar/${atual}`);
  await comecarNoPlayer(page);
  const tela = page.getByRole("region", { name: NOME, exact: true });
  const etapa = tela.getByText("Série 1 de 3 · exercício 1 de 1", { exact: true });
  await avancarNoPlayerAte(page, etapa);
  const reps = tela.getByRole("textbox", { name: "repetições", exact: true });
  const carga = tela.getByRole("textbox", { name: "carga na barra", exact: true });
  await reps.fill("9");
  await reps.press("Enter");
  await carga.fill("25,5");
  await carga.press("Enter");

  await consultarTreino(page, tela, "Supino no almoço", 11);
  await expect(etapa).toBeVisible();
  await expect(reps).toHaveValue("9");
  await expect(carga).toHaveValue("25,5");
  await tela.getByRole("button", { name: "Concluir série", exact: true }).click();
  const descanso = page.getByRole("region", { name: "Descanso", exact: true });
  const relogio = descanso.getByRole("timer", { name: "Descanso", exact: true });
  await expect(relogio).toHaveText("1:30");
  await consultarTreino(page, descanso, "Treino da noite", 15, () =>
    fixarData(page, new Date(Date.parse(HOJE_FIXO) + 12_000).toISOString()),
  );
  await expect(relogio).toHaveText("1:18");
  await expect(page).toHaveURL(`/treinar/${atual}`);
  await expect.poll(() => lerDoMock(conta, "session_sets", `session_id=eq.${atual}`)).toMatchObject([
    { exercise_id: SUPINO, tipo: "trabalho", set_index: 1, concluida: true, reps: 9, carga_kg: 25.5 },
  ]);
});

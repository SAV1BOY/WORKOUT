import { expect, test } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import { entrarNoApp, fixarData, inserirNoMock, resetarMock, usuarioComPerfil } from "./fixtures";

const titulo = "Treino de força de pernas, ombros e costas no terraço com o elástico";
const movimento = "supino-reto-com-barra";
const data = "2026-09-14";

for (const tema of ["light", "dark"] as const) {
  test(`dois treinos com mesmo nome e hora continuam legíveis pelo teclado a 320 px e 200%, tema ${tema}`, async ({ page }) => {
    await resetarMock();
    const conta = await usuarioComPerfil();
    const sessoes = ["Treino antes do café.", "Pausa maior no supino."].map(nota => ({
      id: crypto.randomUUID(), data, workout_id: "livre", fase: "fase1", status: "concluida", nota_geral: nota,
      iniciada_em: `${data}T08:00:00-03:00`, concluida_em: `${data}T08:30:00-03:00`, duracao_s: 1800,
      plano: planoDaSessao(itensDeIds([movimento]), { titulo }),
    }));
    await inserirNoMock(conta, "sessions", sessoes);
    await inserirNoMock(conta, "session_sets", sessoes.map((sessao, i) => ({
      id: crypto.randomUUID(), session_id: sessao.id, exercise_id: movimento, ordem_ex: 1, set_index: 1,
      tipo: "trabalho", reps: 8 + i, carga_kg: 20 + i * 5, concluida: true, registrada_em: sessao.concluida_em,
    })));
    await fixarData(page, "2026-09-16T10:00:00-03:00");
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await entrarNoApp(page);
    await page.getByRole("link", { name: "Abrir o calendário da semana", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${tema}\\b`));
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const dia = page.getByRole("button", { name: /^segunda 14\/09:/ });
    await dia.focus();
    await dia.press("Enter");
    const registros = page.getByRole("list", { name: "Atividades registradas" });
    const primeiro = registros.getByRole("button", { name: /Registro 1 de 2$/ });
    const segundo = registros.getByRole("button", { name: /Registro 2 de 2$/ });
    await expect(primeiro).toHaveAccessibleName(new RegExp(titulo));
    await expect(segundo).toHaveAccessibleName(new RegExp(titulo));
    await primeiro.focus();
    await primeiro.press("Tab");
    await expect(segundo).toBeFocused();
    await segundo.press("Enter");
    const folha = page.getByRole("dialog", { name: "Séries do treino", exact: true });
    await expect(folha.getByRole("heading", { name: "Séries do treino" })).toBeFocused();
    const area = folha.getByRole("region", { name: "Séries registradas" });
    const linha = area.getByRole("listitem");
    await expect(area.getByRole("heading", { name: "Nota do treino" })).toBeVisible();
    await expect(linha).toContainText("kg na barra");
    await page.keyboard.press("Tab");
    await expect(area).toBeFocused();
    await area.press("End");
    // A série inteira deve caber na área de leitura, inclusive com a descrição longa acima.
    await expect.poll(async () => {
      const regiao = await area.boundingBox();
      const serie = await linha.boundingBox();
      return !!regiao && !!serie && serie.y >= regiao.y - 1 && serie.y + serie.height <= regiao.y + regiao.height + 1;
    }).toBe(true);
    expect(await area.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(segundo).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dia).toBeFocused();
  });
}

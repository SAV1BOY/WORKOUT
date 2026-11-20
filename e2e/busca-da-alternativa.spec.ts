import { expect, test } from "@playwright/test";
import {
  entrarNoApp, fixarData, HOJE_FIXO, inserirNoMock, lerDoMock, naFila, requisicoesDoMock,
  resetarMock, usuarioComPerfil,
} from "./fixtures";

async function escritas() {
  return (await requisicoesDoMock()).filter(r =>
    r.caminho.startsWith("/rest/v1/") && r.metodo !== "GET" && r.metodo !== "HEAD",
  );
}

test("a busca no A1 respeita o equipamento, os movimentos ocupados e as trocas guardadas", async ({ page }) => {
  await resetarMock();
  await fixarData(page, HOJE_FIXO);
  const conta = await usuarioComPerfil();
  await inserirNoMock(conta, "trocas_do_programa", [
    { user_id: conta.userId, workout_id: "A1", exercicio_original_id: "desenvolvimento-com-halteres", substituto_id: "remada-alta" },
    { user_id: conta.userId, workout_id: "A1", exercicio_original_id: "rosca-direta-com-barra", substituto_id: "barra-fixa-supinada" },
  ]);
  const preferencias = await lerDoMock(conta, "trocas_do_programa");
  await entrarNoApp(page);
  const dia = page.getByRole("list", { name: "Exercícios de hoje" });
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  // A remada alta está livre hoje, mas pertence ao desenvolvimento nos próximos A1.
  await dia.getByRole("button", { name: "Substituir Remada alta", exact: true }).click();
  await folha.getByRole("button", { name: "Voltar para Desenvolvimento com halteres só neste treino" }).click();
  await dia.getByRole("button", { name: "Substituir Remada curvada pronada", exact: true }).click();

  const busca = folha.getByRole("searchbox", { name: "Buscar alternativa pelo nome" });
  await expect(busca).toBeVisible();
  const antes = await escritas();
  const opcoes = folha.getByRole("list", { name: "Exercícios alternativos" });
  const proximos = folha.getByRole("radio", { name: "Usar nos próximos A1" });
  await busca.fill("remada alta");
  await expect(opcoes.getByRole("button", { name: /^Remada alta / })).toBeVisible();
  await proximos.check();
  await expect(folha.getByRole("status")).toHaveText("Nenhuma alternativa com esse nome.");
  await busca.fill("barra fixa");
  await expect(opcoes.getByRole("button", { name: /^Barra fixa pronada / })).toBeVisible();
  await expect(opcoes.getByRole("button", { name: /^Barra fixa supinada / })).toHaveCount(0);

  await busca.fill("remada");
  const nomes = opcoes.getByRole("button", { name: /^Ver execução de / });
  await expect(nomes).toHaveCount(4);
  expect(await nomes.evaluateAll(botoes => botoes.map(botao => botao.getAttribute("aria-label")))).toEqual([
    "Ver execução de Remada baixa na polia", "Ver execução de Remada com elástico",
    "Ver execução de Remada curvada supinada", "Ver execução de Remada unilateral (serrote)",
  ]);
  const equipamento = folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" });
  await equipamento.click();
  const material = folha.getByRole("group", { name: "Equipamento de hoje" });
  await material.getByRole("button", { name: "Só peso do corpo" }).click();
  const band = material.getByRole("checkbox", { name: "Elástico (Super Band)", exact: true });
  await band.check();
  await equipamento.click();
  const filtro = folha.getByRole("button", { name: "Elástico", exact: true });
  await filtro.click();
  await expect(nomes).toHaveCount(1);
  const previa = opcoes.getByRole("button", { name: "Ver execução de Remada com elástico" });
  await previa.click();
  await busca.fill(" ELASTICO   remada ");
  await expect(previa).toHaveAttribute("aria-expanded", "true");
  await folha.getByRole("button", { name: "Limpar busca" }).click();
  await expect(busca).toBeFocused();
  await expect(busca).toHaveValue("");
  await expect(filtro).toHaveAttribute("aria-pressed", "true");
  await expect(proximos).toBeChecked();
  await equipamento.click();
  await expect(material.getByRole("checkbox", { checked: true })).toHaveCount(1);
  await expect(band).toBeChecked();
  await equipamento.click();
  expect(await naFila(page)).toBe(0);
  expect(await escritas()).toEqual(antes);
  expect(await lerDoMock(conta, "trocas_do_programa")).toEqual(preferencias);

  await opcoes.getByRole("button", { name: /^Remada com elástico / }).click();
  await expect(dia.getByRole("button", { name: "Substituir Remada com elástico", exact: true })).toBeVisible();
  await expect.poll(() => lerDoMock(conta, "trocas_do_programa")).toEqual(expect.arrayContaining([
    ...preferencias, expect.objectContaining({
      user_id: conta.userId, workout_id: "A1", exercicio_original_id: "remada-curvada-pronada", substituto_id: "remada-com-elastico",
    }),
  ]));
  expect(await lerDoMock(conta, "trocas_do_programa")).toHaveLength(3);
  expect(await escritas()).toEqual([...antes, { metodo: "POST", caminho: "/rest/v1/trocas_do_programa" }]);
});

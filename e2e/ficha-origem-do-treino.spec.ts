import { expect, test, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  definirCota, entrarNoApp, fixarData, inserirNoMock, irNaAba, resetarMock,
  semRolagemHorizontal, sessaoNoMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";

const DIA = "2026-09-14";
const SUPINO = "supino-reto-com-barra";
const FLEXAO = "flexao-de-braco";
const FRONTAL = "agachamento-frontal";

async function semearTreino(conta: SessaoMock, titulo: string, hora: number, exercicios: string[], concluido = true) {
  const id = crypto.randomUUID();
  const inicio = `${DIA}T${hora}:00:00Z`;
  await inserirNoMock(conta, "sessions", [{
    id, data: DIA, status: concluido ? "concluida" : "em_andamento", workout_id: "livre", fase: "fase1",
    iniciada_em: inicio, concluida_em: concluido ? `${DIA}T${hora}:30:00Z` : null,
    plano: planoDaSessao(itensDeIds(exercicios), { titulo }),
  }]);
  return id;
}

function serie(sessao: string, movimento: string, ordem: number, hora: number, reps: number, kg: number | null, tipo = "trabalho") {
  return {
    id: crypto.randomUUID(), session_id: sessao, exercise_id: movimento, ordem_ex: ordem,
    set_index: 1, tipo, reps, carga_kg: kg, concluida: true, registrada_em: `${DIA}T${hora}:05:00Z`,
  };
}

async function procurarSupinoNoCatalogo(page: Page) {
  await fixarData(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await entrarNoApp(page);
  await irNaAba(page, "Explorar");
  await page.getByRole("link", { name: /^Ver os [0-9]+ exercícios$/ }).click();
  await page.getByLabel("Buscar exercício pelo nome").fill("supino reto");
  return page.getByRole("link", { name: /Supino reto com barra/ }).first();
}

test("Últimas sessões na ficha abre só o treino escolhido, mesmo com dois supinos na mesma data", async ({ page }) => {
  await resetarMock();
  await definirCota(2);
  const conta = await usuarioComPerfil();
  const outra = await sessaoNoMock("outra.pessoa@example.test");
  const almoco = await semearTreino(conta, "Supino no almoço", 12, [SUPINO, FLEXAO]);
  const noite = await semearTreino(conta, "Força à noite", 18, [SUPINO, FRONTAL]);
  const aberto = await semearTreino(conta, "Treino em andamento", 20, [SUPINO], false);
  const particular = await semearTreino(outra, "Treino de outra pessoa", 12, [SUPINO]);
  await inserirNoMock(conta, "session_sets", [
    serie(almoco, SUPINO, 1, 12, 6, 10, "aquecimento"), serie(almoco, SUPINO, 1, 12, 4, 40),
    serie(almoco, FLEXAO, 2, 12, 11, null), serie(noite, SUPINO, 1, 18, 8, 22.5),
    serie(noite, FRONTAL, 2, 18, 7, 31.5), serie(aberto, SUPINO, 1, 20, 3, 15),
  ]);
  await inserirNoMock(outra, "session_sets", [serie(particular, SUPINO, 1, 12, 2, 90)]);

  const link = await procurarSupinoNoCatalogo(page);

  const leituras: URLSearchParams[] = [];
  page.on("request", pedido => {
    const url = new URL(pedido.url());
    if (pedido.method() === "GET" && url.pathname === "/rest/v1/session_sets") leituras.push(url.searchParams);
  });
  await link.click();
  await expect(page.getByRole("heading", { name: "Supino reto com barra", level: 1 })).toBeVisible();
  await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
  const ultimas = page.locator('[data-slot="card"]').filter({ has: page.getByText("Últimas sessões", { exact: true }) });
  await expect(ultimas).toContainText("4 repetições · 40 kg na barra");
  await expect(ultimas).toContainText("8 repetições · 22,5 kg na barra");
  const semOrigemConcluida = ultimas.getByRole("listitem").filter({ hasText: "3 repetições · 15 kg na barra" });
  await expect(semOrigemConcluida).toBeVisible();
  await expect(semOrigemConcluida.getByRole("button").or(semOrigemConcluida.getByRole("link"))).toHaveCount(0);
  await expect(ultimas).not.toContainText("90 kg");
  await expect(ultimas).not.toContainText("Treino de outra pessoa");
  // A ficha e o resumo consultam o supino. Nenhuma leitura precisa buscar as séries de cada treino ainda.
  expect(leituras.length).toBeGreaterThan(0);
  for (const consulta of leituras) {
    expect(consulta.has("session_id")).toBe(false);
    expect([`eq.${SUPINO}`, `in.(${SUPINO})`]).toContain(consulta.get("exercise_id"));
  }
  await expect(ultimas.getByRole("button", { name: /^Ver séries de / })).toHaveCount(2);
  await semRolagemHorizontal(page);

  const folha = page.getByRole("dialog", { name: "Séries do treino", exact: true });
  for (const origem of [
    { id: almoco, titulo: "Supino no almoço", carga: "4 repetições · 40 kg na barra", extra: "Flexão de braço", valorExtra: "11 repetições", ausente: "Agachamento frontal" },
    { id: noite, titulo: "Força à noite", carga: "8 repetições · 22,5 kg na barra", extra: "Agachamento frontal", valorExtra: "7 repetições · 31,5 kg na barra", ausente: "Flexão de braço" },
  ]) {
    const gatilho = ultimas.getByRole("button", { name: `Ver séries de ${origem.titulo} de 14/09/2026`, exact: true });
    await expect(gatilho).toBeVisible();
    await expect(gatilho).toContainText(origem.titulo);
    expect(await gatilho.evaluate(botao => botao.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const inicio = leituras.length;
    await gatilho.focus();
    await page.keyboard.press("Enter");
    await expect(folha).toContainText(origem.titulo);
    const supino = folha.getByRole("region", { name: /Supino reto com barra/ });
    await expect(supino.getByRole("listitem")).toHaveCount(origem.id === almoco ? 2 : 1);
    const trabalho = supino.getByRole("listitem").filter({ has: page.getByText("Série 1", { exact: true }) });
    await expect(trabalho).toContainText(origem.carga);
    const aquecimento = supino.getByRole("listitem").filter({ hasText: "Aquecimento 1" });
    if (origem.id === almoco) await expect(aquecimento).toContainText("6 repetições · 10 kg na barra");
    else await expect(aquecimento).toHaveCount(0);
    await expect(folha.getByRole("region", { name: new RegExp(origem.extra) })).toContainText(origem.valorExtra);
    await expect(folha.getByRole("region", { name: new RegExp(origem.ausente) })).toHaveCount(0);
    await expect(folha).not.toContainText("90 kg");
    expect(leituras.slice(inicio).map(q => [q.get("user_id"), q.get("session_id")]))
      .toEqual([[`eq.${conta.userId}`, `eq.${origem.id}`]]);
    await semRolagemHorizontal(page);
    if (origem.id === almoco) await page.keyboard.press("Escape");
    else await folha.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(folha).toBeHidden();
    await expect(gatilho).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/exercicios/${SUPINO}$`));
  }
});

test("treinos de mesmo nome e data distinguem a origem pela hora local", async ({ page }) => {
  await resetarMock();
  const conta = await usuarioComPerfil();
  const titulo = "Treino no terraço";
  const primeiro = await semearTreino(conta, titulo, 15, [SUPINO]);
  const segundo = await semearTreino(conta, titulo, 21, [SUPINO]);
  const tituloRepetido = "Treino repetido";
  const empateA = await semearTreino(conta, tituloRepetido, 15, [SUPINO]);
  const empateB = await semearTreino(conta, tituloRepetido, 15, [SUPINO]);
  await inserirNoMock(conta, "session_sets", [
    serie(primeiro, SUPINO, 1, 15, 4, 40), serie(segundo, SUPINO, 1, 21, 8, 22.5),
    serie(empateA, SUPINO, 1, 15, 6, 32.5), serie(empateB, SUPINO, 1, 15, 9, 27.5),
  ]);
  const link = await procurarSupinoNoCatalogo(page);
  await link.click();
  const folha = page.getByRole("dialog", { name: "Séries do treino", exact: true });
  for (const [hora, valores] of [["12:00", "4 repetições · 40 kg na barra"], ["18:00", "8 repetições · 22,5 kg na barra"]] as const) {
    const linha = page.getByRole("button", { name: `Ver séries de ${titulo} de 14/09/2026 às ${hora}`, exact: true });
    await expect(linha).toContainText(hora);
    await linha.click();
    await expect(folha).toHaveAccessibleDescription(`${titulo} · 14/09/2026 às ${hora}`);
    await expect(folha.getByRole("listitem")).toHaveCount(1);
    await expect(folha.getByRole("listitem")).toContainText(valores);
    await page.keyboard.press("Escape");
    await expect(linha).toBeFocused();
  }

  const dataHora = `${tituloRepetido} de 14/09/2026 às 12:00`;
  for (const numero of [1, 2]) {
    const nome = `Ver séries de ${dataHora} · Registro ${numero} de 2`;
    await expect(page.getByRole("button", { name: nome, exact: true })).toContainText(`Registro ${numero} de 2`);
  }
  const linhaDeSeis = page.getByRole("listitem").filter({ hasText: "6 repetições · 32,5 kg na barra" });
  const abrirEmpate = linhaDeSeis.getByRole("button", { name: /^Ver séries de Treino repetido/ });
  const ordinal = (await abrirEmpate.innerText()).match(/Registro [12] de 2/)?.[0];
  expect(ordinal).toBeDefined();
  await abrirEmpate.click();
  await expect(folha).toHaveAccessibleDescription(`${tituloRepetido} · 14/09/2026 às 12:00 · ${ordinal}`);
  await expect(folha.getByRole("listitem")).toHaveCount(1);
  await expect(folha.getByRole("listitem")).toContainText("6 repetições · 32,5 kg na barra");
  await page.keyboard.press("Escape");
  await expect(abrirEmpate).toBeFocused();
});

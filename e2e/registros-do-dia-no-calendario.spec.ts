import { expect, test, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, esperarAbaTreino, esperarServiceWorker,
  fixarData, inserirNoMock, irNaAba, lerDoMock, naFila,
  resetarMock, semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const SUPINO = "supino-reto-com-barra";
const TITULO = "Treino da varanda";

function forca(data: string, hora: string, nota: string, titulo = TITULO) {
  return {
    id: crypto.randomUUID(), data, workout_id: "livre", fase: "fase1", status: "concluida",
    iniciada_em: `${data}T${hora}:00:00-03:00`, concluida_em: `${data}T${hora}:30:00-03:00`,
    duracao_s: 1800, nota_geral: nota, plano: planoDaSessao(itensDeIds([SUPINO]), { titulo }),
  };
}

function serie(sessao: ReturnType<typeof forca>, reps: number, carga: number) {
  return {
    id: crypto.randomUUID(), session_id: sessao.id, exercise_id: SUPINO, ordem_ex: 1, set_index: 1,
    tipo: "trabalho", reps, carga_kg: carga, concluida: true, registrada_em: sessao.concluida_em,
  };
}

const mes = (page: Page) => page.getByRole("region", { name: /^Mês de / });
const botaoDoDia = (page: Page, data: string) =>
  mes(page).getByRole("button", { name: new RegExp("^" + data + ":") });
const atividades = (page: Page) => page.getByRole("list", { name: "Atividades registradas", exact: true });

async function abrirCalendario(page: Page) {
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.getByRole("link", { name: "Abrir o calendário da semana", exact: true }).click();
  await expect(mes(page)).toHaveAccessibleName("Mês de setembro de 2026");
}

async function abrirMesAnterior(page: Page, nome: string) {
  await mes(page).getByRole("button", { name: "Mês anterior", exact: true }).click();
  await expect(mes(page)).toHaveAccessibleName(`Mês de ${nome} de 2026`);
}

async function abrirDiaFeito(page: Page, data: string) {
  const botao = botaoDoDia(page, data);
  await expect(botao).toHaveAccessibleName(new RegExp(data + ": feito"));
  await botao.focus();
  await botao.press("Enter");
  await expect(atividades(page)).toBeVisible();
  return botao;
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, "2026-09-14T12:00:00-03:00");
});

test("duas sessões anteriores às 60 mais recentes abrem suas próprias séries e notas, também após recarga sem rede", async ({ page, context }) => {
  test.setTimeout(75_000);
  const conta = await usuarioComPerfil({ data_inicio: "2026-06-01", fase_desde: "2026-06-01" });
  const manha = forca("2026-07-13", "08", "Supino antes do café.");
  const noite = forca("2026-07-13", "19", "Supino depois do trabalho.");
  const posteriores = Array.from({ length: 61 }, (_, i) => {
    const data = new Date(Date.UTC(2026, 6, 14 + i)).toISOString().slice(0, 10);
    return forca(data, "12", "", "Série do dia");
  });
  await inserirNoMock(conta, "sessions", [manha, noite, ...posteriores]);
  await inserirNoMock(conta, "session_sets", [serie(manha, 10, 20), serie(noite, 8, 31.5)]);
  await abrirCalendario(page);
  await abrirMesAnterior(page, "agosto");
  await abrirMesAnterior(page, "julho");
  const dia = await abrirDiaFeito(page, "13/07");
  const lista = atividades(page);
  await expect(lista.getByRole("listitem")).toHaveCount(2);
  const gatilho = (hora: string) => lista.getByRole("listitem").filter({ hasText: hora })
    .getByRole("button", { name: /Ver séries de Treino da varanda/ });
  const detalhe = page.getByRole("dialog", { name: "Séries do treino", exact: true });
  async function conferir(hora: string, nota: string, carga: string, outraNota: string) {
    const abrir = gatilho(hora);
    await abrir.focus();
    await abrir.press("Enter");
    await expect(detalhe.getByText(nota, { exact: true })).toBeVisible();
    await expect(detalhe).not.toContainText(outraNota);
    const levantadas = detalhe.getByRole("region", { name: "Supino reto com barra", exact: true }).getByRole("listitem");
    await expect(levantadas).toHaveCount(1);
    await expect(levantadas).toContainText(carga);
    await page.keyboard.press("Escape");
    await expect(abrir).toBeFocused();
  }
  await conferir("08:00", manha.nota_geral, "10 repetições · 20 kg na barra", noite.nota_geral);
  await conferir("19:00", noite.nota_geral, "8 repetições · 31,5 kg na barra", manha.nota_geral);
  await page.keyboard.press("Escape");
  await expect(dia).toBeFocused();

  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(mes(page)).toHaveAccessibleName("Mês de julho de 2026");
  await abrirDiaFeito(page, "13/07");
  await conferir("19:00", noite.nota_geral, "8 repetições · 31,5 kg na barra", manha.nota_geral);
  await expect.poll(() => naFila(page)).toBe(0);
});

test("um dia de agosto com força e corrida oferece cada registro e conserva o dia ao voltar", async ({ page }) => {
  const conta = await usuarioComPerfil({ data_inicio: "2026-06-01", fase_desde: "2026-06-01" });
  const dia = "2026-08-18";
  const treino = forca(dia, "08", "Movimento da manhã.");
  const corrida = { id: crypto.randomUUID(), tipo: "corrida", data: dia, concluida: true,
    duracao_min: 34, distancia_km: 3.6, notas: "Corrida com o parque vazio." };
  await inserirNoMock(conta, "sessions", [treino]);
  await inserirNoMock(conta, "session_sets", [serie(treino, 7, 27.5)]);
  await inserirNoMock(conta, "cardio_sessions", [corrida]);
  await abrirCalendario(page);
  await abrirMesAnterior(page, "agosto");
  const origem = await abrirDiaFeito(page, "18/08");
  const lista = atividades(page);
  await expect(lista.getByRole("listitem")).toHaveCount(2);
  const abrirForca = lista.getByRole("button", { name: /Ver séries de Treino da varanda/ });
  await abrirForca.click();
  const detalhe = page.getByRole("dialog", { name: "Séries do treino", exact: true });
  await expect(detalhe).toContainText("7 repetições · 27,5 kg na barra");
  await page.keyboard.press("Escape");
  await expect(abrirForca).toBeFocused();
  const url = "/cardio/corrida?sessao=" + corrida.id;
  const abrirCorrida = lista.getByRole("link");
  await expect(abrirCorrida).toHaveAttribute("href", url);
  await abrirCorrida.press("Enter");
  await expect(page).toHaveURL(u => u.pathname + u.search === url);
  await expect(page.getByText(corrida.notas, { exact: true })).toBeVisible();
  await expect(page.getByText("3,6 km", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(mes(page)).toHaveAccessibleName("Mês de agosto de 2026");
  await expect(page.getByRole("list", { name: "Semana", exact: true }).getByRole("button", { name: /18\/08:/ })).toBeVisible();
  await expect(origem).toBeFocused();
  await expect(atividades(page)).toHaveCount(0);
});

test("um cardio do tipo outro no descanso abre pelo calendário no primeiro toque sem rede", async ({ page, context }) => {
  const conta = await usuarioComPerfil({ data_inicio: "2026-06-01", fase_desde: "2026-06-01" });
  const cardio = { id: crypto.randomUUID(), data: "2026-09-06", tipo: "outro", concluida: true,
    duracao_min: 47, notas: "Bicicleta até a praia." };
  await inserirNoMock(conta, "cardio_sessions", [cardio]);
  await abrirCalendario(page);
  await abrirDiaFeito(page, "06/09");
  const url = "/cardio/outro?sessao=" + cardio.id;
  const abrir = atividades(page).getByRole("link", { name: "Abrir o cardio", exact: true });
  await expect(abrir).toHaveAttribute("href", url);
  await semRolagemHorizontal(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await abrir.focus();
  await abrir.press("Enter");
  await expect(page).toHaveURL(u => u.pathname + u.search === url);
  await expect(page.getByText(cardio.notas, { exact: true })).toBeVisible();
  await expect(page.getByText("47 min", { exact: true })).toBeVisible();
  await semRedeNoWorker(await workerDoApp(context));
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page.getByText(cardio.notas, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Começar", exact: true })).toHaveCount(0);
  await expect.poll(() => naFila(page)).toBe(0);
});

test("o calendário retoma pelo UUID o treino criado hoje enquanto o celular estava sem rede", async ({ page, context }) => {
  test.setTimeout(60_000);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await abrirCalendario(page);
  await irNaAba(page, "Treino");
  await esperarAbaTreino(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  const caminho = new URL(page.url()).pathname;
  const id = caminho.split("/").at(-1);
  await page.goBack();
  await esperarAbaTreino(page);
  await semRedeNoWorker(await workerDoApp(context));
  await page.getByRole("link", { name: "Abrir o calendário da semana", exact: true }).click();
  const hoje = botaoDoDia(page, "14/09");
  await expect(hoje).toBeVisible();
  await hoje.click();
  const dia = page.getByRole("dialog", { name: /14 de setembro/ });
  await expect(dia.getByRole("button", { name: "Salvar a troca", exact: true })).toBeVisible();
  const retomar = atividades(page).getByRole("link", { name: /^Retomar / });
  await expect(retomar).toHaveAttribute("href", caminho);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
  await semRedeNoWorker(await workerDoApp(context));
  await retomar.press("Enter");
  await expect(page).toHaveURL(u => u.pathname === caminho);
  await expect(page.getByRole("button", { name: "Concluir série", exact: true })).toBeVisible();
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => lerDoMock(conta, "sessions")).toMatchObject([{ id, status: "em_andamento" }]);
  await expect.poll(() => naFila(page)).toBe(0);
});

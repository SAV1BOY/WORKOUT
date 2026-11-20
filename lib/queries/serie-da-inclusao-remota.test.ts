import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { guardarNaFila } from "@/lib/outbox";
import {
  acrescentarExercicioNaSessao, atualizarSerie, definirNota, escritaDaSerie, marcarSerie, montarSessaoAvulsa, planoParaGravar,
  type SessaoLocal,
} from "@/lib/sessao";
import { incorporarMaterialConfirmado } from "./material-confirmado";
import { guardarSeriesDaInclusaoRecebida, guardarSeriesQueChegaram, incorporarSeriesQueChegaram } from "./serie-da-inclusao-remota";

const ponte = "ponte-de-gluteos-no-tatame", conta = "ana", id = "sessao";
beforeEach(async () => {
  vi.stubGlobal("window", { indexedDB });
  await Promise.all([bd().cache.clear(), bd().outbox.clear(), bd().sessaoAtiva.clear()]);
});
afterEach(() => vi.unstubAllGlobals());

async function cenario(guardarOrigem = true) {
  const itens = itensDeIds(["flexao-de-braco", "agachamento-livre"]);
  const original = montarSessaoAvulsa({ id, userId: conta, data: "2026-11-20", workoutId: "livre", fase: "fase1", itens, plano: planoDaSessao(itens) });
  const relogio = { chave: "descanso:serie:" + original.blocos[0]!.series[0]!.id, totalS: 90, fimEm: 120_000, ordem: 1 };
  const a = { ...definirNota(original, 1, "Apoiar as mãos"), player: relogio };
  let b = acrescentarExercicioNaSessao(original, ponte, {});
  const outra = b.blocos[2]!.series[0]!.id;
  b = marcarSerie(atualizarSerie(b, 3, outra, { reps: 10 }), 3, outra, true);
  const linha = escritaDaSerie(b, b.blocos[2]!, b.blocos[2]!.series[0]!).linha;
  const recebida = incorporarMaterialConfirmado(a, {
    id, user_id: conta, status: "em_andamento", revisao_equipamento: null, plano: planoParaGravar(b),
  }, false, { series: [], estados: [] });
  const token = recebida.plano!.ultima_inclusao!.id;
  await bd().sessaoAtiva.put({ id, dados: recebida, atualizadoEm: 1 });
  if (guardarOrigem) await guardarSeriesDaInclusaoRecebida(a, recebida);
  return { recebida, linha, token, provisoria: recebida.blocos[2]!.series[0]! };
}

const local = async () => (await bd().sessaoAtiva.get(id))!.dados as SessaoLocal;

it("a série tardia entra com o UUID, reps e carga reais sem trocar o exercício atual e o relógio", async () => {
  const { recebida, linha, token, provisoria } = await cenario();
  expect(provisoria.id).not.toBe(linha.id);
  expect(provisoria.concluida).toBe(false);
  const mudanca = await guardarSeriesQueChegaram(conta, id, token, [linha], () => recebida);
  expect(mudanca?.registros).toHaveLength(1);
  const atual = incorporarSeriesQueChegaram(recebida, token, mudanca!.ordem, mudanca!.exercicio, mudanca!.registros);
  expect(atual.player).toBe(recebida.player);
  expect(atual.blocos[0]).toBe(recebida.blocos[0]);
  expect(atual.blocos[2]!.series[0]).toMatchObject({ id: linha.id, reps: 10, cargaKg: linha.carga_kg, concluida: true });
  expect(await local()).toEqual(atual);
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => atual)).toBeUndefined();
  expect(await bd().outbox.count()).toBe(0);
});

it("só recebe a posição comprovadamente incorporada pela conta, com o mesmo exercício e token", async () => {
  const { recebida, linha, token } = await cenario(false);
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => recebida)).toBeUndefined();
  const comMarca = await cenario();
  const saida = await guardarSeriesQueChegaram(conta, id, comMarca.token, [
    { ...comMarca.linha, user_id: "bia" }, { ...comMarca.linha, ordem_ex: 1 }, { ...comMarca.linha, exercise_id: "flexao-de-braco" },
  ], () => comMarca.recebida);
  expect(saida).toBeUndefined();
  expect(await guardarSeriesQueChegaram(conta, id, "inclusao-anterior", [comMarca.linha], () => comMarca.recebida)).toBeUndefined();
  expect(await local()).toEqual(comMarca.recebida);
});

it("respeita o rascunho da tela, a correção em andamento, a escrita na fila e o ajuste de outra aba no disco", async () => {
  const { recebida, linha, token, provisoria } = await cenario();
  const editada = atualizarSerie(recebida, 3, provisoria.id, { reps: 17 });
  const corrigindo = { ...recebida, player: { chave: "serie:" + provisoria.id, ordem: 3, fimEm: null, totalS: null } };
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => editada)).toBeUndefined();
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => corrigindo)).toBeUndefined();
  await guardarNaFila("serie", escritaDaSerie(recebida, recebida.blocos[2]!, provisoria), "sessions:" + id);
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => recebida)).toBeUndefined();
  expect(await local()).toEqual(recebida);
  await bd().outbox.clear();
  await bd().sessaoAtiva.put({ id, dados: editada, atualizadoEm: 2 });
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => recebida)).toBeUndefined();
  expect(await local()).toEqual(editada);
});

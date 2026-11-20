import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { itensDeIds, itensDoPlano, planoDaSessao } from "@/lib/livre";
import { guardarNaFila } from "@/lib/outbox";
import {
  acrescentarExercicioNaSessao, ajustarPrescricaoDaSessao, atualizarSerie, definirNota, escritaDaSerie, marcarSerie, montarSessaoAvulsa, planoParaGravar, reconstruirSessao,
  type SessaoLocal,
} from "@/lib/sessao";
import { incorporarMaterialConfirmado } from "./material-confirmado";
import { avisoGuardadoDaInclusao, guardarSeriesDaInclusaoRecebida, guardarSeriesQueChegaram, incorporarSeriesQueChegaram } from "./serie-da-inclusao-remota";
import { confirmarMarcacaoDaSerie, confirmarToquesPendentes, salvarSessaoLocal } from "./sessao";

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

it("preserva a correção em andamento, a escrita na fila e o ajuste de outra aba ao receber a série", async () => {
  const { recebida, linha, token, provisoria } = await cenario();
  const editada = atualizarSerie(recebida, 3, provisoria.id, { reps: 17 });
  const corrigindo = { ...recebida, player: { chave: "descanso:" + provisoria.id, ordem: 3, fimEm: 110_000, totalS: 90 } };
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => corrigindo)).toBeUndefined();
  await guardarNaFila("serie", escritaDaSerie(recebida, recebida.blocos[2]!, provisoria), "sessions:" + id);
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => recebida)).toBeUndefined();
  expect(await local()).toEqual(recebida);
  await bd().outbox.clear();
  await bd().sessaoAtiva.put({ id, dados: editada, atualizadoEm: 2 });
  await guardarSeriesQueChegaram(conta, id, token, [linha], () => recebida);
  expect((await local()).blocos[2]!.series.slice(0, 2)).toMatchObject([
    { id: linha.id, setIndex: 1, reps: 10, concluida: true }, { id: provisoria.id, setIndex: 2, reps: 17, concluida: false },
  ]);
});

it("a edição que chega durante a leitura da fila é conferida antes de trocar o UUID", async () => {
  const { recebida, linha, token, provisoria } = await cenario();
  let tela = recebida;
  const fila = bd().outbox;
  const where = fila.where;
  const leitura = vi.spyOn(fila, "where").mockImplementationOnce(new Proxy(where, {
    apply(ler, alvo, args) {
      tela = atualizarSerie(recebida, 3, provisoria.id, { reps: 17 });
      return Reflect.apply(ler, alvo, args);
    },
  }));
  try {
    await guardarSeriesQueChegaram(conta, id, token, [linha], () => tela);
    expect(leitura).toHaveBeenCalledWith("tipo");
  } finally {
    leitura.mockRestore();
  }
  salvarSessaoLocal(tela, recebida);
  await confirmarToquesPendentes();
  expect((await local()).blocos[2]!.series.slice(0, 2)).toMatchObject([
    { id: linha.id, setIndex: 1, reps: 10, concluida: true }, { id: provisoria.id, setIndex: 2, reps: 17, concluida: false },
  ]);
  expect(await bd().outbox.count()).toBe(0);
});

it("o rascunho digitado entre o commit e a atualização da tela sobrevive no UUID que ainda estava em edição", async () => {
  const { recebida, linha, token, provisoria } = await cenario();
  const confirmada = await guardarSeriesQueChegaram(conta, id, token, [linha], () => recebida);
  expect((await local()).blocos[2]!.series[0]).toMatchObject({ id: linha.id, reps: 10, concluida: true });
  const tela = atualizarSerie(recebida, 3, provisoria.id, { reps: 17 });
  const exibida = incorporarSeriesQueChegaram(tela, token, confirmada!.ordem, confirmada!.exercicio, confirmada!.registros);
  expect(exibida.blocos[2]!.series[1]).toMatchObject({ id: provisoria.id, setIndex: 2, reps: 17 });
  salvarSessaoLocal(tela, recebida);
  await confirmarToquesPendentes();
  const salva = await local();
  expect(salva.blocos[2]!.series.slice(0, 2)).toMatchObject([
    { id: linha.id, setIndex: 1, reps: 10, concluida: true }, { id: provisoria.id, setIndex: 2, reps: 17, concluida: false },
  ]);
  expect(salva.player).toEqual(tela.player);
  expect(await guardarSeriesQueChegaram(conta, id, token, [linha], () => salva)).toBeUndefined();
  expect(await bd().outbox.count()).toBe(0);
  const confirmacao = await confirmarMarcacaoDaSerie(salva, 3, provisoria.id, true);
  const movimento = confirmacao!.sessao.blocos[2]!;
  const escrita = escritaDaSerie(confirmacao!.sessao, movimento, movimento.series[1]!).linha;
  expect((await bd().outbox.toArray()).filter(i => i.tipo === "serie")).toHaveLength(1);
  const plano = planoParaGravar(salva);
  const sessaoRemota = { id, user_id: conta, workout_id: salva.workoutId, fase: salva.fase, status: salva.status,
    data: salva.data, iniciada_em: salva.iniciadaEm, plano };
  for (const linhas of [[escrita, linha], [linha, escrita]]) {
    const nova = reconstruirSessao(sessaoRemota, linhas, { itens: itensDoPlano(plano)! });
    expect(nova?.blocos[2]!.series.filter(s => s.concluida)).toMatchObject([
      { id: linha.id, setIndex: 1, reps: 10 }, { id: provisoria.id, setIndex: 2, reps: 17 },
    ]);
  }
});

it("uma série já ajustada mantém seu lugar e o rascunho segue para a próxima livre", async () => {
  const { recebida, linha, token, provisoria } = await cenario();
  const segunda = recebida.blocos[2]!.series[1]!;
  const disco = atualizarSerie(recebida, 3, segunda.id, { reps: 13 });
  await bd().sessaoAtiva.put({ id, dados: disco, atualizadoEm: 1 });
  const tela = atualizarSerie(recebida, 3, provisoria.id, { reps: 17 });
  const mudanca = await guardarSeriesQueChegaram(conta, id, token, [linha], () => tela);
  const exibida = incorporarSeriesQueChegaram(tela, token, 3, ponte, mudanca!.registros);
  expect(exibida.blocos[2]!.series[2]).toMatchObject({ id: provisoria.id, setIndex: 3, reps: 17 });
  expect((await local()).blocos[2]!.series).toMatchObject([
    { id: linha.id, reps: 10 }, { id: segunda.id, reps: 13 }, { id: provisoria.id, reps: 17 },
  ]);
});

it.each([3, 10])("com %i posições já em uso, preserva todos os ajustes e respeita o máximo da sessão", async total => {
  const { recebida, linha, token, provisoria } = await cenario();
  let tela = ajustarPrescricaoDaSessao(recebida, 3, { series: total });
  for (const s of tela.blocos[2]!.series) tela = atualizarSerie(tela, 3, s.id, { reps: s.setIndex === 1 ? 17 : 12 + s.setIndex });
  await bd().sessaoAtiva.put({ id, dados: tela, atualizadoEm: 1 });
  await guardarSeriesQueChegaram(conta, id, token, [linha], () => tela);
  const salva = await local(), series = salva.blocos[2]!.series;
  expect(series[0]).toMatchObject({ id: linha.id, setIndex: 1, reps: 10, concluida: true });
  expect(series.slice(1, total)).toEqual(tela.blocos[2]!.series.slice(1));
  if (total === 3) {
    expect(series[3]).toMatchObject({ id: provisoria.id, setIndex: 4, reps: 17, concluida: false });
    expect(salva.blocos[2]!.prescricao.series).toBe(4);
  } else {
    expect(series).toHaveLength(10);
    expect(await avisoGuardadoDaInclusao(conta, id, token)).toContain("17 repetições");
    expect(await avisoGuardadoDaInclusao("bia", id, token)).toBeNull();
    expect(await confirmarMarcacaoDaSerie(tela, 3, provisoria.id, true)).toBeNull();
  }
  expect(await bd().outbox.count()).toBe(0);
});

it("preserva o UUID do passo que A já começou quando B confirma a série, mesmo com as repetições sugeridas", async () => {
  const { recebida, linha, token, provisoria } = await cenario();
  const player = { chave: "serie:" + provisoria.id, ordem: 3, fimEm: null, totalS: null };
  const tela = { ...recebida, player };
  await bd().sessaoAtiva.put({ id, dados: tela, atualizadoEm: 1 });
  await guardarSeriesQueChegaram(conta, id, token, [linha], () => tela);
  const salva = await local();
  expect(salva.player).toEqual(player);
  expect(salva.blocos[2]!.series.slice(0, 2)).toMatchObject([
    { id: linha.id, setIndex: 1, reps: 10, concluida: true },
    { id: provisoria.id, setIndex: 2, reps: 12, concluida: false },
  ]);
  const marcacao = await confirmarMarcacaoDaSerie(tela, 3, provisoria.id, true);
  expect(marcacao?.sessao.blocos[2]!.series[1]).toMatchObject({ id: provisoria.id, setIndex: 2, concluida: true });
  expect((await bd().outbox.toArray()).filter(i => i.tipo === "serie")).toHaveLength(1);
});

import "fake-indexeddb/auto";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import type { CorrecaoDeContagem } from "@/lib/contagens-pendentes";
import { bd } from "@/lib/db";
import { corrigirConsultasDaSerie, corrigirCopiasDaSerie, observarConciliacoesDeSeries,
  reconciliarCopiasDaSerie, retirarSerieAusenteDasCopias, revisaoDasSeries } from "@/lib/espelhos-da-contagem";

const banco = bd();
const disco = banco.cache;
const ativas = banco.sessaoAtiva;

const correcoes: CorrecaoDeContagem[] = [
  { campo: "reps", fracionarios: [8.5], inteiro: 9 },
  { campo: "tempo_s_lado2", fracionarios: [12.5], inteiro: 12 },
  { campo: "passos", fracionarios: [5.5], inteiro: 5 },
  { campo: "reps_alvo_max", fracionarios: [14.5], inteiro: 15 },
];
const linha = { id: "serie", session_id: "sessao", user_id: "ana", exercise_id: "passada", concluida: false,
  reps: 8.5, tempo_s_lado2: 12.5, passos: 5.5, reps_alvo_max: 14.5, carga_kg: 27.5 };
const corrigida = { ...linha, reps: 9, tempo_s_lado2: 12, passos: 5, reps_alvo_max: 15 };
const local = { id: "serie", concluida: false, reps: 8.5, tempoSLado2: 12.5, passos: 5.5, repsAlvoMax: 14.5, cargaKg: 27.5 };
const guardar = (chave: string, valor: unknown) => disco.put({ chave, atualizadoEm: 4321, valor });
const corrigir = () => corrigirCopiasDaSerie("ana", "sessao", "serie", correcoes);
beforeEach(async () => { await Promise.all([disco.clear(), ativas.clear(), banco.outbox.clear()]); });

it("corrige cada cópia identificada e preserva medições válidas, datas de sincronização, dono e outras séries", async () => {
  const detalhe = chaveDoDetalheDaSessao("ana", "sessao");
  const v1 = "series-do-historico:ana", v2 = "series-do-historico-v2:ana";
  const preparo = "series-anteriores-do-player:ana:passada:preparo", outro = "series-anteriores-do-player:bia:passada:preparo";
  const outras = [{ ...linha, id: "segunda" }, { ...linha, user_id: "bia" }, { ...linha, id: undefined },
    { ...linha, session_id: "outro-treino" }];
  for (const chave of [detalhe, v1, v2]) await guardar(chave, [linha, ...outras]);
  const emDia = { ...linha, reps: 10, tempo_s_lado2: null, passos: 4.5, reps_alvo_max: 3 };
  await guardar(preparo, { ignorada: null, linhas: [emDia, linha] });
  await guardar(outro, { ignorada: null, linhas: [linha] });

  const seriesAtuais = [local, { ...local, id: "outra" }];
  const blocos = [{ exercicioId: "passada", series: seriesAtuais,
    trocados: [{ exercicioId: "afundo", series: [{ ...local, id: "anterior" }] }] }];
  const dados = { id: "sessao", userId: "ana", plano: { titulo: "Treino livre" }, blocos, player: { chave: "descanso", fimEm: 100 } };
  await ativas.put({ id: "sessao", dados, atualizadoEm: 555 });
  await corrigir();

  for (const chave of [detalhe, v1, v2]) expect(await disco.get(chave)).toEqual({ chave, atualizadoEm: 4321, valor: [corrigida, ...outras] });
  expect((await disco.get(preparo))?.valor).toEqual({ ignorada: null, linhas: [emDia, corrigida] });
  expect((await disco.get(outro))?.valor).toEqual({ ignorada: null, linhas: [linha] });
  expect(await ativas.get("sessao")).toEqual({ id: "sessao", atualizadoEm: 555, dados: { ...dados, blocos: [{ ...blocos[0], series: [
    { ...local, reps: 9, tempoSLado2: 12, passos: 5, repsAlvoMax: 15 }, seriesAtuais[1],
  ] }] } });
  const gravarCache = vi.spyOn(disco, "put");
  await corrigir();
  expect(gravarCache).not.toHaveBeenCalled();
  gravarCache.mockRestore();
});

it("encontra a série anterior a uma substituição e conserva a nova que ocupa a mesma posição", async () => {
  const atual = { ...local, id: "serie-do-substituto" };
  const dados = { id: "sessao", userId: "ana", blocos: [{ series: [atual], trocados: [{ series: [local] }] }] };
  await ativas.put({ id: "sessao", atualizadoEm: 21, dados });
  await corrigir();
  expect((await ativas.get("sessao"))?.dados).toEqual({ ...dados, blocos: [{ series: [atual], trocados: [{ series: [
    { ...local, reps: 9, tempoSLado2: 12, passos: 5, repsAlvoMax: 15 },
  ] }] }] });
  const alheia = { ...dados, userId: "bia" };
  await ativas.put({ id: "sessao", atualizadoEm: 21, dados: alheia });
  await corrigir();
  expect((await ativas.get("sessao"))?.dados).toEqual(alheia);
});

it("a correção manual não reativa uma medição antiga que terminou no mesmo segundo informado", async () => {
  const medicaoCronometro = { serieId: "serie", alvoS: 40, medidoS: 12 };
  const serie = { id: "serie", tempoS: 12.5, medicaoCronometro };
  const outra = { id: "outra", tempoS: 12, medicaoCronometro: { ...medicaoCronometro, serieId: "outra" } };
  const dados = { id: "sessao", userId: "ana", blocos: [{ series: [serie, outra] }] };
  await ativas.put({ id: "sessao", atualizadoEm: 21, dados });
  await corrigirCopiasDaSerie("ana", "sessao", "serie", [{ campo: "tempo_s", fracionarios: [12.5], inteiro: 12 }]);
  expect((await ativas.get("sessao"))?.dados).toEqual({ ...dados, blocos: [{ series: [{ id: "serie", tempoS: 12 }, outra] }] });
});

it("alinha o cache TanStack durável e o da aba sem promover a data da consulta nem forçar um GET", async () => {
  const cliente = new QueryClient();
  const detalhe = ["progresso", "series-da-sessao", "ana", "sessao"];
  const janela = ["progresso", "series-ex", "passada"], antiga = ["progresso", "series-todas"];
  const alheia = ["ultimas-series", "bia", "passada", ""], naoRelacionada = ["soltas-todas", "ana"];
  const fonte = { completa: true, confirmadasEm: 876, linhas: [linha] };
  cliente.setQueryData(detalhe, fonte, { updatedAt: 876 });
  for (const chave of [janela, antiga, alheia, naoRelacionada]) cliente.setQueryData(chave, [linha], { updatedAt: 123 });
  await guardar("react-query-v1", { salvoEm: 234, estado: dehydrate(cliente) });

  await corrigir();
  corrigirConsultasDaSerie(cliente, "ana", "sessao", "serie", correcoes);
  expect(cliente.getQueryData(detalhe)).toEqual({ ...fonte, linhas: [corrigida] });
  expect(cliente.getQueryData(janela)).toEqual([corrigida]);
  expect(cliente.getQueryData(antiga)).toEqual([corrigida]);
  expect(cliente.getQueryData(alheia)).toEqual([linha]);
  expect(cliente.getQueryData(naoRelacionada)).toEqual([linha]);
  expect(cliente.getQueryState(janela)?.dataUpdatedAt).toBe(123);
  const valor = (await disco.get("react-query-v1"))!.valor as { salvoEm: number; estado: ReturnType<typeof dehydrate> };
  expect(valor.salvoEm).toBe(234);
  for (const q of valor.estado.queries) {
    expect(q.state.data).toEqual(cliente.getQueryData(q.queryKey));
    expect(q.state.dataUpdatedAt).toBe(cliente.getQueryState(q.queryKey)?.dataUpdatedAt);
  }
  cliente.clear();
});

it("a falha em uma cópia reverte a correção da sessão e da fila na mesma transação", async () => {
  const chave = chaveDoDetalheDaSessao("ana", "sessao");
  await guardar(chave, [linha]);
  const dados = { id: "sessao", userId: "ana", blocos: [{ series: [local] }] };
  await ativas.put({ id: "sessao", dados, atualizadoEm: 21 });
  const falha = vi.spyOn(disco, "put").mockRejectedValueOnce(new Error("QuotaExceededError"));
  try {
    await expect(banco.transaction("rw", [banco.outbox, ativas, disco], async () => {
      await banco.outbox.add({ tipo: "serie", payload: corrigida, criadoEm: 1, proximaTentativa: 1, tentativas: 0 });
      await corrigir();
    })).rejects.toThrow("QuotaExceededError");
    expect(await banco.outbox.count()).toBe(0);
    expect((await ativas.get("sessao"))?.dados).toEqual(dados);
    expect((await disco.get(chave))?.valor).toEqual([linha]);
  } finally {
    falha.mockRestore();
  }
});

const sessaoA = chaveDoDetalheDaSessao("ana", "sessao");
const sessaoB = chaveDoDetalheDaSessao("ana", "nova");
const globalDaAna = "series-do-historico-v2:ana";
const feita = { ...corrigida, tipo: "trabalho", ordem_ex: 1, set_index: 1, concluida: true };
const noBackup = { ...feita, exercise_id: "flexao", session_id: "nova", reps: 18, carga_kg: 0 };
const vizinha = { ...feita, id: "vizinha", set_index: 2 };
const transacao = (atualizar: () => Promise<void>) => banco.transaction("rw", [disco, ativas, banco.outbox], async () => { await atualizar(); });

it("move o UUID canônico entre treinos e movimentos sem duplicar, mudar a conta nem promover a data das cópias", async () => {
  const jogador = "series-anteriores-do-player:ana:passada:preparo";
  const alheia = "series-do-historico-v2:bia";
  await guardar(sessaoA, [feita, vizinha]);
  await guardar(sessaoB, []);
  const novoMovimento = "series-anteriores-do-player:ana:flexao:preparo";
  await guardar(novoMovimento, { ignorada: null, linhas: [] });
  await guardar(globalDaAna, [feita, { ...feita }, vizinha]);
  await guardar(alheia, [{ ...feita, user_id: "bia" }]);
  await guardar(jogador, { ignorada: null, linhas: [feita, vizinha] });
  const dados = { id: "sessao", userId: "ana", blocos: [{ ordem: 1, exercicioId: "passada", series: [
    { id: feita.id, reps: 9 }, { id: vizinha.id, reps: 8 },
  ] }] };
  await ativas.put({ id: dados.id, dados, atualizadoEm: 666 });
  // A última escrita local já aponta para o treino B e a aba do treino A ainda está aberta.
  await transacao(() => reconciliarCopiasDaSerie("ana", noBackup, noBackup, feita));
  expect(await disco.get(sessaoA)).toEqual({ chave: sessaoA, valor: [vizinha], atualizadoEm: 4321 });
  expect(await disco.get(sessaoB)).toEqual({ chave: sessaoB, valor: [noBackup], atualizadoEm: 4321 });
  expect((await disco.get(globalDaAna))?.valor).toEqual([noBackup, vizinha]);
  expect((await disco.get(jogador))?.valor).toEqual({ ignorada: null, linhas: [vizinha] });
  expect((await disco.get(novoMovimento))?.valor).toEqual({ ignorada: null, linhas: [noBackup] });
  expect((await disco.get(alheia))?.valor).toEqual([{ ...feita, user_id: "bia" }]);
  expect((await ativas.get("sessao"))?.dados).toMatchObject({ blocos: [{ series: [{ id: vizinha.id, reps: 8 }] }] });
  expect(await revisaoDasSeries("ana")).toBe(1);
  expect(await revisaoDasSeries("bia")).toBe(0);
});

it("uma edição explícita posterior ao envio prevalece no próprio UUID, sem criar fechamento a partir de uma linha", async () => {
  await guardar(sessaoA, [feita, vizinha]);
  await guardar(globalDaAna, [feita]);
  await banco.outbox.add({ tipo: "serie", criadoEm: 100, proximaTentativa: 1, tentativas: 0, payload: {
    tabela: "session_sets", operacaoGuardada: "upsert", seriesEmConciliacao: ["contagens-a-conciliar:ana:outra"],
    linhas: [{ id: feita.id, session_id: "nova", user_id: "ana", reps: 22 },
      { ...feita, user_id: "bia", carga_kg: 999 }],
  } });
  await transacao(() => reconciliarCopiasDaSerie("ana", feita, noBackup));
  expect((await disco.get(globalDaAna))?.valor).toEqual([{ ...noBackup, reps: 22 }]);
  expect((await disco.get(sessaoA))?.valor).toEqual([vizinha]);
  expect(await disco.get(sessaoB)).toBeUndefined();
  expect(await banco.outbox.count()).toBe(1);
});

it("ao manter a ausência, retira o UUID dos treinos antigo e proposto sem excluir a série vizinha ou uma escrita posterior", async () => {
  await guardar(sessaoA, [feita, vizinha]);
  await guardar(sessaoB, [noBackup]);
  await guardar(globalDaAna, [feita, vizinha]);
  await transacao(() => retirarSerieAusenteDasCopias("ana", noBackup, feita));
  expect((await disco.get(sessaoA))?.valor).toEqual([vizinha]);
  expect((await disco.get(sessaoB))?.valor).toEqual([]);
  expect((await disco.get(globalDaAna))?.valor).toEqual([vizinha]);
  await banco.outbox.add({ tipo: "serie", criadoEm: 1, proximaTentativa: 1, tentativas: 0, payload: {
    tabela: "session_sets", op: "upsert", linha: { ...noBackup, reps: 30 },
  } });
  await transacao(() => retirarSerieAusenteDasCopias("ana", noBackup, feita));
  expect((await disco.get(sessaoB))?.valor).toEqual([{ ...noBackup, reps: 30 }]);
  expect((await disco.get(globalDaAna))?.valor).toEqual([vizinha, { ...noBackup, reps: 30 }]);
});

it("uma aba observa de uma vez duas decisões da conta e não volta a persistir o peso ou movimento anterior", async () => {
  const q = new QueryClient(), chave = ["progresso", "series-todas", "ana"];
  const parcial = { completa: false, linhas: [feita, vizinha] };
  q.setQueryData(chave, parcial, { updatedAt: 758 });
  // Espera a leitura inicial real do liveQuery, mesmo se o teste rodar em uma máquina lenta.
  const inicial = { ...feita, id: "inicial" };
  await transacao(() => reconciliarCopiasDaSerie("ana", inicial, inicial));
  const primeiraLeitura = Promise.withResolvers<void>();
  const aposLeitura = (item: { chave: string }) => {
    if (item?.chave.endsWith(":ana:inicial")) primeiraLeitura.resolve();
    return item;
  };
  disco.hook("reading", aposLeitura);
  const parar = observarConciliacoesDeSeries(q);
  try {
    await primeiraLeitura.promise;
    const recente = { ...vizinha, reps: 15, carga_kg: 35.5 };
    await transacao(async () => {
      await reconciliarCopiasDaSerie("ana", feita, noBackup);
      await reconciliarCopiasDaSerie("ana", vizinha, recente);
    });
    await vi.waitFor(() => expect(q.getQueryData(chave)).toEqual({ completa: false, linhas: [noBackup, recente] }));
    expect(q.getQueryState(chave)?.dataUpdatedAt).toBe(758);
  } finally {
    parar(); disco.hook("reading").unsubscribe(aposLeitura); q.clear();
  }
});

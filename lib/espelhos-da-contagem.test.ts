import "fake-indexeddb/auto";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import type { CorrecaoDeContagem } from "@/lib/contagens-pendentes";
import { bd } from "@/lib/db";
import { corrigirConsultasDaSerie, corrigirCopiasDaSerie } from "@/lib/espelhos-da-contagem";

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

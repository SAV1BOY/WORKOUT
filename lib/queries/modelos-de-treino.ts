"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { liveQuery } from "dexie";
import { useEffect } from "react";
import { bd, guardarCache, lerCache, temIndexedDB } from "@/lib/db";
import { ajustesDoModeloConfirmados, camposDeAjusteDoModelo, idDeModeloValido, modeloCompativelComCatalogo, modeloDeTreinoValido, type ModeloDeTreino } from "@/lib/modelo-de-treino";
import { guardarNaFila, processar } from "@/lib/outbox";
import { alvoDaEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import { FalhaDeRedeNaTabela, lerTabelaCompleta } from "@/lib/queries/ler";

export type { ModeloDeTreino };

const TABELA = "modelos_de_treino";
const TIPO = "modelo_de_treino";
export const chaveDosModelos = (conta: string | null) => ["modelos-de-treino", conta] as const;
const chaveNoDisco = (conta: string) => JSON.stringify(chaveDosModelos(conta));

// A revisão da última alteração local também existe para um modelo removido.
// Assim um GET antigo não o repõe, mesmo depois de a outra aba esvaziar a fila.
type Copia = { modelos: ModeloDeTreino[]; revisoes: Record<string, number>; ultimaConsulta?: number };

async function copiaLocal(cliente: QueryClient, conta: string): Promise<Copia> {
  if (temIndexedDB()) {
    const salva = await copiaDoDisco(conta);
    if (salva) return salva;
  }
  return { modelos: cliente.getQueryData<ModeloDeTreino[]>(chaveDosModelos(conta)) ?? [], revisoes: {} };
}

async function guardar(conta: string, copia: Copia) {
  await guardarCache(chaveNoDisco(conta), copia);
  return copia.modelos;
}

/** Reproduz a poda do banco em colunas omitidas. Uma exclusão anterior (null) zera os dois mapas. */
function comAjustesAnteriores(modelo: ModeloDeTreino, anterior: ModeloDeTreino | null | undefined) {
  if (anterior === undefined || ajustesDoModeloConfirmados(modelo)) return modelo;
  const efetivo = { ...modelo };
  for (const campo of camposDeAjusteDoModelo) {
    const mapa = anterior === null ? null : anterior[campo];
    if (modelo[campo] !== undefined || mapa === undefined) continue;
    efetivo[campo] = mapa === null ? null : Object.fromEntries(Object.entries(mapa).filter(([id]) => modelo.exercicios.includes(id)));
  }
  return efetivo;
}

type Pendencias = Map<string, (ModeloDeTreino | null)[]>;

async function pendenciasDaConta(conta: string): Promise<Pendencias> {
  const pendentes: Pendencias = new Map();
  const fila = await bd().outbox.where("tipo").equals(TIPO).toArray();
  for (const { payload } of fila) {
    const { linha, filtro } = payload as EscritaTabela;
    const alvo = linha ?? filtro;
    if (alvo?.user_id !== conta || typeof alvo.id !== "string") continue;
    if (linha && !modeloDeTreinoValido(linha)) throw new Error("O modelo de treino na fila está inválido.");
    const escritas = pendentes.get(alvo.id) ?? [];
    escritas.push(linha ?? null);
    pendentes.set(alvo.id, escritas);
  }
  return pendentes;
}

function ultimoModeloDaFila(anterior: ModeloDeTreino | undefined, escritas: (ModeloDeTreino | null)[]) {
  let ultimo: ModeloDeTreino | null | undefined = anterior;
  for (const escrita of escritas) {
    ultimo = escrita === null ? null : comAjustesAnteriores(escrita, ultimo);
  }
  return ultimo;
}

async function copiaDoDisco(conta: string) {
  const banco = bd();
  return banco.transaction("r", banco.cache, banco.outbox, async () => {
    const copia = await lerCache<Copia>(chaveNoDisco(conta));
    if (!copia?.modelos.some(m => !ajustesDoModeloConfirmados(m))) return copia;
    // As versões #62 e #63 podem ter lido menos colunas que as já presentes na fila.
    const pendentes = await pendenciasDaConta(conta);
    return { ...copia, modelos: copia.modelos.flatMap(m => {
      if (ajustesDoModeloConfirmados(m)) return [m];
      const ultima = ultimoModeloDaFila(undefined, pendentes.get(m.id) ?? []);
      return ultima === null ? [] : [comAjustesAnteriores(m, ultima)];
    }) };
  });
}

async function antesDaConsulta(conta: string) {
  if (!temIndexedDB()) return { revisoes: {}, pendentes: new Map() as Pendencias, ordem: 0 };
  const banco = bd();
  return banco.transaction("rw", banco.cache, banco.outbox, async () => {
    // Dois aparelhos podem refletir mudanças no servidor em GETs de abas diferentes.
    // O início de cada leitura tem ordem mesmo se o relógio do celular retroceder.
    const chaveDaOrdem = `consulta-dos-modelos:${conta}`;
    const ordem = (await lerCache<number>(chaveDaOrdem) ?? 0) + 1;
    await guardarCache(chaveDaOrdem, ordem);
    const revisoes = (await lerCache<Copia>(chaveNoDisco(conta)))?.revisoes ?? {};
    return { revisoes, pendentes: await pendenciasDaConta(conta), ordem };
  });
}

export async function lerModelosDeTreino(cliente: QueryClient, conta: string, sinal?: AbortSignal, exigirRemoto = false): Promise<ModeloDeTreino[]> {
  sinal?.throwIfAborted();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (exigirRemoto) throw new FalhaDeRedeNaTabela("Conecte-se para ler todos os modelos de treino da conta.");
    return (await copiaLocal(cliente, conta)).modelos;
  }
  const { revisoes, pendentes, ordem } = await antesDaConsulta(conta);
  sinal?.throwIfAborted();
  // Na biblioteca o aparelho pode anunciar conexão sem conseguir sair para a rede.
  const rede = new AbortController();
  const cancelar = () => rede.abort(sinal?.reason);
  sinal?.addEventListener("abort", cancelar, { once: true });
  const prazo = exigirRemoto ? undefined : setTimeout(() => rede.abort(), 3_000);
  let remotos: ModeloDeTreino[];
  try {
    remotos = await lerTabelaCompleta<ModeloDeTreino>(TABELA, "id,user_id,nome,exercicios,equipamento_disponivel,series_por_exercicio,descansos_por_exercicio", "os modelos de treino", conta, rede.signal);
  } catch (erro) {
    sinal?.throwIfAborted();
    if (exigirRemoto || (!rede.signal.aborted && !(erro instanceof FalhaDeRedeNaTabela))) throw erro;
    return (await copiaLocal(cliente, conta)).modelos;
  } finally {
    clearTimeout(prazo);
    sinal?.removeEventListener("abort", cancelar);
  }
  if (remotos.some(m => !modeloDeTreinoValido(m) || m.user_id !== conta)) throw new Error("O servidor devolveu um modelo inválido para esta conta.");
  if (!temIndexedDB()) return remotos;
  const banco = bd();
  return banco.transaction("rw", banco.cache, banco.outbox, async () => {
    const atual = await copiaLocal(cliente, conta);
    sinal?.throwIfAborted();
    const mudouNaLeitura = "A lista mudou em outra aba. Tente novamente para confirmar as séries e os descansos.";
    if ((atual.ultimaConsulta ?? 0) > ordem) {
      if (exigirRemoto && atual.modelos.some(m => !ajustesDoModeloConfirmados(m))) throw new Error(mudouNaLeitura);
      return atual.modelos;
    }
    const mudaram = (id: string) => atual.revisoes[id] !== revisoes[id];
    const porId = new Map(remotos.map(m => [m.id, m]));
    const modelos = remotos.filter(m => !pendentes.has(m.id) && !mudaram(m.id));
    for (const local of atual.modelos) {
      if (mudaram(local.id)) {
        // A versão anterior pode ter renomeado, retirado e até recolocado exercícios
        // durante o GET e já drenado a fila sem conhecer todos os campos.
        if (exigirRemoto && !ajustesDoModeloConfirmados(local)) throw new Error(mudouNaLeitura);
        modelos.push(local);
      } else {
        // Retirar e recolocar um exercício elimina os ajustes que ele tinha antes.
        const escritas = pendentes.get(local.id);
        if (!escritas) continue;
        const ultima = ultimoModeloDaFila(porId.get(local.id), escritas);
        if (ultima) modelos.push(ultima);
      }
    }
    return guardar(conta, { modelos, revisoes: atual.revisoes, ultimaConsulta: ordem });
  });
}

export function useModelosDeTreino(conta: string | null) {
  const cliente = useQueryClient();
  useEffect(() => {
    if (!conta || !temIndexedDB()) return;
    // Mostra a cópia assim que a biblioteca abre e acompanha gravações de outras abas.
    const assinatura = liveQuery(() => copiaDoDisco(conta)).subscribe({
      next: copia => { if (copia) cliente.setQueryData(chaveDosModelos(conta), copia.modelos); },
    });
    return () => assinatura.unsubscribe();
  }, [cliente, conta]);
  return useQuery<ModeloDeTreino[]>({
    queryKey: chaveDosModelos(conta), enabled: Boolean(conta), networkMode: "always", refetchOnMount: "always", refetchOnReconnect: "always", retry: false,
    queryFn: ({ signal }) => conta ? lerModelosDeTreino(cliente, conta, signal) : [],
  });
}

async function gravarAlteracao(cliente: QueryClient, conta: string, id: string, modelo: ModeloDeTreino | null) {
  const chave = chaveDosModelos(conta);
  const filtro = { user_id: conta, id };
  const escrita: EscritaTabela = modelo ? { tabela: TABELA, op: "upsert", onConflict: "user_id,id", linha: modelo }
    : { tabela: TABELA, op: "delete", filtro };
  const pedido = modelo ? escrita : { tabela: TABELA, removerModelo: true, filtro };
  const banco = bd();
  const modelos = await banco.transaction("rw", banco.cache, banco.outbox, async () => {
    const copia = await copiaLocal(cliente, conta);
    const porId = new Map(copia.modelos.map(m => [m.id, m]));
    if (modelo) {
      let anterior: ModeloDeTreino | null | undefined = porId.get(id);
      if (!anterior && !ajustesDoModeloConfirmados(modelo)) {
        anterior = ultimoModeloDaFila(undefined, (await pendenciasDaConta(conta)).get(id) ?? []);
      }
      porId.set(id, comAjustesAnteriores(modelo, anterior));
    } else porId.delete(id);
    await guardarNaFila(TIPO, pedido, alvoDaEscrita(escrita));
    const revisoes = { ...copia.revisoes, [id]: (copia.revisoes[id] ?? 0) + 1 };
    return guardar(conta, { ...copia, modelos: [...porId.values()], revisoes });
  });
  cliente.setQueryData(chave, modelos);
  void processar();
  return modelos;
}

async function gravarModelo(cliente: QueryClient, modelo: ModeloDeTreino, origem: "editor" | "backup") {
  const { id, user_id, exercicios, equipamento_disponivel } = modelo;
  const nome = origem === "editor" ? modelo.nome.trim() : modelo.nome;
  const linha: ModeloDeTreino = { id, user_id, nome, exercicios, equipamento_disponivel };
  for (const campo of camposDeAjusteDoModelo) {
    if (modelo[campo] !== undefined) linha[campo] = modelo[campo];
  }
  if (!modeloDeTreinoValido(linha) || (origem === "editor" && !modeloCompativelComCatalogo(linha))) {
    throw new Error("Confira o nome, o material, os exercícios e seus ajustes.");
  }
  const salvos = await gravarAlteracao(cliente, user_id, id, linha);
  return salvos.find(m => m.id === id)!;
}

export function salvarModeloDeTreino(cliente: QueryClient, modelo: ModeloDeTreino): Promise<ModeloDeTreino> {
  return gravarModelo(cliente, modelo, "editor");
}

export async function importarModeloDeTreino(cliente: QueryClient, modelo: ModeloDeTreino): Promise<void> {
  await gravarModelo(cliente, modelo, "backup");
}

export async function excluirModeloDeTreino(cliente: QueryClient, conta: string, id: string): Promise<void> {
  if (!conta.trim() || !idDeModeloValido(id)) throw new Error("Confira a conta e o modelo de treino.");
  await gravarAlteracao(cliente, conta, id, null);
}

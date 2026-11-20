"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { liveQuery } from "dexie";
import { useEffect } from "react";
import { bd, guardarCache, lerCache, temIndexedDB } from "@/lib/db";
import { idDeModeloValido, modeloCompativelComCatalogo, modeloDeTreinoValido, type ModeloDeTreino } from "@/lib/modelo-de-treino";
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
    const salva = await lerCache<Copia>(chaveNoDisco(conta));
    if (salva) return salva;
  }
  return { modelos: cliente.getQueryData<ModeloDeTreino[]>(chaveDosModelos(conta)) ?? [], revisoes: {} };
}

async function guardar(conta: string, copia: Copia) {
  await guardarCache(chaveNoDisco(conta), copia);
  return copia.modelos;
}

async function antesDaConsulta(cliente: QueryClient, conta: string) {
  const protegidos = new Set<string>();
  if (!temIndexedDB()) return { copia: await copiaLocal(cliente, conta), protegidos, ordem: 0 };
  const banco = bd();
  return banco.transaction("rw", banco.cache, banco.outbox, async () => {
    // Dois aparelhos podem refletir mudanças no servidor em GETs de abas diferentes.
    // O início de cada leitura tem ordem mesmo se o relógio do celular retroceder.
    const chaveDaOrdem = `consulta-dos-modelos:${conta}`;
    const ordem = (await lerCache<number>(chaveDaOrdem) ?? 0) + 1;
    await guardarCache(chaveDaOrdem, ordem);
    const copia = await copiaLocal(cliente, conta);
    const fila = await banco.outbox.where("tipo").equals(TIPO).toArray();
    for (const { payload } of fila) {
      const { linha, filtro } = payload as EscritaTabela;
      const alvo = linha ?? filtro;
      if (alvo?.user_id === conta && typeof alvo.id === "string") protegidos.add(alvo.id);
    }
    return { copia, protegidos, ordem };
  });
}

export async function lerModelosDeTreino(cliente: QueryClient, conta: string, sinal?: AbortSignal, exigirRemoto = false): Promise<ModeloDeTreino[]> {
  sinal?.throwIfAborted();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (exigirRemoto) throw new FalhaDeRedeNaTabela("Conecte-se para ler todos os modelos de treino da conta.");
    return (await copiaLocal(cliente, conta)).modelos;
  }
  const { copia: inicial, protegidos, ordem } = await antesDaConsulta(cliente, conta);
  sinal?.throwIfAborted();
  // Na biblioteca o aparelho pode anunciar conexão sem conseguir sair para a rede.
  const rede = new AbortController();
  const cancelar = () => rede.abort(sinal?.reason);
  sinal?.addEventListener("abort", cancelar, { once: true });
  const prazo = exigirRemoto ? undefined : setTimeout(() => rede.abort(), 3_000);
  let remotos: ModeloDeTreino[];
  try {
    remotos = await lerTabelaCompleta<ModeloDeTreino>(TABELA, "id,user_id,nome,exercicios,equipamento_disponivel", "os modelos de treino", conta, rede.signal);
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
  return banco.transaction("rw", banco.cache, async () => {
    const atual = await copiaLocal(cliente, conta);
    sinal?.throwIfAborted();
    if ((atual.ultimaConsulta ?? 0) > ordem) return atual.modelos;
    for (const [id, revisao] of Object.entries(atual.revisoes)) {
      if (revisao !== inicial.revisoes[id]) protegidos.add(id);
    }
    const modelos = [...remotos.filter(m => !protegidos.has(m.id)), ...atual.modelos.filter(m => protegidos.has(m.id))];
    return guardar(conta, { modelos, revisoes: atual.revisoes, ultimaConsulta: ordem });
  });
}

export function useModelosDeTreino(conta: string | null) {
  const cliente = useQueryClient();
  useEffect(() => {
    if (!conta || !temIndexedDB()) return;
    // Mostra a cópia assim que a biblioteca abre e acompanha gravações de outras abas.
    const assinatura = liveQuery(() => lerCache<Copia>(chaveNoDisco(conta))).subscribe({
      next: copia => { if (copia) cliente.setQueryData(chaveDosModelos(conta), copia.modelos); },
    });
    return () => assinatura.unsubscribe();
  }, [cliente, conta]);
  return useQuery<ModeloDeTreino[]>({
    queryKey: chaveDosModelos(conta), enabled: Boolean(conta), networkMode: "always", refetchOnMount: "always", retry: false,
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
    if (modelo) porId.set(id, modelo);
    else porId.delete(id);
    await guardarNaFila(TIPO, pedido, alvoDaEscrita(escrita));
    const revisoes = { ...copia.revisoes, [id]: (copia.revisoes[id] ?? 0) + 1 };
    return guardar(conta, { ...copia, modelos: [...porId.values()], revisoes });
  });
  cliente.setQueryData(chave, modelos);
  void processar();
}

async function gravarModelo(cliente: QueryClient, modelo: ModeloDeTreino, origem: "editor" | "backup") {
  const { id, user_id, exercicios, equipamento_disponivel } = modelo;
  const nome = origem === "editor" ? modelo.nome.trim() : modelo.nome;
  const linha = { id, user_id, nome, exercicios, equipamento_disponivel };
  if (!modeloDeTreinoValido(linha) || (origem === "editor" && !modeloCompativelComCatalogo(linha))) {
    throw new Error("Confira o nome, os exercícios e o material do modelo.");
  }
  await gravarAlteracao(cliente, user_id, id, linha);
}

export function salvarModeloDeTreino(cliente: QueryClient, modelo: ModeloDeTreino): Promise<void> {
  return gravarModelo(cliente, modelo, "editor");
}

export function importarModeloDeTreino(cliente: QueryClient, modelo: ModeloDeTreino): Promise<void> {
  return gravarModelo(cliente, modelo, "backup");
}

export async function excluirModeloDeTreino(cliente: QueryClient, conta: string, id: string): Promise<void> {
  if (!conta.trim() || !idDeModeloValido(id)) throw new Error("Confira a conta e o modelo de treino.");
  await gravarAlteracao(cliente, conta, id, null);
}

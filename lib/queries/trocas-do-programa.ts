"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { bd, lerCache, temIndexedDB } from "@/lib/db";
import { guardarNaFila, processar } from "@/lib/outbox";
import { alvoDaEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import { clienteNavegador } from "@/lib/supabase/client";
import { trocaDoProgramaValida } from "@/lib/trocas";

type Trocas = Record<string, string>;
type Alteracao = { original: string; substituto: string | null };
type LinhaDeTroca = { exercicio_original_id: string; substituto_id: string };
const TABELA = "trocas_do_programa";
const CHAVE_PRIMARIA = "user_id,workout_id,exercicio_original_id";

export const chaveDasTrocas = (conta?: string | null, treino?: string | null) =>
  ["trocas-do-programa", conta, treino] as const;

function aplicar(base: Trocas, alteracoes: Alteracao[]): Trocas {
  const mapa = { ...base };
  for (const { original, substituto } of alteracoes) {
    if (substituto === null) delete mapa[original];
    else mapa[original] = substituto;
  }
  return mapa;
}

async function pendentes(conta: string, treino: string): Promise<Alteracao[]> {
  if (!temIndexedDB()) return [];
  const itens = await bd().outbox.where("tipo").equals("troca_do_programa").toArray();
  const alteracoes: Alteracao[] = [];
  // O índice por tipo devolve empates na ordem da chave primária crescente da fila.
  for (const item of itens) {
    const pedido = item.payload as EscritaTabela;
    const linha = pedido.linha ?? pedido.filtro;
    if (linha?.user_id !== conta || linha.workout_id !== treino || typeof linha.exercicio_original_id !== "string") continue;
    if (pedido.op === "delete") alteracoes.push({ original: linha.exercicio_original_id, substituto: null });
    else if (typeof linha.substituto_id === "string") {
      alteracoes.push({ original: linha.exercicio_original_id, substituto: linha.substituto_id });
    }
  }
  return alteracoes;
}

/** Dentro de uma transação de escrita, conserva os demais slots da conta e do treino. */
async function gravarCopia(chave: string, base: Trocas, alterar: (anterior: Trocas) => Trocas, sinal?: AbortSignal) {
  const anterior = await lerCache<Trocas>(chave);
  sinal?.throwIfAborted();
  const valor = alterar(anterior ?? base);
  await bd().cache.put({ chave, valor, atualizadoEm: Date.now() });
  return valor;
}

/** As escolhas continuam disponíveis depois da expiração do cache geral de consultas. */
async function atualizarCopia(chave: string, base: Trocas, alterar: (anterior: Trocas) => Trocas, sinal?: AbortSignal) {
  if (!temIndexedDB()) return alterar(base);
  const banco = bd();
  return banco.transaction("rw", banco.cache, () => gravarCopia(chave, base, alterar, sinal));
}

async function lerBaseLocal(cliente: QueryClient, conta: string, treino: string): Promise<Trocas> {
  const chave = chaveDasTrocas(conta, treino);
  return (temIndexedDB() ? await lerCache<Trocas>(JSON.stringify(chave)) : null)
    ?? cliente.getQueryData<Trocas>(chave) ?? {};
}

export async function lerTrocasLocaisDoPrograma(cliente: QueryClient, conta: string, treino: string): Promise<Trocas> {
  const [base, fila] = await Promise.all([lerBaseLocal(cliente, conta, treino), pendentes(conta, treino)]);
  return aplicar(base, fila);
}

export async function lerTrocasDoPrograma(cliente: QueryClient, conta: string, treino: string, sinal?: AbortSignal): Promise<Trocas> {
  const disco = JSON.stringify(chaveDasTrocas(conta, treino));
  const [baseInicial, antes] = await Promise.all([lerBaseLocal(cliente, conta, treino), pendentes(conta, treino)]);
  sinal?.throwIfAborted();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return aplicar(baseInicial, antes);

  // A rede do terraço pode continuar anunciada como online mesmo sem saída.
  // Só o GET opcional das trocas tem esse prazo; a fila continua sincronizando.
  const rede = new AbortController();
  const cancelar = () => rede.abort(sinal?.reason);
  sinal?.addEventListener("abort", cancelar, { once: true });
  const relogio = setTimeout(() => rede.abort(), 1_500);
  const consultar = () => clienteNavegador().from(TABELA).select("exercicio_original_id,substituto_id")
    .eq("user_id", conta).eq("workout_id", treino).retry(false).abortSignal(rede.signal);
  const { data, error, status } = await Promise.resolve().then(consultar).finally(() => {
    clearTimeout(relogio);
    sinal?.removeEventListener("abort", cancelar);
  });
  sinal?.throwIfAborted();
  if (rede.signal.aborted || (error && status === 0)) {
    // A cópia e a fila são gravadas juntas. Enquanto o GET esperava, outra
    // aba pode ter confirmado uma escolha que substitui uma pendência antiga.
    const local = await lerTrocasLocaisDoPrograma(cliente, conta, treino);
    sinal?.throwIfAborted();
    return local;
  }
  if (error) throw new Error(error.message);

  const linhas: LinhaDeTroca[] = data ?? [];
  const remotas: Trocas = Object.fromEntries(linhas.map((linha) => [linha.exercicio_original_id, linha.substituto_id]));
  const alteracoes = [...antes, ...await pendentes(conta, treino)];
  return atualizarCopia(disco, baseInicial, (atuais) => {
    // Uma segunda aba pode ter gravado e esvaziado sua fila durante este GET.
    // Preserve os slots que ela alterou e aceite as demais posições do servidor.
    for (const original of new Set([...Object.keys(baseInicial), ...Object.keys(atuais)])) {
      if (baseInicial[original] !== atuais[original]) {
        alteracoes.push({ original, substituto: atuais[original] ?? null });
      }
    }
    return aplicar(remotas, alteracoes);
  }, sinal);
}

export function useTrocasDoPrograma(conta?: string | null, treino?: string | null) {
  const cliente = useQueryClient();
  return useQuery<Trocas>({
    queryKey: chaveDasTrocas(conta, treino),
    enabled: Boolean(conta && treino),
    networkMode: "always",
    refetchOnMount: "always",
    retry: false,
    queryFn: ({ signal }) => conta && treino ? lerTrocasDoPrograma(cliente, conta, treino, signal) : {},
  });
}

export async function salvarTrocaDoPrograma(cliente: QueryClient, conta: string, treino: string,
  original: string, substituto: string | null): Promise<void> {
  if (!conta || !treino || !original || (substituto !== null && !trocaDoProgramaValida(treino, original, substituto))) {
    throw new Error("Esta alternativa não pode ser lembrada nessa posição do treino.");
  }
  const chave = chaveDasTrocas(conta, treino);
  const filtro = { user_id: conta, workout_id: treino, exercicio_original_id: original };
  await cliente.cancelQueries({ queryKey: chave, exact: true });
  const escrita: EscritaTabela = substituto === null ? { tabela: TABELA, op: "delete", filtro } : {
    tabela: TABELA, op: "upsert", onConflict: CHAVE_PRIMARIA, linha: { ...filtro, substituto_id: substituto },
  };
  const base = cliente.getQueryData<Trocas>(chave) ?? {};
  const banco = bd();
  const mapa = await banco.transaction("rw", banco.cache, banco.outbox, async () => {
    await guardarNaFila("troca_do_programa", escrita, alvoDaEscrita(escrita));
    return gravarCopia(JSON.stringify(chave), base, (salvas) => aplicar(salvas, [{ original, substituto }]));
  });
  cliente.setQueryData(chave, mapa);
  void processar();
}

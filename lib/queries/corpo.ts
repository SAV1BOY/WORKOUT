/**
 * Corpo (SPEC §3.8): ler peso, medidas e fotos, e gravar tudo pela fila de
 * saída (SPEC §8). Nada grava direto no Supabase — a tela responde offline e
 * a fila entrega quando a rede voltar. Os ids são gerados no cliente.
 */
"use client";

import { useQuery, type QueryClient, type UseQueryResult } from "@tanstack/react-query";
import { caminhoDaFoto, type FotoBruta, type MedidasBrutas, type PesoBruto } from "@/lib/corpo";
import { bd, temIndexedDB } from "@/lib/db";
import { reduzirFoto } from "@/lib/imagem";
import { enfileirarArquivo, enfileirarEscrita } from "@/lib/outbox-supabase";
import { chaves } from "@/lib/queries/dados";
import { lerLista } from "@/lib/queries/ler";
import { clienteNavegador } from "@/lib/supabase/client";
import type { AnguloFoto, LinhaMedidas, LinhaPeso } from "@/lib/types";

/** O bucket privado do schema (`storage.buckets` em supabase/schema.sql). */
export const BUCKET_FOTOS = "progresso";
/** Validade da URL assinada de cada foto. */
export const SEGUNDOS_DA_URL = 60 * 60;

export const chavesCorpo = {
  pesos: () => ["corpo", "pesos"] as const,
  medidas: () => ["corpo", "medidas"] as const,
  fotos: () => ["corpo", "fotos"] as const,
  urls: (caminhos: readonly string[]) =>
    ["corpo", "fotos-url", [...caminhos].sort().join("|")] as const,
};

/** Id novo, gerado no cliente (SPEC §8). */
export function novoId(): string {
  return crypto.randomUUID();
}

/* ------------------------------------------------------------ leitura */

export function usePesos(): UseQueryResult<PesoBruto[]> {
  return useQuery({
    queryKey: chavesCorpo.pesos(),
    queryFn: () =>
      lerLista<PesoBruto>(
        clienteNavegador()
          .from("body_weights")
          .select("data,peso_kg")
          .order("data", { ascending: true }),
        "as suas pesagens",
      ),
  });
}

export function useMedidas(): UseQueryResult<MedidasBrutas[]> {
  return useQuery({
    queryKey: chavesCorpo.medidas(),
    queryFn: () =>
      lerLista<MedidasBrutas>(
        clienteNavegador()
          .from("body_measurements")
          .select(
            "data,cintura_cm,peito_cm,quadril_cm,braco_dir_cm,braco_esq_cm,coxa_dir_cm,coxa_esq_cm,panturrilha_cm",
          )
          .order("data", { ascending: true }),
        "as suas medidas",
      ),
  });
}

export function useFotos(): UseQueryResult<FotoBruta[]> {
  return useQuery({
    queryKey: chavesCorpo.fotos(),
    queryFn: () =>
      lerLista<FotoBruta>(
        clienteNavegador()
          .from("progress_photos")
          .select("id,data,angulo,storage_path")
          .order("data", { ascending: false }),
        "as suas fotos",
      ),
  });
}

/* ----------------------------------------------------- URLs das fotos */

/** Blobs que ainda não subiram: um object URL por caminho, criado uma vez. */
const urlsLocais = new Map<string, string>();

async function urlDaFoto(caminho: string): Promise<string | null> {
  // 1) ainda no aparelho (sem rede, ou subindo agora): mostra o blob local
  if (temIndexedDB()) {
    const jaFeita = urlsLocais.get(caminho);
    if (jaFeita) return jaFeita;
    const pendente = await bd().fotos.get(caminho).catch(() => undefined);
    if (pendente) {
      const url = URL.createObjectURL(pendente.blob);
      urlsLocais.set(caminho, url);
      return url;
    }
  }
  // 2) no bucket privado: URL assinada (SPEC §3.8)
  const { data, error } = await clienteNavegador()
    .storage.from(BUCKET_FOTOS)
    .createSignedUrl(caminho, SEGUNDOS_DA_URL);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Uma URL exibível por caminho do bucket (assinada ou local). */
export function useUrlsDasFotos(
  caminhos: readonly string[],
): UseQueryResult<Record<string, string>> {
  return useQuery({
    queryKey: chavesCorpo.urls(caminhos),
    enabled: caminhos.length > 0,
    // a URL assinada vale 1 h; não adianta reassinar a cada foco
    staleTime: (SEGUNDOS_DA_URL - 300) * 1000,
    queryFn: async () => {
      const saida: Record<string, string> = {};
      for (const caminho of caminhos) {
        const url = await urlDaFoto(caminho);
        if (url) saida[caminho] = url;
      }
      return saida;
    },
  });
}

/* ------------------------------------------------------------ escrita */

/** Peso do dia (SPEC §3.8): `unique (user_id, data)`, então é upsert. */
export async function registrarPeso(opcoes: {
  userId: string;
  data: string;
  pesoKg: number;
  notas?: string | null;
  cliente: QueryClient;
}): Promise<void> {
  const { userId, data, pesoKg, notas = null, cliente } = opcoes;

  cliente.setQueryData<PesoBruto[]>(chavesCorpo.pesos(), (atual) => {
    const semODia = (atual ?? []).filter((p) => p.data !== data);
    return [...semODia, { data, peso_kg: pesoKg }].sort((a, b) =>
      a.data.localeCompare(b.data),
    );
  });
  // a Hoje mostra a última pesagem (§3.1)
  cliente.setQueryData<Pick<LinhaPeso, "data" | "peso_kg">[]>(chaves.peso(), (atual) => {
    const ultimo = atual?.[0];
    return !ultimo || data >= ultimo.data ? [{ data, peso_kg: pesoKg }] : atual;
  });

  await enfileirarEscrita("peso", {
    tabela: "body_weights",
    op: "upsert",
    linha: { id: novoId(), user_id: userId, data, peso_kg: pesoKg, notas },
    onConflict: "user_id,data",
  });
}

export type ValoresDeMedida = Partial<Omit<LinhaMedidas, "id" | "user_id" | "data" | "created_at">>;

/** Medidas do dia (SPEC §3.8): também `unique (user_id, data)`. */
export async function registrarMedidas(opcoes: {
  userId: string;
  data: string;
  valores: ValoresDeMedida;
  cliente: QueryClient;
}): Promise<void> {
  const { userId, data, valores, cliente } = opcoes;

  cliente.setQueryData<MedidasBrutas[]>(chavesCorpo.medidas(), (atual) => {
    const antiga = (atual ?? []).find((m) => m.data === data);
    const nova = { ...(antiga ?? { data }), ...valores, data } as MedidasBrutas;
    return [...(atual ?? []).filter((m) => m.data !== data), nova].sort((a, b) =>
      a.data.localeCompare(b.data),
    );
  });

  await enfileirarEscrita("medidas", {
    tabela: "body_measurements",
    op: "upsert",
    linha: { id: novoId(), user_id: userId, data, ...valores },
    onConflict: "user_id,data",
  });
}

/**
 * Foto de progresso (SPEC §3.8): reduz para ≤ 1600 px no aparelho, guarda o
 * blob no Dexie, e só então enfileira o envio ao bucket e a linha da tabela.
 * A galeria já mostra a foto — mesmo sem rede.
 */
export async function enviarFoto(opcoes: {
  userId: string;
  data: string;
  angulo: AnguloFoto;
  arquivo: Blob;
  cliente: QueryClient;
  /** A linha que já existe para este dia e ângulo (troca a foto). */
  existente?: FotoBruta | null;
}): Promise<FotoBruta> {
  const { userId, data, angulo, arquivo, cliente, existente = null } = opcoes;

  const blob = await reduzirFoto(arquivo);
  const caminho = caminhoDaFoto(userId, data, angulo);

  if (temIndexedDB()) {
    await bd().fotos.put({ caminho, blob, data, angulo, criadoEm: Date.now() });
  }
  // uma foto nova no mesmo caminho: a URL velha não serve mais
  const urlVelha = urlsLocais.get(caminho);
  if (urlVelha) {
    URL.revokeObjectURL(urlVelha);
    urlsLocais.delete(caminho);
  }

  const linha: FotoBruta = {
    id: existente?.id ?? novoId(),
    data,
    angulo,
    storage_path: caminho,
  };

  cliente.setQueryData<FotoBruta[]>(chavesCorpo.fotos(), (atual) => {
    const semEsta = (atual ?? []).filter(
      (f) => !(f.data === data && f.angulo === angulo),
    );
    return [linha, ...semEsta].sort((a, b) => b.data.localeCompare(a.data));
  });
  // as URLs são recalculadas (a nova sai do blob local)
  void cliente.invalidateQueries({ queryKey: ["corpo", "fotos-url"] });

  await enfileirarArquivo({ bucket: BUCKET_FOTOS, caminho, contentType: blob.type });
  await enfileirarEscrita("foto", {
    tabela: "progress_photos",
    op: "upsert",
    linha: { ...linha, user_id: userId },
    onConflict: "id",
  });

  return linha;
}

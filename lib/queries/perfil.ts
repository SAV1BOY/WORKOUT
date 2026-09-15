/**
 * Perfil do usuário: seed a partir de data/perfil.json no primeiro acesso.
 * A parte pura (montar o seed, decidir se precisa) é testada com Vitest.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CAMPO_DA_SEMANA, type AvancoDeSemana, type PlanoSemanal } from "@/lib/cardio";
import { cardio, perfilInicial } from "@/lib/dados";
import type { Perfil } from "@/lib/schemas";
import type { LinhaPerfil, Prefs } from "@/lib/types";

/** O teto de cada plano (as 12 semanas de `data/cardio.json`). */
function maximoDoPlano(plano: PlanoSemanal): number {
  if (plano === "corrida") return cardio.corrida.semanas.length;
  return 12;
}

export interface SeedPerfil {
  nome: string;
  altura_cm: number;
  data_inicio: string;
  fase_atual: Perfil["fase_inicial"];
  fase_desde: string;
}

/** Monta o seed do perfil a partir do JSON (função pura). */
export function montarSeedPerfil(perfil: Perfil = perfilInicial): SeedPerfil {
  return {
    nome: perfil.nome,
    altura_cm: perfil.altura_cm,
    data_inicio: perfil.data_inicio,
    fase_atual: perfil.fase_inicial,
    fase_desde: perfil.data_inicio,
  };
}

/**
 * Só faz seed enquanto o perfil ainda está como o banco criou:
 * sem linha, sem altura ou sem nome. Depois disso o que vale é o que o
 * usuário editou no app.
 */
export function precisaSeed(linha: LinhaPerfil | null | undefined): boolean {
  if (!linha) return true;
  if (linha.altura_cm === null || linha.altura_cm === undefined) return true;
  if (!linha.nome || linha.nome.trim() === "") return true;
  return false;
}

/** Lê o perfil e, se ainda estiver no padrão, grava o seed. */
export async function garantirPerfil(
  supabase: SupabaseClient,
  userId: string,
): Promise<LinhaPerfil | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<LinhaPerfil>();

  if (error) return null;
  if (!precisaSeed(data)) return data;

  const { data: gravado, error: erroGravar } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ...montarSeedPerfil() }, { onConflict: "user_id" })
    .select("*")
    .maybeSingle<LinhaPerfil>();

  if (erroGravar) return data;
  return gravado ?? data;
}

/* ------------------------------------- semanas dos planos (SPEC §5.5) */

/**
 * Ajuste manual da semana de um plano: "repetir semana" (−1) e "avançar
 * semana" (+1), presos entre 1 e o teto do plano. Função pura — o botão vive
 * no perfil (marco 6) e a regra automática está em `lib/cardio.ts`.
 */
export function ajustarSemana(
  atual: number,
  direcao: 1 | -1,
  maximo = 12,
): number {
  const alvo = Math.round(atual) + direcao;
  return Math.min(Math.max(alvo, 1), Math.max(1, Math.round(maximo)));
}

/** Os campos de `profiles` que o app escreve, tipados. */
export interface MudancaDePerfil {
  nome?: string;
  altura_cm?: number | null;
  data_inicio?: string;
  fase_atual?: Perfil["fase_inicial"];
  fase_desde?: string;
  semana_corrida?: number;
  semana_corda?: number;
  semana_fixa?: number;
  prefs?: Prefs;
}

/**
 * Grava uma mudança do perfil pela fila de saída (SPEC §8) e atualiza o cache
 * do TanStack Query na mesma chamada, para a tela responder sem rede.
 *
 * O import da fila é dinâmico de propósito: este módulo também roda no
 * servidor (`garantirPerfil` no layout) e a fila é do navegador (Dexie).
 */
export async function gravarPerfil(opcoes: {
  userId: string;
  mudanca: MudancaDePerfil;
  cliente: QueryClient;
}): Promise<void> {
  const { userId, mudanca, cliente } = opcoes;
  if (Object.keys(mudanca).length === 0) return;

  // a chave de `lib/queries/dados.ts` (`chaves.perfil()`), escrita à mão: aquele
  // módulo é "use client" e este também roda no servidor.
  cliente.setQueryData<LinhaPerfil | null>(["perfil"], (atual) =>
    atual ? { ...atual, ...mudanca } : atual,
  );

  const { enfileirarEscrita } = await import("@/lib/outbox-supabase");
  await enfileirarEscrita("perfil", {
    tabela: "profiles",
    op: "update",
    linha: { ...mudanca },
    filtro: { user_id: userId },
  });
}

/** "Repetir semana" do perfil (marco 6): volta um degrau no plano. */
export async function repetirSemana(opcoes: {
  userId: string;
  plano: PlanoSemanal;
  perfil: LinhaPerfil;
  cliente: QueryClient;
}): Promise<void> {
  await mexerNaSemana({ ...opcoes, direcao: -1 });
}

/** "Avançar semana" do perfil (marco 6): sobe um degrau no plano. */
export async function avancarSemana(opcoes: {
  userId: string;
  plano: PlanoSemanal;
  perfil: LinhaPerfil;
  cliente: QueryClient;
}): Promise<void> {
  await mexerNaSemana({ ...opcoes, direcao: 1 });
}

async function mexerNaSemana(opcoes: {
  userId: string;
  plano: PlanoSemanal;
  perfil: LinhaPerfil;
  direcao: 1 | -1;
  cliente: QueryClient;
}): Promise<void> {
  const { plano, perfil, direcao } = opcoes;
  const campo = CAMPO_DA_SEMANA[plano] as keyof MudancaDePerfil;
  const atual = Number(perfil[campo as keyof LinhaPerfil] ?? 1);
  const nova = ajustarSemana(atual, direcao, maximoDoPlano(plano));
  if (nova === atual) return;
  await gravarPerfil({
    userId: opcoes.userId,
    mudanca: { [campo]: nova } as MudancaDePerfil,
    cliente: opcoes.cliente,
  });
}

/** Aplica o avanço automático da §5.5 (calculado em `lib/cardio.ts`). */
export async function aplicarAvanco(opcoes: {
  userId: string;
  avanco: AvancoDeSemana;
  cliente: QueryClient;
}): Promise<void> {
  const { avanco } = opcoes;
  await gravarPerfil({
    userId: opcoes.userId,
    mudanca: {
      [avanco.campo]: avanco.semana,
      prefs: avanco.prefs,
    } as MudancaDePerfil,
    cliente: opcoes.cliente,
  });
}

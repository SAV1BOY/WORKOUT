/**
 * Perfil do usuário: seed a partir de data/perfil.json no primeiro acesso.
 * A parte pura (montar o seed, decidir se precisa) é testada com Vitest.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { perfilInicial } from "@/lib/dados";
import type { Perfil } from "@/lib/schemas";
import type { LinhaPerfil } from "@/lib/types";

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

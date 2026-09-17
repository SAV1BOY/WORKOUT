/**
 * A cota de contas (SPEC §21): ler quantas contas existem, quantas cabem,
 * quem são elas e mudar o limite.
 *
 * Tudo passa pelas funções de `supabase/schema.sql` — `vagas_para_conta()`,
 * `contas_cadastradas()` — e pela tabela `app_config`, protegida por
 * `sou_o_dono()`. O cliente entra por parâmetro (o do servidor na tela de
 * login, o do navegador na tela Contas), então este arquivo não importa
 * `next/headers` nem React: dá para testar com um cliente de mentira.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Os dois números que a tela de login precisa. */
export interface Vagas {
  contas: number;
  limite: number;
}

/** Uma conta na lista de Mais → Contas. */
export interface ContaCadastrada {
  email: string;
  criada_em: string;
  ultimo_acesso: string | null;
}

/** Os limites do stepper de Mais → Contas (SPEC §21.3). */
export const LIMITE_MINIMO = 1;
export const LIMITE_MAXIMO = 99;

/**
 * O `jsonb` de `vagas_para_conta()` virando dois números — ou `null` quando o
 * que voltou não serve. Função pura: é aqui que a resposta do banco é
 * conferida antes de a tela acreditar nela.
 */
export function lerVagas(bruto: unknown): Vagas | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const { contas, limite } = bruto as { contas?: unknown; limite?: unknown };
  if (typeof contas !== "number" || typeof limite !== "number") return null;
  if (!Number.isFinite(contas) || !Number.isFinite(limite)) return null;
  return { contas, limite };
}

/**
 * Ainda cabe alguém?
 *
 * **Sem resposta do banco a porta fica aberta** (`null` → `true`): se o RPC
 * falhar — sem rede, função ainda não aplicada — a tela de login mostra os
 * dois botões e deixa o trigger `on_auth_user_vaga` decidir. O contrário
 * (esconder "Criar conta" no escuro) esconderia também o problema.
 */
export function haVaga(vagas: Vagas | null): boolean {
  if (vagas === null) return true;
  return vagas.contas < vagas.limite;
}

/** Quantas contas existem e quantas cabem. `null` = não deu para saber. */
export async function vagasParaConta(
  supabase: SupabaseClient,
): Promise<Vagas | null> {
  try {
    const { data, error } = await supabase.rpc("vagas_para_conta");
    if (error) return null;
    return lerVagas(data);
  } catch {
    // rede fora, função ausente, projeto mal configurado: quem decide é o banco
    return null;
  }
}

/**
 * As contas do app, na ordem de criação. Para quem não é o dono a função do
 * banco devolve zero linhas — a tela não depende só de esconder o link.
 */
export async function contasCadastradas(
  supabase: SupabaseClient,
): Promise<ContaCadastrada[]> {
  const { data, error } = await supabase.rpc("contas_cadastradas");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as ContaCadastrada[]) : [];
}

/** Prende o limite digitado na faixa que o banco aceita (1–99). */
export function limiteValido(valor: number): number {
  const inteiro = Math.round(valor);
  if (!Number.isFinite(inteiro)) return LIMITE_MINIMO;
  return Math.min(LIMITE_MAXIMO, Math.max(LIMITE_MINIMO, inteiro));
}

/**
 * Sobe o novo limite. Passa pela RLS de `app_config`: só o dono tem policy,
 * então de qualquer outra conta isto não muda nada.
 */
export async function salvarLimiteDeContas(
  supabase: SupabaseClient,
  limite: number,
): Promise<void> {
  const { error } = await supabase
    .from("app_config")
    .update({ max_contas: limiteValido(limite) })
    .eq("id", true);
  if (error) throw new Error(error.message);
}

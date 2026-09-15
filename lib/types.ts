/**
 * Tipos das linhas de supabase/schema.sql (o banco guarda só o que o usuário faz).
 * Se o schema mudar, mude aqui junto.
 */
import type {
  Assistencia,
  FaseId,
  PrescricaoTipo,
  TreinoId,
} from "@/lib/schemas";

export type StatusSessao = "em_andamento" | "concluida" | "abandonada";
/**
 * `sessions.workout_id`: um treino do programa, "livre" (treino fora do plano)
 * ou "fixa" — a sessão de barra fixa da SPEC §3.4, que não é um treino do
 * programa. A coluna é `text` no schema.
 */
export type WorkoutId = TreinoId | "livre" | "fixa";
export type TipoSerie = "aquecimento" | "trabalho";
export type TipoCardio = "corrida" | "corda" | "caminhada" | "outro";
export type Esforco = "facil" | "moderado" | "forte";
export type AnguloFoto = "frente" | "lado" | "costas";
export type MotivoProgressao =
  | "subiu"
  | "repetiu"
  | "falha_2x_voltou_10"
  | "semana_leve_60"
  | "fim_semana_leve"
  | "trocou_assistencia"
  | "manual"
  | "trocou_fase";

export interface Prefs {
  tema?: "auto" | "claro" | "escuro";
  descanso_som?: boolean;
  descanso_vibra?: boolean;
  manter_tela?: boolean;
  [chave: string]: unknown;
}

export interface LinhaPerfil {
  user_id: string;
  nome: string;
  altura_cm: number | null;
  data_inicio: string;
  fase_atual: FaseId;
  fase_desde: string;
  objetivo: string;
  semana_corrida: number;
  semana_corda: number;
  semana_fixa: number;
  ultimo_treino: TreinoId | null;
  prefs: Prefs;
  created_at?: string;
  updated_at?: string;
}

export interface LinhaEstadoExercicio {
  user_id: string;
  exercise_id: string;
  carga_atual_kg: number | null;
  reps_alvo: number | null;
  tempo_alvo_s: number | null;
  assistencia: Assistencia | null;
  incremento_kg: number | null;
  falhas_seguidas: number;
  incremento_reduzido: boolean;
  exigir_rep_extra: boolean;
  semana_leve: boolean;
  carga_antes_leve: number | null;
  sessoes_graca: number;
  desativado: boolean;
  notas: string | null;
  updated_at?: string;
}

export interface LinhaSessao {
  id: string;
  user_id: string;
  data: string;
  workout_id: WorkoutId;
  fase: FaseId;
  status: StatusSessao;
  iniciada_em: string;
  concluida_em: string | null;
  duracao_s: number | null;
  /** Sessão de barra fixa (§3.4): a semana do plano em que ela foi criada. */
  semana_plano: number | null;
  /**
   * Sessão livre e ordem desta sessão (SPEC §13.4 e §14.3): a lista de
   * exercícios e prescrições com que a sessão nasceu. É ela que refaz uma
   * sessão livre noutro aparelho — um `workout_id = 'livre'` não tem lista em
   * lugar nenhum. `null` numa sessão do programa = a ordem é a do programa.
   */
  plano: PlanoDaSessao | null;
  sensacao: number | null;
  peso_corporal: number | null;
  notas: string | null;
  created_at?: string;
}

/** Um exercício dentro de `sessions.plano` (jsonb). */
export interface ItemDoPlano {
  exercicio_id: string;
  series: number;
  tipo: PrescricaoTipo;
  min: number | null;
  max: number | null;
  unilateral: boolean;
  descanso_s: number;
  descanso_texto: string;
}

/** `sessions.plano` (jsonb): de onde a sessão veio e o que ela tem. */
export interface PlanoDaSessao {
  /** Rótulo da coleção que gerou a sessão ("Core no tatame"), ou `null`. */
  titulo: string | null;
  /** Id da coleção derivada que gerou a sessão ("grupo:Core"), ou `null`. */
  colecao: string | null;
  itens: ItemDoPlano[];
}

export interface LinhaSerie {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string;
  ordem_ex: number;
  set_index: number;
  tipo: TipoSerie;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  reps: number | null;
  reps_lado2: number | null;
  carga_kg: number | null;
  tempo_s: number | null;
  tempo_s_lado2: number | null;
  passos: number | null;
  assistencia: Assistencia | null;
  concluida: boolean;
  ultima_firme: boolean | null;
  rpe: number | null;
  registrada_em: string;
}

export interface LinhaEventoProgressao {
  id: string;
  user_id: string;
  /** `null` = evento do programa inteiro (a troca de fase, SPEC §5.1). */
  exercise_id: string | null;
  session_id: string | null;
  data: string;
  de: Record<string, unknown> | null;
  para: Record<string, unknown> | null;
  motivo: MotivoProgressao;
  created_at?: string;
}

export interface LinhaSessaoCardio {
  id: string;
  user_id: string;
  data: string;
  tipo: TipoCardio;
  semana_plano: number | null;
  planejado: unknown;
  feito: unknown;
  duracao_min: number | null;
  distancia_km: number | null;
  saltos: number | null;
  esforco: Esforco | null;
  concluida: boolean;
  notas: string | null;
  created_at?: string;
}

export interface LinhaBarraFixaSolta {
  id: string;
  user_id: string;
  data: string;
  reps: number;
  assistencia: Assistencia | null;
  created_at?: string;
}

export interface LinhaPeso {
  id: string;
  user_id: string;
  data: string;
  peso_kg: number;
  notas: string | null;
  created_at?: string;
}

export interface LinhaMedidas {
  id: string;
  user_id: string;
  data: string;
  cintura_cm: number | null;
  peito_cm: number | null;
  quadril_cm: number | null;
  braco_dir_cm: number | null;
  braco_esq_cm: number | null;
  coxa_dir_cm: number | null;
  coxa_esq_cm: number | null;
  panturrilha_cm: number | null;
  notas: string | null;
  created_at?: string;
}

export interface LinhaFotoProgresso {
  id: string;
  user_id: string;
  data: string;
  angulo: AnguloFoto;
  storage_path: string;
  notas: string | null;
  created_at?: string;
}

export interface LinhaExcecaoAgenda {
  id: string;
  user_id: string;
  data: string;
  tipo: "forca" | "cardio" | "descanso";
  workout_id: TreinoId | null;
  sessao: string | null;
  motivo: string | null;
}

export interface LinhaRecorde {
  user_id: string;
  exercise_id: string;
  carga_max_kg: number | null;
  e1rm_epley: number | null;
  reps_max: number | null;
  tempo_max_s: number | null;
}

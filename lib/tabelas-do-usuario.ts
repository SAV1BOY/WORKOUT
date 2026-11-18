/** As 11 tabelas de `supabase/schema.sql` que pertencem ao usuário. */
export const TABELAS_BACKUP = [
  "profiles",
  "exercise_state",
  "sessions",
  "session_sets",
  "progression_events",
  "cardio_sessions",
  "pullup_singles",
  "body_weights",
  "body_measurements",
  "progress_photos",
  "schedule_overrides",
] as const;

export type TabelaBackup = (typeof TABELAS_BACKUP)[number];

/** A chave primária de cada tabela (o que torna a importação idempotente). */
export const CHAVE_DA_TABELA: Record<TabelaBackup, string[]> = {
  profiles: ["user_id"],
  exercise_state: ["user_id", "exercise_id"],
  sessions: ["id"],
  session_sets: ["id"],
  progression_events: ["id"],
  cardio_sessions: ["id"],
  pullup_singles: ["id"],
  body_weights: ["id"],
  body_measurements: ["id"],
  progress_photos: ["id"],
  schedule_overrides: ["id"],
};

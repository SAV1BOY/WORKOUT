/**
 * Backup (SPEC §9): exportar um JSON com tudo que é do usuário e importar de
 * volta — **idempotente por id**, então importar duas vezes o mesmo arquivo
 * deixa o banco igual.
 *
 * Funções puras: montar o arquivo, ler e validar o que veio, dizer o que vai
 * entrar e transformar isso em escritas. Quem fala com o Supabase é
 * `lib/queries/mais.ts`; quem guarda offline é a fila de saída (§8).
 */
import { z } from "zod";
import { ANGULOS, caminhoDaFoto } from "@/lib/corpo";

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

export type Linha = Record<string, unknown>;

/** Nome em português de cada tabela, para a prévia da importação. */
export const NOME_DA_TABELA: Record<TabelaBackup, string> = {
  profiles: "perfil",
  exercise_state: "estado dos exercícios",
  sessions: "treinos",
  session_sets: "séries",
  progression_events: "eventos de progressão",
  cardio_sessions: "sessões de cardio",
  pullup_singles: "repetições soltas",
  body_weights: "pesagens",
  body_measurements: "medidas",
  progress_photos: "fotos de progresso",
  schedule_overrides: "trocas do calendário",
};

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

/**
 * As colunas de cada tabela em `supabase/schema.sql`. O arquivo importado pode
 * vir de uma versão antiga (ou ter sido editado à mão): o que não é coluna é
 * descartado em vez de derrubar a escrita inteira.
 */
export const COLUNAS_DA_TABELA: Record<TabelaBackup, string[]> = {
  profiles: [
    "user_id", "nome", "altura_cm", "data_inicio", "fase_atual", "fase_desde",
    "objetivo", "semana_corrida", "semana_corda", "semana_fixa", "ultimo_treino",
    "prefs",
  ],
  exercise_state: [
    "user_id", "exercise_id", "carga_atual_kg", "reps_alvo", "tempo_alvo_s",
    "assistencia", "incremento_kg", "falhas_seguidas", "incremento_reduzido",
    "exigir_rep_extra", "semana_leve", "carga_antes_leve", "sessoes_graca",
    "desativado", "notas",
  ],
  sessions: [
    "id", "user_id", "data", "workout_id", "fase", "status", "iniciada_em",
    "concluida_em", "duracao_s", "semana_plano", "plano", "sensacao", "peso_corporal",
    "notas",
  ],
  session_sets: [
    "id", "session_id", "user_id", "exercise_id", "ordem_ex", "set_index",
    "tipo", "reps_alvo_min", "reps_alvo_max", "reps", "reps_lado2", "carga_kg",
    "tempo_s", "tempo_s_lado2", "passos", "assistencia", "concluida",
    "ultima_firme", "rpe", "registrada_em",
  ],
  progression_events: [
    "id", "user_id", "exercise_id", "session_id", "data", "de", "para", "motivo",
  ],
  cardio_sessions: [
    "id", "user_id", "data", "tipo", "semana_plano", "planejado", "feito",
    "duracao_min", "distancia_km", "saltos", "esforco", "concluida", "notas",
  ],
  pullup_singles: ["id", "user_id", "data", "reps", "assistencia"],
  body_weights: ["id", "user_id", "data", "peso_kg", "notas"],
  body_measurements: [
    "id", "user_id", "data", "cintura_cm", "peito_cm", "quadril_cm",
    "braco_dir_cm", "braco_esq_cm", "coxa_dir_cm", "coxa_esq_cm",
    "panturrilha_cm", "notas",
  ],
  progress_photos: ["id", "user_id", "data", "angulo", "storage_path", "notas"],
  schedule_overrides: [
    "id", "user_id", "data", "tipo", "workout_id", "sessao", "motivo",
  ],
};

export const APP_BACKUP = "treino-terraco";
export const VERSAO_BACKUP = 1;

export interface Backup {
  app: string;
  versao: number;
  exportado_em: string;
  user_id: string | null;
  tabelas: Partial<Record<TabelaBackup, Linha[]>>;
}

const linhaSchema = z.record(z.string(), z.unknown());

const backupSchema = z.object({
  app: z.string(),
  versao: z.number().int().positive(),
  exportado_em: z.string(),
  user_id: z.string().nullable().optional(),
  tabelas: z.record(z.string(), z.array(linhaSchema)),
});

/* ------------------------------------------------------------ exportar */

export function montarBackup(entrada: {
  userId: string | null;
  exportadoEm: string;
  tabelas: Partial<Record<TabelaBackup, Linha[]>>;
}): Backup {
  const tabelas: Partial<Record<TabelaBackup, Linha[]>> = {};
  for (const tabela of TABELAS_BACKUP) {
    tabelas[tabela] = entrada.tabelas[tabela] ?? [];
  }
  return {
    app: APP_BACKUP,
    versao: VERSAO_BACKUP,
    exportado_em: entrada.exportadoEm,
    user_id: entrada.userId,
    tabelas,
  };
}

/** `treino-terraco-2026-09-15.json` — a data no nome, como pede a §3.9. */
export function nomeDoArquivoBackup(data: string): string {
  const dia = data.slice(0, 10);
  return `${APP_BACKUP}-${dia}.json`;
}

export function textoDoBackup(backup: Backup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function contarLinhas(backup: Backup): number {
  return TABELAS_BACKUP.reduce(
    (soma, t) => soma + (backup.tabelas[t]?.length ?? 0),
    0,
  );
}

/* ------------------------------------------------------------ importar */

function ehTabela(nome: string): nome is TabelaBackup {
  return (TABELAS_BACKUP as readonly string[]).includes(nome);
}

/**
 * Lê e valida o arquivo. Lança um `Error` com a mensagem que a tela mostra —
 * nunca devolve um backup pela metade.
 */
export function lerBackup(texto: string): Backup {
  let cru: unknown;
  try {
    cru = JSON.parse(texto);
  } catch {
    throw new Error("Este arquivo não é um JSON válido.");
  }

  const r = backupSchema.safeParse(cru);
  if (!r.success) {
    throw new Error("Este arquivo não parece um backup do Treino do Terraço.");
  }
  if (r.data.app !== APP_BACKUP) {
    throw new Error("Este backup é de outro app.");
  }
  if (r.data.versao > VERSAO_BACKUP) {
    throw new Error(
      `Este backup é da versão ${r.data.versao} e o app lê até a ${VERSAO_BACKUP}.`,
    );
  }

  const tabelas: Partial<Record<TabelaBackup, Linha[]>> = {};
  for (const [nome, linhas] of Object.entries(r.data.tabelas)) {
    if (ehTabela(nome)) tabelas[nome] = linhas;
  }

  return {
    app: r.data.app,
    versao: r.data.versao,
    exportado_em: r.data.exportado_em,
    user_id: r.data.user_id ?? null,
    tabelas,
  };
}

/** A identidade da linha na tabela; `null` quando falta parte da chave. */
export function chaveDaLinha(tabela: TabelaBackup, linha: Linha): string | null {
  const colunas = CHAVE_DA_TABELA[tabela];
  const partes: string[] = [];
  for (const coluna of colunas) {
    const valor = linha[coluna];
    if (valor === null || valor === undefined || valor === "") return null;
    partes.push(String(valor));
  }
  return partes.join("|");
}

export interface ItemPrevia {
  tabela: TabelaBackup;
  nome: string;
  /** Linhas do arquivo (já sem as repetidas e sem as que não têm chave). */
  total: number;
  novas: number;
  atualizadas: number;
  /** Linhas descartadas por não terem a chave primária. */
  invalidas: number;
}

export interface Previa {
  itens: ItemPrevia[];
  total: number;
  novas: number;
  atualizadas: number;
  invalidas: number;
}

/**
 * O que vai entrar, comparando com o que já existe no banco (SPEC §3.9: a
 * importação mostra a prévia antes). Idempotente: o que já está lá com a mesma
 * chave conta como "atualizada", não como linha nova.
 */
export function previaDaImportacao(
  backup: Backup,
  existentes: Partial<Record<TabelaBackup, Linha[]>> = {},
): Previa {
  const itens: ItemPrevia[] = [];

  for (const tabela of TABELAS_BACKUP) {
    const linhas = backup.tabelas[tabela] ?? [];
    if (linhas.length === 0) continue;

    const jaTem = new Set<string>();
    for (const linha of existentes[tabela] ?? []) {
      const chave = chaveDaLinha(tabela, linha);
      if (chave !== null) jaTem.add(chave);
    }

    const vistas = new Set<string>();
    let novas = 0;
    let atualizadas = 0;
    let invalidas = 0;

    for (const linha of linhas) {
      const chave = chaveDaLinha(tabela, linha);
      if (chave === null) {
        invalidas += 1;
        continue;
      }
      // o arquivo pode repetir a mesma linha: ela entra uma vez só
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      if (jaTem.has(chave)) atualizadas += 1;
      else novas += 1;
    }

    if (novas + atualizadas + invalidas === 0) continue;
    itens.push({
      tabela,
      nome: NOME_DA_TABELA[tabela],
      total: novas + atualizadas,
      novas,
      atualizadas,
      invalidas,
    });
  }

  return {
    itens,
    total: itens.reduce((s, i) => s + i.total, 0),
    novas: itens.reduce((s, i) => s + i.novas, 0),
    atualizadas: itens.reduce((s, i) => s + i.atualizadas, 0),
    invalidas: itens.reduce((s, i) => s + i.invalidas, 0),
  };
}

export interface EscritaDeImportacao {
  tabela: TabelaBackup;
  /** Colunas do `on_conflict` do upsert (a chave primária da tabela). */
  onConflict: string;
  linhas: Linha[];
}

/**
 * Conserta (ou descarta) as duas colunas do backup que apontam para fora do
 * usuário. O resto da importação já força `user_id`, mas estas duas escapavam:
 *
 * - `progress_photos.storage_path` é copiado do arquivo, e um backup editado à
 *   mão gravaria `<outro-uid>/2026-01-01-frente.jpg`. Aqui o caminho é
 *   **reescrito** a partir do `user_id` de quem importa, da data e do ângulo —
 *   é a única forma que o bucket aceita (§9 com a policy do `schema.sql`). Sem
 *   data ou ângulo válidos a linha não descreve foto nenhuma e sai fora.
 * - `session_sets.session_id` pode referenciar a sessão de outra conta: a
 *   checagem de chave estrangeira do Postgres não passa por RLS. Só entram as
 *   séries cuja sessão vem no mesmo arquivo.
 */
function apontaParaDentro(
  tabela: TabelaBackup,
  linha: Linha,
  userId: string,
  sessoesDoArquivo: ReadonlySet<string>,
): boolean {
  if (tabela === "progress_photos") {
    const data = linha.data;
    const angulo = linha.angulo;
    if (typeof data !== "string" || data === "") return false;
    if (!(ANGULOS as readonly string[]).includes(String(angulo))) return false;
    linha.storage_path = caminhoDaFoto(userId, data, angulo as (typeof ANGULOS)[number]);
    return true;
  }
  if (tabela === "session_sets") {
    return typeof linha.session_id === "string" && sessoesDoArquivo.has(linha.session_id);
  }
  return true;
}

/**
 * As escritas da importação, na ordem em que as tabelas se referenciam
 * (`sessions` antes de `session_sets`). Cada linha sai com **o `user_id` de
 * quem está importando** — o backup pode ter vindo de outra conta (ou de outro
 * projeto Supabase), e a RLS só aceita linhas do dono (§9).
 */
export function linhasParaImportar(
  backup: Backup,
  userId: string,
): EscritaDeImportacao[] {
  const escritas: EscritaDeImportacao[] = [];
  // as sessões que o próprio arquivo traz: nada mais pode ser referenciado
  const sessoesDoArquivo = new Set(
    (backup.tabelas.sessions ?? [])
      .map((l) => l.id)
      .filter((id): id is string => typeof id === "string" && id !== ""),
  );

  for (const tabela of TABELAS_BACKUP) {
    const colunas = COLUNAS_DA_TABELA[tabela];
    const linhas: Linha[] = [];
    const vistas = new Set<string>();

    for (const bruta of backup.tabelas[tabela] ?? []) {
      const limpa: Linha = {};
      for (const coluna of colunas) {
        if (coluna in bruta) limpa[coluna] = bruta[coluna];
      }
      limpa.user_id = userId;
      if (!apontaParaDentro(tabela, limpa, userId, sessoesDoArquivo)) continue;

      const chave = chaveDaLinha(tabela, limpa);
      if (chave === null || vistas.has(chave)) continue;
      vistas.add(chave);
      linhas.push(limpa);
    }

    if (linhas.length > 0) {
      escritas.push({
        tabela,
        onConflict: CHAVE_DA_TABELA[tabela].join(","),
        linhas,
      });
    }
  }

  return escritas;
}

/** Quantas linhas por vez vão numa escrita (o PostgREST aceita em lote). */
export const LOTE_DE_IMPORTACAO = 200;

export function emLotes<T>(lista: T[], tamanho = LOTE_DE_IMPORTACAO): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) {
    lotes.push(lista.slice(i, i + tamanho));
  }
  return lotes;
}

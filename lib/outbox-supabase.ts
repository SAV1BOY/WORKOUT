/**
 * Quem sabe enviar a fila de saída para o Supabase (SPEC §8).
 * Cada item é uma escrita numa tabela do `supabase/schema.sql`; o motor da
 * fila (lib/outbox.ts) cuida de retry, backoff e volta da rede.
 *
 * Nada aqui grava direto: a tela chama `enfileirarEscrita`, que salva no
 * IndexedDB na hora e devolve. Nenhum registro se perde por falta de sinal.
 */
import {
  clienteNavegador,
  supabaseConfiguradoNoNavegador,
} from "@/lib/supabase/client";
import { enfileirar, definirEnviador, processar, type ResultadoDoEnvio } from "@/lib/outbox";
import { bd, temIndexedDB, type ItemSaida, type TipoSaida } from "@/lib/db";

export type Operacao = "insert" | "upsert" | "update" | "delete";

export interface EscritaTabela {
  /** Nome da tabela em `supabase/schema.sql`. */
  tabela: string;
  op: Operacao;
  linha?: Record<string, unknown>;
  /** Várias linhas de uma vez (importar um backup, §9). Vence `linha`. */
  linhas?: Record<string, unknown>[];
  /** Colunas da chave única, para o upsert (ex.: "user_id,data"). */
  onConflict?: string;
  /** Filtro de igualdade do update/delete (ex.: `{ id }`). */
  filtro?: Record<string, string | number | boolean>;
}

/**
 * Envio de um arquivo para o Storage (SPEC §3.8). O blob **não** viaja no
 * item da fila: ele mora em `bd().fotos` até o bucket confirmar, então a
 * galeria mostra a foto offline e o app pode fechar no meio do envio.
 */
export interface EscritaArquivo {
  bucket: string;
  /** `<user_id>/<data>-<angulo>.jpg` — a mesma chave da tabela local. */
  caminho: string;
  contentType?: string;
}

function ehEscritaArquivo(valor: unknown): valor is EscritaArquivo {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Partial<EscritaArquivo>;
  return typeof v.bucket === "string" && typeof v.caminho === "string";
}

/** Sobe o blob guardado no aparelho; some com ele só depois do sucesso. */
async function enviarArquivo(p: EscritaArquivo): Promise<void> {
  if (!temIndexedDB()) return;
  const pendente = await bd().fotos.get(p.caminho);
  // já subiu numa tentativa anterior (ou o usuário apagou): nada a fazer
  if (!pendente) return;

  const { error } = await clienteNavegador()
    .storage.from(p.bucket)
    .upload(p.caminho, pendente.blob, {
      upsert: true,
      contentType: p.contentType ?? pendente.blob.type ?? "image/jpeg",
    });
  if (error) throw new Error(error.message);

  await bd().fotos.delete(p.caminho);
}

function ehEscrita(valor: unknown): valor is EscritaTabela {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Partial<EscritaTabela>;
  return typeof v.tabela === "string" && (v.op === "insert" || v.op === "upsert" || v.op === "update" || v.op === "delete");
}

/** Envia um item da fila. Lançar aqui faz a fila tentar de novo depois. */
export async function enviarItem(item: ItemSaida): Promise<ResultadoDoEnvio> {
  const pLocal = item.payload as Record<string, unknown> | null;
  if (item.tipo === "cardio" && pLocal?.tabela === "cardio_sessions" &&
      pLocal.conciliacaoDosSaltos && !Object.hasOwn(pLocal, "op")) {
    const { enviarSaltosEmConciliacao } = await import("@/lib/saltos-pendentes");
    return enviarSaltosEmConciliacao(item);
  }
  if (item.tipo === "serie" && pLocal?.tabela === "session_sets" && !pLocal.op &&
    Array.isArray(pLocal.seriesEmConciliacao) && pLocal.seriesEmConciliacao.length &&
    (pLocal.operacaoGuardada === "upsert" || pLocal.operacaoGuardada === "insert")) {
    const { enviarContagemEmConciliacao } = await import("@/lib/contagens-pendentes");
    return enviarContagemEmConciliacao(item);
  }
  if (ehEscritaArquivo(item.payload)) {
    await enviarArquivo(item.payload);
    return;
  }
  if (!ehEscrita(item.payload)) {
    throw new Error("item da fila sem tabela ou operação");
  }
  const p = item.payload;
  /*
   * Rede de proteção: sem `.eq()` nenhum, o PostgREST aplica o update ou o
   * delete na TABELA INTEIRA (a RLS limita ao dono — que é o único usuário
   * daqui). Nenhuma escrita do app chega assim, e é exatamente por isso que
   * um item destes só pode ser bug: melhor ele ficar na fila com erro do que
   * varrer o histórico do Miguel.
   */
  if (
    (p.op === "update" || p.op === "delete") &&
    Object.keys(p.filtro ?? {}).length === 0
  ) {
    throw new Error(`escrita em ${p.tabela} sem filtro: recusada`);
  }
  const cliente = clienteNavegador();
  const apagaTroca = p.tabela === "trocas_do_programa" && p.op === "delete";
  const editaTreino = p.tabela === "sessions" && p.op === "update" &&
    typeof p.filtro?.user_id === "string" &&
    (Object.hasOwn(p.linha ?? {}, "plano") || Object.hasOwn(p.linha ?? {}, "nota_geral"));
  const editaCardio = p.tabela === "cardio_sessions" && p.op === "update" && typeof p.filtro?.user_id === "string";
  if (apagaTroca && !alvoDaEscrita(p)) throw new Error("A remoção precisa indicar uma posição do treino.");
  if (apagaTroca || editaTreino || editaCardio) {
    // Sob RLS, a conta errada receberia sucesso com zero linhas afetadas.
    const { data } = await cliente.auth.getSession();
    if (!data.session || data.session.user.id !== p.filtro?.user_id) {
      throw new Error("Aguardando a conta que alterou o treino.");
    }
  }
  const tabela = cliente.from(p.tabela);

  // uma linha ou um lote: o resto do caminho é idêntico
  const corpo: Record<string, unknown> | Record<string, unknown>[] =
    p.linhas ?? p.linha ?? {};

  if (p.op === "insert") {
    const { error } = await tabela.insert(corpo);
    if (error) throw new Error(error.message);
    return;
  }

  if (p.op === "upsert") {
    const confirmarCardios = p.tabela === "cardio_sessions" && p.linhas
      ? await (await import("@/lib/espelhos-dos-saltos")).observarCardiosDoBackup(item, p.linhas)
      : undefined;
    const gravacao = tabela.upsert(
      corpo,
      p.onConflict ? { onConflict: p.onConflict } : undefined,
    );
    if (confirmarCardios) {
      const { data, error } = await gravacao.select("*");
      if (error) throw new Error(error.message);
      await confirmarCardios(data);
      return "fila-reconciliada";
    }
    const { error } = await gravacao;
    if (error) throw new Error(error.message);
    return;
  }

  if (p.op === "update") {
    let consulta = tabela.update(p.linha ?? {});
    for (const [coluna, valor] of Object.entries(p.filtro ?? {})) {
      consulta = consulta.eq(coluna, valor);
    }
    const { error } = await consulta;
    if (error) throw new Error(error.message);
    return;
  }

  let consulta = tabela.delete();
  for (const [coluna, valor] of Object.entries(p.filtro ?? {})) {
    consulta = consulta.eq(coluna, valor);
  }
  const { error } = await consulta;
  if (error) throw new Error(error.message);
}

let registrado = false;

/**
 * Liga o enviador da fila. Idempotente; sem Supabase configurado não faz nada.
 * A conferência é a do navegador (`supabaseConfiguradoNoNavegador`): as
 * `NEXT_PUBLIC_*` não existem no bundle do cliente, a configuração chega do
 * servidor em tempo de execução.
 */
export function registrarEnviador(): void {
  if (registrado || !supabaseConfiguradoNoNavegador()) return;
  registrado = true;
  definirEnviador(enviarItem);
  // `iniciarOutbox()` pode já ter rodado sem enviador (o app abriu no /login):
  // nesse caso o flush de partida não aconteceu e o que estava na fila de uma
  // sessão anterior ficaria parado. Uma rodada aqui fecha esse buraco (§8).
  void processar();
}

/**
 * De qual linha de `sessions` esta escrita depende (SPEC §8).
 *
 * É a única dependência de ordem que existe entre as escritas do app: as três
 * tabelas abaixo apontam para `sessions.id` (chave estrangeira no
 * `supabase/schema.sql`), e a própria `sessions` tem de ser criada antes de
 * ser concluída. Devolver `undefined` quer dizer "pode ir em qualquer ordem".
 */
export function alvoDaEscrita(escrita: EscritaTabela): string | undefined {
  if (escrita.tabela === "trocas_do_programa") {
    const { user_id, workout_id, exercicio_original_id } =
      (escrita.op === "delete" ? escrita.filtro : escrita.linha) ?? {};
    if (typeof user_id === "string" && typeof workout_id === "string" && typeof exercicio_original_id === "string") {
      return `trocas_do_programa:${user_id}:${workout_id}:${exercicio_original_id}`;
    }
  }
  /*
   * `schedule_overrides` sofre a mesma inversão das sessões: marcar um dia
   * (upsert) e desmarcá-lo (delete com filtro `{data}`) na mesma janela
   * offline, com o upsert falhando uma vez, faria o delete — que não casa com
   * linha nenhuma, logo "sucesso" — sair da fila antes, e o upsert reenviado
   * ressuscitaria o dia marcado. Um alvo por **data** basta: o resto do
   * mecanismo (travados em `umaRodada`) já cuida da ordem.
   */
  if (escrita.tabela === "exercise_state") {
    const { user_id: conta, exercise_id: exercicio } = escrita.linha ?? {};
    if (typeof conta === "string" && typeof exercicio === "string") return `exercise_state:${conta}:${exercicio}`;
  }
  if (escrita.tabela === "pullup_singles") {
    const id = escrita.linha?.id ?? escrita.filtro?.id;
    if (typeof id === "string" && id) return `pullup_singles:${id}`;
  }
  if (escrita.tabela === "schedule_overrides") {
    const data = escrita.linha?.data ?? escrita.filtro?.data;
    return typeof data === "string" && data !== ""
      ? `schedule_overrides:${data}`
      : undefined;
  }

  const daSessao =
    escrita.tabela === "sessions" ||
    escrita.tabela === "session_sets" ||
    escrita.tabela === "progression_events";
  if (!daSessao) return undefined;

  // lote de um backup importado (§9): os lotes de sessão vão na ordem em que
  // foram enfileirados — `sessions` antes de `session_sets`
  if (escrita.linhas) return "sessions:lote";

  const campo = escrita.tabela === "sessions" ? "id" : "session_id";
  const valor = escrita.linha?.[campo] ?? escrita.filtro?.[campo];
  return typeof valor === "string" && valor !== "" ? `sessions:${valor}` : undefined;
}

/** Enfileira uma escrita. O IndexedDB recebe na hora; o Supabase, quando der. */
export async function enfileirarEscrita(
  tipo: TipoSaida,
  escrita: EscritaTabela,
): Promise<void> {
  await enfileirar(tipo, escrita, alvoDaEscrita(escrita));
}

/** Enfileira o envio de um arquivo do Storage (o blob já está no Dexie). */
export async function enfileirarArquivo(escrita: EscritaArquivo): Promise<void> {
  await enfileirar("foto", escrita);
}

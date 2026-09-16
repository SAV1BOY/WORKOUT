/**
 * Relatório (SPEC §13.5 e §14.4): contadores, "Todos os registros" e as duas
 * sequências. Funções puras sobre o que o banco devolve — nenhuma leitura,
 * nenhum React. As contas de gráfico continuam em `lib/progresso.ts`; aqui
 * mora o **histórico**, que é novo.
 */
import { acharTreino } from "@/lib/dados";
import { formatarMinutos } from "@/lib/formato";
import { ehSessaoLivre, tituloDoPlano } from "@/lib/livre";
import {
  repsDaSerie,
  serieDeTrabalho,
  volumeDaSerie,
  type CardioBruto,
  type SerieBruta,
  type SessaoBruta,
  type SoltaBruta,
} from "@/lib/progresso";
import { ehTreinoDoPrograma } from "@/lib/sessao";
import type { MotivoProgressao, TipoCardio } from "@/lib/types";

/* ------------------------------------------------------- contadores */

export interface ContadoresDoRelatorio {
  /** Sessões de força + de cardio concluídas. */
  treinos: number;
  /** Minutos treinados (força pela `duracao_s`, cardio pela `duracao_min`). */
  minutos: number;
  /** Σ reps × kg nas séries de trabalho concluídas. */
  volumeKg: number;
}

export interface EntradaDosContadores {
  sessoes: readonly SessaoBruta[];
  cardios: readonly CardioBruto[];
  series: readonly SerieBruta[];
}

export function contadoresDoRelatorio({
  sessoes,
  cardios,
  series,
}: EntradaDosContadores): ContadoresDoRelatorio {
  const forca = sessoes.filter((s) => s.status === "concluida");
  const cardio = cardios.filter((c) => c.concluida);
  const segundos = forca.reduce((t, s) => t + (s.duracao_s ?? 0), 0);
  const minutosDeCardio = cardio.reduce((t, c) => t + (c.duracao_min ?? 0), 0);
  const volume = series
    .filter((s) => s.concluida && serieDeTrabalho(s))
    .reduce((t, s) => t + volumeDaSerie(s), 0);
  return {
    treinos: forca.length + cardio.length,
    minutos: Math.round(segundos / 60) + minutosDeCardio,
    volumeKg: Math.round(volume),
  };
}

/* --------------------------------------------- todos os registros */

export type TipoDeRegistro = "forca" | "cardio" | "soltas";

export interface Registro {
  /** Chave estável para a lista (`forca:<id>`, `cardio:<id>`, `soltas:<data>`). */
  chave: string;
  tipo: TipoDeRegistro;
  data: string;
  /** "Treino A", "Corrida", "Barra fixa no descanso". */
  titulo: string;
  /** "45 min · 16 séries", "semana 3 · 34 min", "8 repetições". */
  detalhe: string;
  /** Quantos exercícios subiram · repetiram · voltaram (só força). */
  motor: { subiu: number; repetiu: number; voltou: number } | null;
  /** Para onde o toque leva (o resumo da sessão). */
  href: string | null;
}

export interface EventoDeSessao {
  session_id: string | null;
  motivo: MotivoProgressao;
}

const NOME_DO_CARDIO: Record<TipoCardio, string> = {
  corrida: "Corrida",
  corda: "Corda",
  caminhada: "Caminhada",
  outro: "Cardio",
};

/** O nome de uma sessão de força na lista (SPEC §13.5). */
export function tituloDaSessao(sessao: SessaoBruta): string {
  if (sessao.workout_id === "fixa") return "Barra fixa";
  if (ehSessaoLivre(sessao.workout_id)) {
    return tituloDoPlano(sessao.plano ?? null) ?? "Treino livre";
  }
  return ehTreinoDoPrograma(sessao.workout_id)
    ? acharTreino(sessao.workout_id).nome
    : "Treino";
}

function contarSeries(series: readonly SerieBruta[], sessaoId: string): number {
  return series.filter(
    (s) => s.session_id === sessaoId && s.concluida && serieDeTrabalho(s),
  ).length;
}

function contarMotor(eventos: readonly EventoDeSessao[], sessaoId: string) {
  const meus = eventos.filter((e) => e.session_id === sessaoId);
  return {
    subiu: meus.filter((e) => e.motivo === "subiu").length,
    repetiu: meus.filter((e) => e.motivo === "repetiu").length,
    voltou: meus.filter(
      (e) => e.motivo === "falha_2x_voltou_10" || e.motivo === "semana_leve_60",
    ).length,
  };
}

export interface EntradaDosRegistros extends EntradaDosContadores {
  soltas?: readonly SoltaBruta[];
  eventos?: readonly EventoDeSessao[];
  /** Só o que caiu dentro de um intervalo (a faixa da semana), se houver. */
  de?: string | null;
  ate?: string | null;
}

/**
 * "Todos os registros" (SPEC §13.5): uma linha por sessão de força, por sessão
 * de cardio e por dia de repetições soltas, da mais recente para a mais antiga.
 * Sessão aberta não entra — ela ainda não é registro.
 */
export function registros({
  sessoes,
  cardios,
  series,
  soltas = [],
  eventos = [],
  de = null,
  ate = null,
}: EntradaDosRegistros): Registro[] {
  const dentro = (data: string) =>
    (de === null || data >= de) && (ate === null || data <= ate);

  const deForca: Registro[] = sessoes
    .filter((s) => s.status === "concluida" && dentro(s.data))
    .map((s) => {
      const n = contarSeries(series, s.id);
      const duracao = s.duracao_s
        ? formatarMinutos(Math.round(s.duracao_s / 60))
        : null;
      return {
        chave: `forca:${s.id}`,
        tipo: "forca" as const,
        data: s.data,
        titulo: tituloDaSessao(s),
        detalhe: [duracao, `${n} ${n === 1 ? "série" : "séries"}`]
          .filter((p): p is string => p !== null)
          .join(" · "),
        motor: contarMotor(eventos, s.id),
        href: `/treinar/${s.id}`,
      };
    });

  const deCardio: Registro[] = cardios
    .filter((c) => c.concluida && dentro(c.data))
    .map((c, i) => ({
      chave: `cardio:${c.data}:${c.tipo}:${i}`,
      tipo: "cardio" as const,
      data: c.data,
      titulo: NOME_DO_CARDIO[c.tipo] ?? NOME_DO_CARDIO.outro,
      detalhe: [
        c.semana_plano ? `semana ${c.semana_plano}` : null,
        c.duracao_min ? formatarMinutos(c.duracao_min) : null,
      ]
        .filter((p): p is string => p !== null)
        .join(" · "),
      motor: null,
      href: `/cardio/${c.tipo}`,
    }));

  const porDia = new Map<string, number>();
  for (const s of soltas) {
    if (!dentro(s.data)) continue;
    porDia.set(s.data, (porDia.get(s.data) ?? 0) + s.reps);
  }
  const deSoltas: Registro[] = [...porDia.entries()].map(([data, reps]) => ({
    chave: `soltas:${data}`,
    tipo: "soltas" as const,
    data,
    titulo: "Barra fixa no descanso",
    detalhe: `${reps} ${reps === 1 ? "repetição" : "repetições"}`,
    motor: null,
    href: "/barra-fixa",
  }));

  return [...deForca, ...deCardio, ...deSoltas].sort((a, b) =>
    a.data === b.data ? a.chave.localeCompare(b.chave) : b.data.localeCompare(a.data),
  );
}

/** "↑ 2 · = 3 · ↓ 1" — o resumo do motor de uma sessão, ou `null`. */
export function textoDoMotorDaSessao(motor: Registro["motor"]): string | null {
  if (!motor) return null;
  const partes: string[] = [];
  if (motor.subiu > 0) partes.push(`↑ ${motor.subiu}`);
  if (motor.repetiu > 0) partes.push(`= ${motor.repetiu}`);
  if (motor.voltou > 0) partes.push(`↓ ${motor.voltou}`);
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Volume total das séries de trabalho de uma sessão (o resumo do toque). */
export function volumeDaSessao(
  series: readonly SerieBruta[],
  sessaoId: string,
): { reps: number; volumeKg: number } {
  const minhas = series.filter(
    (s) => s.session_id === sessaoId && s.concluida && serieDeTrabalho(s),
  );
  return {
    reps: minhas.reduce((t, s) => t + repsDaSerie(s), 0),
    volumeKg: Math.round(minhas.reduce((t, s) => t + volumeDaSerie(s), 0)),
  };
}

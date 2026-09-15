/**
 * Adaptadores puros do calendário (SPEC §3.5): a semana em grade, o mês em
 * miniatura e os `schedule_overrides` que a regra da semana curta (§5.4) grava.
 * Sem React, sem Supabase — só dados entrando e saindo.
 */
import { addDays, endOfMonth, startOfMonth } from "date-fns";
import {
  diasDaSemana,
  inicioDaSemana,
  iso,
  paraData,
  semanaDoPlano,
  tipoDoDia,
  type DiaDoPlano,
  type ExcecaoAgenda,
  type PerfilCalendario,
} from "@/lib/calendario";
import { acharTreino } from "@/lib/dados";
import { formatarData, formatarDiaCurto, formatarMinutos } from "@/lib/formato";
import { descricaoDoCardio } from "@/lib/hoje";
import type { TipoDia, TreinoId } from "@/lib/schemas";
import type { LinhaSessao, LinhaSessaoCardio, TipoCardio } from "@/lib/types";

/** O que aconteceu no dia: feito, pela metade, perdido ou ainda por fazer. */
export type MarcaDoDia = "feito" | "parcial" | "faltou" | "aberto" | "descanso";

export const SIMBOLO: Record<MarcaDoDia, string> = {
  feito: "✓",
  parcial: "~",
  faltou: "✕",
  aberto: "",
  descanso: "",
};

export const NOME_DA_MARCA: Record<MarcaDoDia, string> = {
  feito: "feito",
  parcial: "parcial",
  faltou: "faltou",
  aberto: "a fazer",
  descanso: "descanso",
};

export type SessaoCurta = Pick<LinhaSessao, "id" | "data" | "status" | "workout_id">;
export type CardioCurto = Pick<LinhaSessaoCardio, "id" | "data" | "tipo" | "concluida">;

export interface DiaDaGrade {
  dia: DiaDoPlano;
  data: string;
  marca: MarcaDoDia;
  simbolo: string;
  passado: boolean;
  ehHoje: boolean;
  futuro: boolean;
  /** "Treino A", "Corrida", "Descanso" */
  rotulo: string;
  /** "6 exercícios · 44 min", "8 × (1 min corrida / 2 min caminhada) · 34 min" */
  detalhe: string | null;
  /** Sessão registrada naquele dia (para abrir o resumo). */
  sessaoId: string | null;
  /**
   * Num dia de cardio, o tipo da sessão registrada (`cardio_sessions.tipo`):
   * a rota `/cardio/[id]` é por tipo, não por id (SPEC §3.3). `null` no resto.
   */
  sessaoTipo: TipoCardio | null;
}

/** O rótulo curto do dia: o nome do treino, o tipo de cardio ou "Descanso". */
export function rotuloDoDia(dia: DiaDoPlano): string {
  if (dia.tipo === "forca") {
    return dia.treinoId ? acharTreino(dia.treinoId).nome : "Força";
  }
  if (dia.tipo === "cardio") {
    const t = dia.cardio?.tipo;
    return t === "corda" ? "Corda" : t === "caminhada" ? "Caminhada" : "Corrida";
  }
  return "Descanso";
}

/** A segunda linha do dia: o que a sessão tem de concreto. */
export function detalheDoDia(dia: DiaDoPlano): string | null {
  if (dia.tipo === "forca" && dia.treinoId) {
    const treino = acharTreino(dia.treinoId);
    const n = treino.exercicios.length;
    return `${n} exercício${n === 1 ? "" : "s"} · ${formatarMinutos(treino.duracao_min)}`;
  }
  if (dia.tipo === "cardio" && dia.cardio) {
    const desc = descricaoDoCardio(dia.cardio);
    const min = dia.cardio.min !== null ? formatarMinutos(dia.cardio.min) : null;
    return [desc, min].filter(Boolean).join(" · ") || null;
  }
  return dia.nota && dia.nota.trim() !== "" ? dia.nota : null;
}

interface MarcaDaSessao {
  marca: MarcaDoDia;
  sessaoId: string | null;
  sessaoTipo: TipoCardio | null;
}

function marcarDia(
  dia: DiaDoPlano,
  sessoes: SessaoCurta[],
  cardios: CardioCurto[],
  hoje: string,
): MarcaDaSessao {
  const vazio = { sessaoId: null, sessaoTipo: null };
  if (dia.tipo === "descanso") return { marca: "descanso", ...vazio };

  if (dia.tipo === "forca") {
    const doDia = sessoes.filter((s) => s.data === dia.data);
    const concluida = doDia.find((s) => s.status === "concluida");
    if (concluida) return { marca: "feito", sessaoId: concluida.id, sessaoTipo: null };
    const parcial = doDia[0];
    if (parcial) return { marca: "parcial", sessaoId: parcial.id, sessaoTipo: null };
  } else {
    const doDia = cardios.filter((c) => c.data === dia.data);
    const concluida = doDia.find((c) => c.concluida);
    if (concluida) {
      return { marca: "feito", sessaoId: concluida.id, sessaoTipo: concluida.tipo };
    }
    const parcial = doDia[0];
    if (parcial) {
      return { marca: "parcial", sessaoId: parcial.id, sessaoTipo: parcial.tipo };
    }
  }

  if (dia.data < hoje) return { marca: "faltou", ...vazio };
  return { marca: "aberto", ...vazio };
}

/** A semana inteira pronta para a grade (SPEC §3.5). */
export function montarGrade(
  semana: DiaDoPlano[],
  sessoes: SessaoCurta[] = [],
  cardios: CardioCurto[] = [],
  hoje: string,
): DiaDaGrade[] {
  return semana.map((dia) => {
    const { marca, sessaoId, sessaoTipo } = marcarDia(dia, sessoes, cardios, hoje);
    return {
      dia,
      data: dia.data,
      marca,
      simbolo: SIMBOLO[marca],
      passado: dia.data < hoje,
      ehHoje: dia.data === hoje,
      futuro: dia.data > hoje,
      rotulo: rotuloDoDia(dia),
      detalhe: detalheDoDia(dia),
      sessaoId,
      sessaoTipo,
    };
  });
}

/* -------------------------------------------- faixa da semana (SPEC §13.3) */

export interface DiaDaFaixa {
  data: string;
  /** "seg", "ter"… */
  rotulo: string;
  numero: number;
  marca: MarcaDoDia;
  ehHoje: boolean;
  /** "Segunda, 14/09 · Treino A · feito" — o que o leitor de tela lê. */
  titulo: string;
}

/**
 * A semana em sete casas (SPEC §13.3): hoje em destaque, ✓ nos dias feitos,
 * ponto nos planejados, cinza no que faltou. Deriva da mesma grade do
 * calendário — nada de segunda contagem.
 */
export function faixaDaSemana(grade: DiaDaGrade[]): DiaDaFaixa[] {
  return grade.map((dia) => ({
    data: dia.data,
    rotulo: formatarDiaCurto(dia.data),
    numero: paraData(dia.data).getDate(),
    marca: dia.marca,
    ehHoje: dia.ehHoje,
    titulo: `${formatarDiaCurto(dia.data)}, ${formatarData(dia.data)} · ${dia.rotulo} · ${
      dia.ehHoje ? "hoje" : NOME_DA_MARCA[dia.marca]
    }`,
  }));
}

/* ------------------------------------------------------ mês em miniatura */

export interface DiaDoMes {
  data: string;
  numero: number;
  tipo: TipoDia;
  marca: MarcaDoDia;
  doMes: boolean;
  ehHoje: boolean;
}

/**
 * O mês em miniatura: semanas de segunda a domingo cobrindo o mês inteiro,
 * cada dia com o tipo do programa e a marcação do que foi feito.
 */
export function montarMes(
  mesDeReferencia: string | Date,
  perfil: PerfilCalendario,
  overrides: ExcecaoAgenda[] = [],
  sessoes: SessaoCurta[] = [],
  cardios: CardioCurto[] = [],
  hoje: string,
): DiaDoMes[][] {
  const ref = paraData(mesDeReferencia);
  const primeiro = startOfMonth(ref);
  const ultimo = endOfMonth(ref);
  const mes = primeiro.getMonth();

  const semanas: DiaDoMes[][] = [];
  let cursor = inicioDaSemana(primeiro);

  while (cursor <= ultimo) {
    const dias = diasDaSemana(cursor).map((data): DiaDoMes => {
      const info = tipoDoDia(data, perfil.fase_atual, overrides);
      const dia: DiaDoPlano = {
        data: info.data,
        dia: info.dia,
        tipo: info.tipo,
        origem: info.origem,
        treinoEscolhido: false,
        fase: perfil.fase_atual,
        treinoId: null,
        treino: null,
        cardio: null,
        nota: null,
        min: null,
      };
      const { marca } = marcarDia(dia, sessoes, cardios, hoje);
      return {
        data: info.data,
        numero: paraData(data).getDate(),
        tipo: info.tipo,
        marca,
        doMes: paraData(data).getMonth() === mes,
        ehHoje: info.data === hoje,
      };
    });
    semanas.push(dias);
    cursor = addDays(cursor, 7);
  }

  return semanas;
}

/* ------------------------------------------------ overrides da semana curta */

export interface NovoOverride {
  data: string;
  tipo: TipoDia;
  workout_id: TreinoId | null;
  sessao: string | null;
  motivo: string | null;
  /** "sex · Corrida → Descanso" — o que o usuário confirma antes de gravar. */
  descricao: string;
}

function assinatura(dia: DiaDoPlano): string {
  return `${dia.tipo}|${dia.treinoId ?? ""}|${dia.cardio?.sessao ?? ""}`;
}

/**
 * O que a regra da semana curta (SPEC §5.4) muda daqui para a frente, já no
 * formato de `schedule_overrides`. Só entram os dias a partir de `aPartirDe`
 * (o dia marcado como "não vou treinar") que de fato ficaram diferentes do
 * plano — o resto da semana continua valendo pelo programa.
 */
export function overridesDaSemanaCurta(
  planejada: DiaDoPlano[],
  reorganizada: DiaDoPlano[],
  aPartirDe: string,
  motivo: string | null = null,
): NovoOverride[] {
  const antes = new Map(planejada.map((d) => [d.data, d]));
  const novos: NovoOverride[] = [];

  for (const depois of reorganizada) {
    if (depois.data < aPartirDe) continue;
    const original = antes.get(depois.data);
    if (!original) continue;
    if (assinatura(original) === assinatura(depois)) continue;

    novos.push({
      data: depois.data,
      tipo: depois.tipo,
      workout_id: depois.tipo === "forca" ? depois.treinoId : null,
      sessao: depois.tipo === "cardio" ? (depois.cardio?.sessao ?? null) : null,
      motivo,
      descricao: `${formatarData(depois.data)} · ${rotuloDoDia(original)} → ${rotuloDoDia(depois)}`,
    });
  }

  return novos;
}

/** A semana planejada de uma data, com os overrides já aplicados. */
export function semanaDe(
  data: string | Date,
  perfil: PerfilCalendario,
  overrides: ExcecaoAgenda[] = [],
): DiaDoPlano[] {
  return semanaDoPlano(data, perfil, overrides);
}

/** Primeiro e último dia (ISO) da semana de uma data — para filtrar queries. */
export function intervaloDaSemana(data: string | Date): { de: string; ate: string } {
  const dias = diasDaSemana(data);
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];
  return {
    de: iso(primeiro ?? data),
    ate: iso(ultimo ?? data),
  };
}

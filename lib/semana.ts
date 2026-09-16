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
  semanaCoerente,
  semanaDaFase,
  semanaDoPlano,
  SEMANAS_PARA_FASE2,
  tipoDoDia,
  type Data,
  type DiaDoPlano,
  type ExcecaoAgenda,
  type PerfilCalendario,
  type SessaoDeForca,
} from "@/lib/calendario";
import { acharFase, acharTreino } from "@/lib/dados";
import {
  formatarData,
  formatarDiaCurto,
  formatarDiaLongo,
  formatarMinutos,
} from "@/lib/formato";
import { descricaoDoCardio } from "@/lib/hoje";
import type { FaseId, TipoDia, TreinoId } from "@/lib/schemas";
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
  /** "Treino A · semana 3", "Corrida · semana 3 do plano" (SPEC §16.4). */
  rotuloLongo: string;
  /** "A", "SA", "Corr.", "Desc." — o rótulo curto da faixa (SPEC §16.3). */
  sigla: string;
  /** Em que semana da fase cai este dia (SPEC §5.1). */
  semanaDaFase: number;
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

/** O rótulo do dia: o nome do treino, o tipo de cardio ou "Descanso". */
export function rotuloDoDia(dia: DiaDoPlano): string {
  if (dia.tipo === "forca") {
    // SPEC §16.2 item 2: um dia passado sem sessão e sem histórico anterior
    // não sabe qual treino era — mas sabe que era de força.
    return dia.treinoId ? acharTreino(dia.treinoId).nome : "Treino de força";
  }
  if (dia.tipo === "cardio") return nomeDoCardio(dia);
  return "Descanso";
}

function nomeDoCardio(dia: DiaDoPlano): string {
  const t = dia.cardio?.tipo;
  return t === "corda" ? "Corda" : t === "caminhada" ? "Caminhada" : "Corrida";
}

/** A corrida longa da Fase 2 é a corrida de sábado (`programa.json`). */
function corridaLonga(dia: DiaDoPlano): boolean {
  return /longa/i.test(dia.cardio?.sessao ?? "");
}

/**
 * A sigla do dia na faixa da semana (SPEC §16.3): a letra do treino de força
 * ("A", "B", "SA", "IA", "SB", "IB"), o cardio do dia ou o descanso.
 */
export function siglaDoDia(dia: DiaDoPlano): string {
  if (dia.tipo === "forca") {
    // "A1" → "A", "B1" → "B"; "SA"/"IB" não têm número e ficam como estão
    return dia.treinoId ? dia.treinoId.replace(/\d+$/, "") : "Força";
  }
  if (dia.tipo === "cardio") {
    if (corridaLonga(dia)) return "Longa";
    const t = dia.cardio?.tipo;
    return t === "corda" ? "Corda" : t === "caminhada" ? "Cam." : "Corr.";
  }
  return "Desc.";
}

/**
 * O rótulo do card do dia com a semana (SPEC §16.4): a semana da **fase** num
 * dia de força, a semana do **plano** num dia de cardio.
 */
export function rotuloLongoDoDia(dia: DiaDoPlano, semanaDaFaseDoDia: number): string {
  const nome = rotuloDoDia(dia);
  /*
   * Navegar para trás passa do começo da fase: ali não existe "semana N" para
   * contar (seria 0, −1…). O dia continua aparecendo, só sem a semana.
   */
  if (semanaDaFaseDoDia < 1) return nome;
  if (dia.tipo === "forca") return `${nome} · semana ${semanaDaFaseDoDia}`;
  if (dia.tipo === "cardio" && dia.cardio) {
    return `${nome} · semana ${dia.cardio.semana} do plano`;
  }
  return nome;
}

/**
 * "Fase 1 · semana 3 de 12" — o cabeçalho do calendário (SPEC §16.4). O total
 * é o ponto em que o app sugere a Fase 2 (§5.1); na Fase 2 não há total.
 */
export function rotuloDaFase(fase: FaseId, semana: number): string {
  const [curto] = acharFase(fase).nome.split("—");
  const nome = (curto ?? fase).trim();
  // antes do começo da fase não há semana para contar: só o nome da fase
  if (semana < 1) return nome;
  return fase === "fase1"
    ? `${nome} · semana ${semana} de ${SEMANAS_PARA_FASE2}`
    : `${nome} · semana ${semana}`;
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

/** De onde a grade tira a semana (SPEC §16.2). */
export interface FonteDaGrade {
  /** Qualquer dia da semana que se quer ver. */
  data: Data;
  perfil: PerfilCalendario;
  overrides?: ExcecaoAgenda[];
  sessoes?: SessaoCurta[];
  cardios?: CardioCurto[];
  /** Hoje (ISO) — o que separa o passado registrado da projeção. */
  hoje: string;
}

/**
 * A semana inteira pronta para a grade (SPEC §3.5), montada por
 * `semanaCoerente()` (§16.2): os dias passados com o treino da sessão que
 * existe neles, hoje e o futuro com a alternância projetada a partir de hoje.
 * É a mesma fonte da faixa da semana e do card do dia — as telas não discordam.
 */
export function montarGrade(fonte: FonteDaGrade): DiaDaGrade[] {
  const { data, perfil, hoje } = fonte;
  const sessoes = fonte.sessoes ?? [];
  const cardios = fonte.cardios ?? [];
  const semana = semanaCoerente(data, perfil, {
    overrides: fonte.overrides ?? [],
    sessoes: sessoes as SessaoDeForca[],
    hoje,
  });
  return montarGradeDe(semana, sessoes, cardios, hoje, perfil);
}

/** A grade de uma semana já montada (a reorganizada da §5.4, por exemplo). */
export function montarGradeDe(
  semana: DiaDoPlano[],
  sessoes: SessaoCurta[] = [],
  cardios: CardioCurto[] = [],
  hoje: string,
  perfil?: Pick<PerfilCalendario, "fase_desde">,
): DiaDaGrade[] {
  return semana.map((dia) => {
    const { marca, sessaoId, sessaoTipo } = marcarDia(dia, sessoes, cardios, hoje);
    const semanaDaFaseDoDia = semanaDaFase(dia.data, perfil?.fase_desde ?? dia.data);
    return {
      dia,
      data: dia.data,
      marca,
      simbolo: SIMBOLO[marca],
      passado: dia.data < hoje,
      ehHoje: dia.data === hoje,
      futuro: dia.data > hoje,
      rotulo: rotuloDoDia(dia),
      rotuloLongo: rotuloLongoDoDia(dia, semanaDaFaseDoDia),
      sigla: siglaDoDia(dia),
      semanaDaFase: semanaDaFaseDoDia,
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
  /** "A", "B", "SA", "Corr.", "Desc." — o treino do dia (SPEC §16.3). */
  treino: string;
  marca: MarcaDoDia;
  ehHoje: boolean;
  /** "quarta 30/09: Treino B, hoje" — o que o leitor de tela lê (§16.3). */
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
    treino: dia.sigla,
    marca: dia.marca,
    ehHoje: dia.ehHoje,
    titulo: `${formatarDiaLongo(dia.data)} ${formatarData(dia.data)}: ${dia.rotulo}, ${
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

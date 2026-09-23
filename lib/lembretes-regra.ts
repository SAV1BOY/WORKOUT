/**
 * Lembretes II (SPEC §23.9–23.12): as decisões puras do disparo no horário —
 * as preferências de hora, o relógio de São Paulo, quem recebe o quê agora, o
 * próximo aviso previsto, o "Último lembrete" e os eventos do calendário.
 *
 * Fica fora de `lib/lembretes.ts` de propósito: aquele arquivo entra no
 * service worker, e este puxa o calendário (`lib/semana.ts`, os JSON do
 * programa). Sem React, sem Supabase, sem `node:crypto`.
 */
import { addDays } from "date-fns";
import { diaDaSemana, paraData, iso, type ExcecaoAgenda, type PerfilCalendario } from "@/lib/calendario";
import { formatarData, formatarMinutos } from "@/lib/formato";
import { resumoDoTreino, textoDoCardio } from "@/lib/hoje";
import type { PayloadDoLembrete } from "@/lib/lembretes";
import {
  lembreteDoTipoSchema,
  type DiaSemana,
  type PrefsLembretes,
  type TipoDeLembrete,
} from "@/lib/schemas";
import { montarGrade, rotuloDoDia, type CardioCurto, type SessaoCurta } from "@/lib/semana";
import type { Prefs } from "@/lib/types";

/** O fuso de todo lembrete (SPEC §23.9). */
export const FUSO_DOS_LEMBRETES = "America/Sao_Paulo";
/** Depois da hora escolhida, quanto o aviso ainda vale (SPEC §23.10 item 4). */
export const TOLERANCIA_MIN = 30;
/** O passo do pg_cron e do campo de hora. */
export const PASSO_MIN = 5;

/** Sem a chave em `prefs`: os dois desligados às 07:00 (ninguém recebe sem pedir). */
export const LEMBRETES_PADRAO: PrefsLembretes = {
  treino: { ligado: false, hora: "07:00" },
  corrida: { ligado: false, hora: "07:00" },
};

export const ROTULO_DO_LEMBRETE: Readonly<Record<TipoDeLembrete, string>> = {
  treino: "Lembrete do treino",
  corrida: "Lembrete da corrida",
};

/** O que cada tipo cobre na tela (os dias vêm do perfil, §17). */
export const DIAS_DO_LEMBRETE: Readonly<Record<TipoDeLembrete, string>> = {
  treino: "Nos dias de força do seu plano.",
  corrida: "Nos dias de cardio do seu plano.",
};

/** Lê `prefs.lembretes` tipo a tipo; o que não fecha com o schema vira o padrão. */
export function lembretesDasPrefs(prefs: Prefs | Record<string, unknown> | null | undefined): PrefsLembretes {
  const bruto = (prefs as Record<string, unknown> | null | undefined)?.lembretes;
  const lido = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const tipo = (t: TipoDeLembrete) => {
    const r = lembreteDoTipoSchema.safeParse(lido[t]);
    return r.success ? r.data : { ...LEMBRETES_PADRAO[t] };
  };
  return { treino: tipo("treino"), corrida: tipo("corrida") };
}

/** Grava os lembretes sem perder as outras chaves de `prefs`. */
export function comLembretes(prefs: Prefs | null | undefined, lembretes: PrefsLembretes): Prefs {
  return { ...(prefs ?? {}), lembretes };
}

/* ------------------------------------------------------------- o relógio */

const PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DOS_LEMBRETES,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface RelogioLocal {
  /** O dia em São Paulo (`YYYY-MM-DD`). */
  dia: string;
  /** Minutos desde a meia-noite em São Paulo. */
  minutos: number;
  /** `HH:MM` em São Paulo. */
  hora: string;
}

/** O instante lido em America/Sao_Paulo, qualquer que seja o fuso do servidor. */
export function relogioDeSaoPaulo(agora: Date): RelogioLocal {
  const p = Object.fromEntries(PARTES.formatToParts(agora).map((x) => [x.type, x.value]));
  const h = Number(p.hour);
  const m = Number(p.minute);
  return {
    dia: `${p.year}-${p.month}-${p.day}`,
    minutos: h * 60 + m,
    hora: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  };
}

export function minutosDaHora(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/* ------------------------------------------------ o dia, pela aba Treino */

/** O que a regra precisa de uma conta — o mesmo que `lembretes_tick()` manda. */
export interface ContaDaRegra {
  perfil: PerfilCalendario & { data_inicio?: string | null };
  overrides: ExcecaoAgenda[];
  sessoes: SessaoCurta[];
  cardios: CardioCurto[];
  enviados: { tipo: TipoDeLembrete; dia: string }[];
}

export interface LembreteDoDia {
  tipo: TipoDeLembrete;
  dia: string;
  payload: PayloadDoLembrete;
  /** A duração estimada do plano naquele dia (minutos), para o calendário. */
  duracaoMin: number | null;
  /** O dia já está feito (sessão concluída) — o lembrete não sai. */
  feito: boolean;
}

/**
 * O que o dia `dia` pede, pela mesma fonte da aba Treino e do calendário
 * (`montarGrade` → `semanaCoerente`, SPEC §16.2): descanso — inclusive o
 * "Não vou treinar hoje", que a §5.4 grava como override de descanso — não
 * pede nada; força pede o lembrete do treino; cardio, o da corrida.
 */
export function lembreteDoDia(conta: ContaDaRegra, dia: string, hoje: string): LembreteDoDia | null {
  const perfil = { ...conta.perfil, data_inicio: conta.perfil.data_inicio ?? undefined };
  const grade = montarGrade({
    data: dia,
    perfil,
    overrides: conta.overrides,
    sessoes: conta.sessoes,
    cardios: conta.cardios,
    hoje,
  });
  const doDia = grade.find((g) => g.data === dia);
  if (!doDia) return null;
  const plano = doDia.dia;
  const feito = doDia.marca === "feito";
  if (plano.tipo === "forca") {
    const resumo = plano.treinoId ? resumoDoTreino(plano.treinoId) : null;
    return {
      tipo: "treino",
      dia,
      feito,
      duracaoMin: plano.min,
      payload: {
        titulo: "Hora do treino",
        corpo: resumo ? resumo.texto : rotuloDoDia(plano),
        url: "/",
        tag: "lembrete-treino",
      },
    };
  }
  if (plano.tipo === "cardio" && plano.cardio) {
    return {
      tipo: "corrida",
      dia,
      feito,
      duracaoMin: plano.min,
      payload: {
        titulo: "Hora da corrida",
        corpo: textoDoCardio(plano.cardio),
        url: "/",
        tag: "lembrete-corrida",
      },
    };
  }
  return null;
}

export interface LembreteDevido {
  tipo: TipoDeLembrete;
  dia: string;
  payload: PayloadDoLembrete;
}

/**
 * Os avisos devidos agora (SPEC §23.10): o do tipo do dia, se ligado, se o dia
 * não está feito, se `agora` está entre a hora escolhida e 30 min depois (no
 * mesmo dia de São Paulo) e se ainda não saiu hoje.
 */
export function lembretesDevidos(conta: ContaDaRegra, agora: Date): LembreteDevido[] {
  const relogio = relogioDeSaoPaulo(agora);
  const doDia = lembreteDoDia(conta, relogio.dia, relogio.dia);
  if (!doDia || doDia.feito) return [];
  const escolha = lembretesDasPrefs(conta.perfil.prefs)[doDia.tipo];
  if (!escolha.ligado) return [];
  const atraso = relogio.minutos - minutosDaHora(escolha.hora);
  if (atraso < 0 || atraso > TOLERANCIA_MIN) return [];
  if (conta.enviados.some((e) => e.tipo === doDia.tipo && e.dia === relogio.dia)) return [];
  return [{ tipo: doDia.tipo, dia: relogio.dia, payload: doDia.payload }];
}

/* ----------------------------------------------- o que a tela mostra */

/** "hoje", "amanhã", "ontem" ou "dd/mm". */
function quando(dia: string, hoje: string): string {
  if (dia === hoje) return "hoje";
  if (dia === iso(addDays(paraData(hoje), 1))) return "amanhã";
  if (dia === iso(addDays(paraData(hoje), -1))) return "ontem";
  return formatarData(dia);
}

/**
 * "Próximo: amanhã às 07:00 — Treino A · 6 exercícios · 44 min", pela mesma
 * regra do disparo, olhando os próximos 7 dias. `null` com os dois desligados.
 */
export function proximoLembrete(conta: ContaDaRegra, agora: Date): string | null {
  const relogio = relogioDeSaoPaulo(agora);
  const prefs = lembretesDasPrefs(conta.perfil.prefs);
  if (!prefs.treino.ligado && !prefs.corrida.ligado) return null;
  for (let d = 0; d <= 7; d += 1) {
    const dia = iso(addDays(paraData(relogio.dia), d));
    const doDia = lembreteDoDia(conta, dia, relogio.dia);
    if (!doDia || doDia.feito) continue;
    const escolha = prefs[doDia.tipo];
    if (!escolha.ligado) continue;
    if (d === 0) {
      const passou = relogio.minutos - minutosDaHora(escolha.hora) > TOLERANCIA_MIN;
      const saiu = conta.enviados.some((e) => e.tipo === doDia.tipo && e.dia === dia);
      if (passou || saiu) continue;
    }
    return `Próximo: ${quando(dia, relogio.dia)} às ${escolha.hora} — ${doDia.payload.corpo}`;
  }
  return null;
}

/** "Último lembrete: hoje às 07:00" a partir de `lembretes_enviados.enviado_em`. */
export function textoDoUltimo(enviados: readonly { enviado_em: string }[], agora: Date): string | null {
  const ultimo = [...enviados]
    .map((e) => new Date(e.enviado_em))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!ultimo) return null;
  const hoje = relogioDeSaoPaulo(agora).dia;
  const lido = relogioDeSaoPaulo(ultimo);
  return `Último lembrete: ${quando(lido.dia, hoje)} às ${lido.hora}`;
}

/* ------------------------------------------------ o calendário (§23.12) */

export interface EventoSemanal {
  tipo: TipoDeLembrete;
  diaSemana: DiaSemana;
  /** O primeiro dia do evento (o próximo daquele tipo, a partir de hoje). */
  inicio: string;
  hora: string;
  duracaoMin: number;
  resumo: string;
  descricao: string;
}

const DURACAO_SEM_PLANO_MIN = 45;

/**
 * Um evento semanal por dia de treino do perfil (§17): a semana do plano a
 * partir de hoje, **sem** overrides nem sessões (o evento repete toda semana,
 * então é o padrão do plano, não a exceção desta). Força com a hora do
 * lembrete do treino, cardio com a da corrida — ligados ou não.
 */
export function eventosDoCalendario(
  perfil: ContaDaRegra["perfil"],
  agora: Date,
): EventoSemanal[] {
  const hoje = relogioDeSaoPaulo(agora).dia;
  const prefs = lembretesDasPrefs(perfil.prefs);
  const conta: ContaDaRegra = { perfil, overrides: [], sessoes: [], cardios: [], enviados: [] };
  const eventos: EventoSemanal[] = [];
  for (let d = 0; d < 7; d += 1) {
    const dia = iso(addDays(paraData(hoje), d));
    const doDia = lembreteDoDia(conta, dia, hoje);
    if (!doDia) continue;
    const forca = doDia.tipo === "treino";
    eventos.push({
      tipo: doDia.tipo,
      diaSemana: diaDaSemana(dia),
      inicio: dia,
      hora: prefs[doDia.tipo].hora,
      duracaoMin: doDia.duracaoMin ?? DURACAO_SEM_PLANO_MIN,
      resumo: forca ? "Treino de força" : doDia.payload.corpo.split(" · ")[0] ?? "Corrida",
      descricao: forca
        ? `Treino do Terraço: abra o app para ver o treino do dia (cerca de ${formatarMinutos(doDia.duracaoMin ?? DURACAO_SEM_PLANO_MIN)}).`
        : `Treino do Terraço: ${doDia.payload.corpo}.`,
    });
  }
  return eventos.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

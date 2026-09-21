/**
 * Formatação pt-BR: vírgula decimal, datas dd/MM, durações mm:ss.
 * Funções puras, sem React — usadas na UI e nos testes.
 */
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Aceita Date ou "2026-09-14" (data pura, sem fuso). */
export type DataEntrada = Date | string;

export function paraData(valor: DataEntrada): Date {
  return typeof valor === "string" ? parseISO(valor) : valor;
}

/** 7.5 → "7,5" · 24 → "24" · 1.25 com 2 casas → "1,25" */
export function formatarNumero(valor: number, casasMax = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casasMax,
  }).format(valor);
}

/** 7.5 → "7,5 kg" */
export function formatarKg(valor: number, casasMax = 2): string {
  return `${formatarNumero(valor, casasMax)} kg`;
}

/** 96.5 → "96,5 cm" */
export function formatarCm(valor: number, casasMax = 1): string {
  return `${formatarNumero(valor, casasMax)} cm`;
}

/** 3.62 → "3,62 km" */
export function formatarKm(valor: number, casasMax = 2): string {
  return `${formatarNumero(valor, casasMax)} km`;
}

/**
 * 78 → "78%" — um formato só de porcentagem no app (SPEC §22.6 item 8). O
 * símbolo fica COLADO no número: a tela escrevia `${…} %` à mão, com um
 * espaço, e a mesma tela tinha "78%" em outro lugar.
 */
export function formatarPercentual(valor: number, casasMax = 0): string {
  return `${formatarNumero(valor, casasMax)}%`;
}

/** 14/09 */
export function formatarData(valor: DataEntrada): string {
  return format(paraData(valor), "dd/MM", { locale: ptBR });
}

/** 14/09/2026 */
export function formatarDataCompleta(valor: DataEntrada): string {
  return format(paraData(valor), "dd/MM/yyyy", { locale: ptBR });
}

/** segunda-feira, 14 de setembro de 2026 */
export function formatarDataLonga(valor: DataEntrada): string {
  return format(paraData(valor), "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

/** "terça" — o nome do dia por extenso, sem o "-feira" (SPEC §16.3). */
export function formatarDiaLongo(valor: DataEntrada): string {
  return format(paraData(valor), "EEEE", { locale: ptBR }).replace(/-feira$/, "");
}

/**
 * "terça, 15/09" — a saudação da aba Treino (SPEC §13.3). A maiúscula é da
 * tela (`first-letter:uppercase`), como no resto do app.
 */
export function formatarDiaEData(valor: DataEntrada): string {
  return `${formatarDiaLongo(valor)}, ${formatarData(valor)}`;
}

/** setembro de 2026 */
export function formatarMesAno(valor: DataEntrada): string {
  return format(paraData(valor), "MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * seg · ter · qua · qui · sex · **sáb** · dom — o rótulo curto do calendário e
 * da faixa da semana.
 *
 * O `EEEEEE` do date-fns devolve "sab" sem acento, e a faixa da semana ficava
 * escrevendo "sab" ao lado de um calendário que escreve "SÁB" (SPEC §22.1).
 * O mapa é o mesmo de `diaCurto` em `lib/hoje.ts`; o índice é o do relógio
 * local, como todo o resto do app (SPEC §5).
 */
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export function formatarDiaCurto(valor: DataEntrada): string {
  return DIAS_CURTOS[paraData(valor).getDay()] ?? "";
}

/** 150 → "2:30" · 3720 → "1:02:00" · 45 → "0:45" */
export function formatarDuracao(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

/** 44 → "44 min" · 95 → "1 h 35" */
export function formatarMinutos(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Texto do descanso no estilo do guia: 90 → "90 s", 120 → "2 min",
 * 150 → "2 min 30 s". Abaixo de dois minutos o guia conta em segundos.
 */
export function formatarDescanso(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  if (total < 120) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** "24,5" ou "24.5" → 24.5 · vazio → null */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Rótulo da convenção de carga de cada implemento (SPEC §4: "o campo
 * `implemento` do exercício diz qual convenção vale — mostrar sempre o rótulo
 * certo na tela"). Barras (maciça, W, reta oca) são o padrão: peso total.
 */
export function rotuloDaCarga(implemento: string): string {
  switch (implemento) {
    case "halteres":
      return "por halter";
    case "polia":
      return "no pino";
    case "barra_fixa":
      return "na mochila";
    case "anilha":
      // A carga é a anilha segurada contra o peito (abdominal com anilha,
      // russian twist): não existe barra nenhuma no movimento.
      return "na anilha";
    case "band":
      return "com elástico";
    case "corda":
    case "peso_corporal":
      return "peso do corpo";
    default:
      return "na barra";
  }
}

/**
 * Corpo (SPEC §3.8): peso, medidas e fotos.
 *
 * Funções puras sobre as linhas de `body_weights`, `body_measurements` e
 * `progress_photos`. A tela (`components/corpo/`) só desenha; a fila de saída
 * (`lib/queries/corpo.ts`) só grava.
 */
import { addDays, differenceInCalendarDays } from "date-fns";
import { inicioDaSemana, iso, paraData } from "@/lib/calendario";
import type {
  AnguloFoto,
  LinhaFotoProgresso,
  LinhaMedidas,
  LinhaPeso,
  Prefs,
} from "@/lib/types";

/* --------------------------------------------------------------- peso */

export type PesoBruto = Pick<LinhaPeso, "data" | "peso_kg">;

export interface PontoDePeso {
  data: string;
  rotulo: string;
  peso: number;
  /** Média móvel de 7 dias (SPEC §3.8); com um ponto só é o próprio peso. */
  media: number;
}

function rotulo(data: string): string {
  const d = paraData(data);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Os pesos em ordem de data, uma pesagem por dia (a última vence). */
export function pontosDePeso(linhas: readonly PesoBruto[]): { data: string; peso: number }[] {
  const porData = new Map<string, number>();
  for (const l of linhas) porData.set(l.data, Number(l.peso_kg));
  return [...porData.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, peso]) => ({ data, peso }));
}

/**
 * Média móvel de 7 **dias de calendário** (não das 7 últimas pesagens): quem
 * pesa três vezes na semana e some duas não vê a linha mentir.
 */
export function mediaMovel(
  linhas: readonly PesoBruto[],
  dias = 7,
): PontoDePeso[] {
  const pontos = pontosDePeso(linhas);
  return pontos.map((p, i) => {
    const desde = iso(addDays(paraData(p.data), -(dias - 1)));
    let soma = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      const anterior = pontos[j];
      if (!anterior || anterior.data < desde) break;
      soma += anterior.peso;
      n += 1;
    }
    return {
      data: p.data,
      rotulo: rotulo(p.data),
      peso: p.peso,
      media: n === 0 ? p.peso : Math.round((soma / n) * 100) / 100,
    };
  });
}

export interface VariacaoSemanal {
  inicio: string;
  rotulo: string;
  peso: number;
  /** Diferença para a semana anterior com pesagem (null na primeira). */
  variacao: number | null;
}

/** Variação por semana: o último peso de cada semana civil (SPEC §3.8). */
export function variacaoPorSemana(linhas: readonly PesoBruto[]): VariacaoSemanal[] {
  const porSemana = new Map<string, { data: string; peso: number }>();
  for (const p of pontosDePeso(linhas)) {
    const inicio = iso(inicioDaSemana(p.data));
    const atual = porSemana.get(inicio);
    if (!atual || p.data >= atual.data) porSemana.set(inicio, p);
  }
  const semanas = [...porSemana.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return semanas.map(([inicio, p], i) => {
    const anterior = semanas[i - 1];
    return {
      inicio,
      rotulo: rotulo(inicio),
      peso: p.peso,
      variacao:
        anterior === undefined
          ? null
          : Math.round((p.peso - anterior[1].peso) * 100) / 100,
    };
  });
}

/** O peso mais recente. */
export function ultimoPeso(linhas: readonly PesoBruto[]): { data: string; peso: number } | null {
  const pontos = pontosDePeso(linhas);
  return pontos[pontos.length - 1] ?? null;
}

/** A meta opcional (`profiles.prefs.meta_peso`, SPEC §3.8). */
export function metaDePeso(prefs: Prefs | null | undefined): number | null {
  const valor = prefs?.meta_peso;
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? valor : null;
}

/** Quanto falta para a meta (negativo = já passou dela). */
export function faltaParaMeta(peso: number | null, meta: number | null): number | null {
  if (peso === null || meta === null) return null;
  return Math.round((peso - meta) * 100) / 100;
}

/** Há quantos dias foi a última pesagem. */
export function diasDesdeAPesagem(
  linhas: readonly PesoBruto[],
  hoje: string | Date,
): number | null {
  const ultimo = ultimoPeso(linhas);
  if (!ultimo) return null;
  return differenceInCalendarDays(paraData(hoje), paraData(ultimo.data));
}

/* ------------------------------------------------------------ medidas */

export type CampoDeMedida =
  | "cintura_cm"
  | "peito_cm"
  | "quadril_cm"
  | "braco_dir_cm"
  | "braco_esq_cm"
  | "coxa_dir_cm"
  | "coxa_esq_cm"
  | "panturrilha_cm";

export interface MedidaDoCorpo {
  campo: CampoDeMedida;
  nome: string;
  /** Onde passar a fita — o texto curto que aparece embaixo do campo. */
  onde: string;
}

/** Os 8 campos de `body_measurements` (supabase/schema.sql). */
export const MEDIDAS: readonly MedidaDoCorpo[] = [
  { campo: "peito_cm", nome: "Peito", onde: "na linha dos mamilos, braços soltos" },
  { campo: "cintura_cm", nome: "Cintura", onde: "na altura do umbigo, sem prender a barriga" },
  { campo: "quadril_cm", nome: "Quadril", onde: "na parte mais larga do glúteo" },
  { campo: "braco_dir_cm", nome: "Braço direito", onde: "no meio do bíceps, braço relaxado" },
  { campo: "braco_esq_cm", nome: "Braço esquerdo", onde: "no meio do bíceps, braço relaxado" },
  { campo: "coxa_dir_cm", nome: "Coxa direita", onde: "a 20 cm acima do joelho" },
  { campo: "coxa_esq_cm", nome: "Coxa esquerda", onde: "a 20 cm acima do joelho" },
  { campo: "panturrilha_cm", nome: "Panturrilha", onde: "na parte mais grossa" },
];

export type MedidasBrutas = Pick<LinhaMedidas, "data" | CampoDeMedida>;

export interface PontoDeMedida {
  data: string;
  rotulo: string;
  valor: number;
}

/** A série de uma medida, em ordem de data e sem os dias em branco. */
export function serieDeMedida(
  linhas: readonly MedidasBrutas[],
  campo: CampoDeMedida,
): PontoDeMedida[] {
  return linhas
    .filter((l) => l[campo] !== null && l[campo] !== undefined)
    .map((l) => ({ data: l.data, rotulo: rotulo(l.data), valor: Number(l[campo]) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** As medidas em ordem de data decrescente (a tabela da tela). */
export function medidasPorData(linhas: readonly MedidasBrutas[]): MedidasBrutas[] {
  return [...linhas].sort((a, b) => b.data.localeCompare(a.data));
}

/** Diferença da medida entre o registro mais novo e o anterior. */
export function variacaoDaMedida(
  linhas: readonly MedidasBrutas[],
  campo: CampoDeMedida,
): number | null {
  const serie = serieDeMedida(linhas, campo);
  const ultimo = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  if (!ultimo || !anterior) return null;
  return Math.round((ultimo.valor - anterior.valor) * 10) / 10;
}

/* -------------------------------------------------------------- fotos */

export const ANGULOS: readonly AnguloFoto[] = ["frente", "lado", "costas"];

export const NOME_ANGULO: Record<AnguloFoto, string> = {
  frente: "Frente",
  lado: "Lado",
  costas: "Costas",
};

export type FotoBruta = Pick<
  LinhaFotoProgresso,
  "id" | "data" | "angulo" | "storage_path"
>;

/** O caminho no bucket privado `progresso` (supabase/schema.sql). */
export function caminhoDaFoto(
  userId: string,
  data: string,
  angulo: AnguloFoto,
): string {
  return `${userId}/${data}-${angulo}.jpg`;
}

export interface DiaDeFotos {
  data: string;
  fotos: Record<AnguloFoto, FotoBruta | null>;
  quantas: number;
}

/** As fotos agrupadas por dia, da mais nova para a mais antiga. */
export function fotosPorData(linhas: readonly FotoBruta[]): DiaDeFotos[] {
  const dias = new Map<string, DiaDeFotos>();
  for (const f of linhas) {
    let dia = dias.get(f.data);
    if (!dia) {
      dia = { data: f.data, fotos: { frente: null, lado: null, costas: null }, quantas: 0 };
      dias.set(f.data, dia);
    }
    if (dia.fotos[f.angulo] === null) dia.quantas += 1;
    dia.fotos[f.angulo] = f;
  }
  return [...dias.values()].sort((a, b) => b.data.localeCompare(a.data));
}

/** As duas datas que a comparação abre por padrão: a mais antiga e a mais nova. */
export function parDeComparacao(
  dias: readonly DiaDeFotos[],
): { antes: string | null; depois: string | null } {
  if (dias.length === 0) return { antes: null, depois: null };
  const depois = dias[0]?.data ?? null;
  const antes = dias[dias.length - 1]?.data ?? depois;
  return { antes, depois };
}

/** Os ângulos que as duas datas têm em comum (o slider só mostra esses). */
export function angulosEmComum(
  a: DiaDeFotos | null,
  b: DiaDeFotos | null,
): AnguloFoto[] {
  if (!a || !b) return [];
  return ANGULOS.filter((ang) => a.fotos[ang] !== null && b.fotos[ang] !== null);
}

/* ---------------------------------------------- redimensionar a foto */

/**
 * O tamanho da foto depois de caber em `max` px no maior lado (SPEC §3.8).
 * A conta é pura; quem desenha no canvas é `lib/imagem.ts` (navegador).
 */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  max = 1600,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max || maior === 0) {
    return { largura: Math.round(largura), altura: Math.round(altura) };
  }
  const fator = max / maior;
  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  };
}

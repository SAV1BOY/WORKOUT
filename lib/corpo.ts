/**
 * Corpo (SPEC §3.8): peso, medidas e fotos.
 *
 * Funções puras sobre as linhas de `body_weights`, `body_measurements` e
 * `progress_photos`. A tela (`components/corpo/`) só desenha; a fila de saída
 * (`lib/queries/corpo.ts`) só grava.
 */
import { addDays, differenceInCalendarDays } from "date-fns";
import { inicioDaSemana, iso, paraData } from "@/lib/calendario";
import { medidasDoCorpo } from "@/lib/dados";
import { formatarNumero } from "@/lib/formato";
import type { CampoDeMedida, MedidaDoCorpo } from "@/lib/schemas";
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

/**
 * Domínio folgado para o eixo y de um gráfico de linha (SPEC §3.8).
 *
 * O padrão do Recharts é `[0, "auto"]`: com 30 pesagens entre 81 e 83 kg o
 * eixo vai de 0 a 100, a série e a média de 7 dias viram um traço reto e a
 * média móvel que a §3.8 pede é justamente o que não dá para ver. Aqui o eixo
 * cerca os valores com `folga` de cada lado, arredondando para fora para os
 * rótulos saírem inteiros. Sem valor nenhum devolve `["auto", "auto"]` — o
 * gráfico nem é desenhado nesse caso, mas o domínio não pode mentir.
 */
export function dominioFolgado(
  valores: readonly number[],
  folga = 1,
): [number, number] | ["auto", "auto"] {
  const finitos = valores.filter((v) => Number.isFinite(v));
  if (finitos.length === 0) return ["auto", "auto"];
  return [
    Math.floor(Math.min(...finitos)) - folga,
    Math.ceil(Math.max(...finitos)) + folga,
  ];
}

/* ------------------------------------------------ régua do peso (§22.19) */

/** O passo dos rótulos do eixo do peso, em kg, do preferido para o mais largo. */
export const PASSOS_DO_PESO = [2, 5, 10, 20, 50] as const;

/**
 * Quantos intervalos cabem no eixo y: a 120 px de altura (o card do
 * Relatório), seis rótulos de 10 px já ficam a ~18 px um do outro.
 */
export const INTERVALOS_MAX = 5;

export interface ReguaDoEixo {
  dominio: [number, number];
  ticks: number[];
}

/**
 * A régua de um eixo y de peso (SPEC §22.19 item 3) — quem chama é
 * `reguaDoPeso`, a dos DOIS gráficos de peso (Corpo e Relatório). O menor e
 * o maior valor são arredondados para fora em múltiplos do passo e os
 * rótulos vão de passo em passo. O passo é 2 kg e só
 * sobe (5, 10, 20, 50) quando a faixa passaria de `INTERVALOS_MAX`
 * intervalos. Um valor só — ou todos iguais e já múltiplos do passo — abre
 * um passo para cada lado, senão o eixo teria altura zero. Sem valor
 * nenhum: `null` (o gráfico nem é desenhado).
 *
 * `foraDoPiso` (a meta): se ele cair exatamente no menor rótulo, a régua
 * abre mais um passo para baixo — a linha tracejada da meta não se deita
 * sobre a linha do eixo x (SPEC §22.19 item 3).
 */
export function reguaDoEixo(
  valores: readonly number[],
  foraDoPiso: number | null = null,
): ReguaDoEixo | null {
  const finitos = valores.filter((v) => Number.isFinite(v));
  if (finitos.length === 0) return null;
  const menor = Math.min(...finitos);
  const maior = Math.max(...finitos);
  let escolha: { de: number; ate: number; passo: number } | null = null;
  for (const passo of PASSOS_DO_PESO) {
    let de = Math.floor(menor / passo) * passo;
    let ate = Math.ceil(maior / passo) * passo;
    if (de === ate) {
      de -= passo;
      ate += passo;
    }
    if (foraDoPiso !== null && Math.abs(foraDoPiso - de) < 1e-9) de -= passo;
    escolha = { de, ate, passo };
    if ((ate - de) / passo <= INTERVALOS_MAX) break;
  }
  if (!escolha) return null;
  const ticks: number[] = [];
  for (let v = escolha.de; v <= escolha.ate + 1e-9; v += escolha.passo) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { dominio: [escolha.de, escolha.ate], ticks };
}

/**
 * A régua dos gráficos de peso: as pesagens (uma por dia, como o gráfico as
 * desenha) e a meta, se houver. A média de 7 dias nunca sai da faixa das
 * pesagens, então não muda a régua — por isso o Corpo (com a média) e o
 * Relatório (sem ela) têm o MESMO eixo para as mesmas pesagens.
 */
export function reguaDoPeso(
  linhas: readonly PesoBruto[],
  meta: number | null = null,
): ReguaDoEixo | null {
  const valores = pontosDePeso(linhas).map((p) => p.peso);
  if (valores.length === 0) return null;
  return meta === null ? reguaDoEixo(valores) : reguaDoEixo([...valores, meta], meta);
}

/**
 * Os pontos do gráfico do peso: os de `mediaMovel`, com a média de 7 dias em
 * 1 casa, como o peso (SPEC §22.19 item 3) — a leitura em texto e a dica
 * diziam "81,97 kg" quando o resto do app fala "82 kg".
 */
export function pontosDoGraficoDoPeso(linhas: readonly PesoBruto[], dias = 7): PontoDePeso[] {
  return mediaMovel(linhas, dias).map((p) => ({ ...p, media: Math.round(p.media * 10) / 10 }));
}

/**
 * A média de 7 dias tem ponto próprio? Só quando alguma pesagem tem outra
 * até `dias − 1` dias antes (a janela de calendário de `mediaMovel`). Sem
 * isso, cada "média" é a cópia do próprio peso: a série não diz nada e a
 * legenda não pode citá-la (SPEC §22.19 item 3).
 */
export function mediaTemPontos(linhas: readonly PesoBruto[], dias = 7): boolean {
  const pontos = pontosDePeso(linhas);
  for (let i = 1; i < pontos.length; i++) {
    const antes = pontos[i - 1];
    const agora = pontos[i];
    if (!antes || !agora) continue;
    if (differenceInCalendarDays(paraData(agora.data), paraData(antes.data)) <= dias - 1) {
      return true;
    }
  }
  return false;
}

export type ChaveDaSerieDePeso = "peso" | "media";

/** As séries que o gráfico do peso desenha: o peso sempre, a média se tiver pontos. */
export function seriesDoPeso(linhas: readonly PesoBruto[]): ChaveDaSerieDePeso[] {
  return mediaTemPontos(linhas) ? ["peso", "media"] : ["peso"];
}

/** Da primeira à última pesagem: quanto mudou e desde quando. `null` com menos de duas. */
export function variacaoDoPeriodo(
  linhas: readonly PesoBruto[],
): { variacao: number; desde: string } | null {
  const pontos = pontosDePeso(linhas);
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  if (!primeiro || !ultimo || pontos.length < 2) return null;
  return {
    variacao: Math.round((ultimo.peso - primeiro.peso) * 100) / 100,
    desde: primeiro.data,
  };
}

/**
 * "−1,8 kg desde 12/08" · "+0,6 kg desde 12/08" · "mesmo peso desde 12/08".
 * A linha do card Peso do Relatório (no lugar do "maior · menor") e da aba
 * Peso do Corpo — uma fonte só. `null` com menos de duas pesagens.
 */
export function textoDaVariacao(linhas: readonly PesoBruto[]): string | null {
  const periodo = variacaoDoPeriodo(linhas);
  if (!periodo) return null;
  const desde = `desde ${rotulo(periodo.desde)}`;
  if (periodo.variacao === 0) return `mesmo peso ${desde}`;
  const sinal = periodo.variacao > 0 ? "+" : "−";
  return `${sinal}${formatarNumero(Math.abs(periodo.variacao))} kg ${desde}`;
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

export type { CampoDeMedida, MedidaDoCorpo };

/**
 * Os 8 campos de `body_measurements` (supabase/schema.sql) com o nome na tela
 * e a microcópia de onde passar a fita: o conteúdo vem de `data/perfil.json`
 * (bloco `medidas`), como todo texto de ajuda do app.
 */
export const MEDIDAS: readonly MedidaDoCorpo[] = medidasDoCorpo;

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

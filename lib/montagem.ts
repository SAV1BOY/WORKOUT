/**
 * Montagem da barra: quais cargas o kit do terraço alcança e quantas anilhas
 * de cada peso vão em cada lado / ponta / pino.
 *
 * Função pura: nada de React, Supabase ou Dexie. O estoque de anilhas e os
 * pesos das barras vêm de data/equipamentos.json (via lib/dados.ts) — aqui só
 * mora a aritmética.
 *
 * Convenções (SPEC §4 e §6.4):
 *  - barra maciça / W / reta oca: `total` é o peso TOTAL (barra + anilhas dos
 *    dois lados);
 *  - halteres: `total` é o peso de UM halter (barra de halter + as duas pontas);
 *    os dois halteres são sempre iguais, então cada peso só pode entrar uma vez
 *    por ponta (4 pontas usam as 4 anilhas de cada peso do estoque);
 *  - polia: `total` é o que está no pino;
 *  - barra fixa / peso corporal / anilha: `total` é o lastro (mochila, colete).
 */
import { anilhasDisponiveis, equipamentos, pesoDaBarra } from "@/lib/dados";
import type { Implemento } from "@/lib/schemas";

/** A barra reta oca não é `implemento` de nenhum exercício, mas pode ser usada. */
export type ImplementoMontagem = Implemento | "barra_reta_oca";

/**
 * A barra W e a barra reta oca vêm com `peso_kg: null` no JSON (ainda serão
 * pesadas). Até lá vale 2,0 kg, o valor usado nos casos de teste do guia;
 * quando o Miguel pesar, o app passa `pesoBarra` e tudo se recalcula.
 */
export const PESO_BARRA_A_PESAR = 2;

export interface OpcoesMontagem {
  /** Peso da barra em kg, para sobrescrever o do JSON (barra W / reta oca). */
  pesoBarra?: number;
}

export type OndeVaiAAnilha =
  | "porLado"
  | "porPonta"
  | "noPino"
  | "naMochila"
  | "nenhum";

export interface Montagem {
  implemento: ImplementoMontagem;
  /** Anilhas de um lado / de uma ponta / do pino, do maior para o menor. */
  anilhas: number[];
  /** Mesmo conteúdo de `anilhas`, com o nome certo para a tela. */
  porLado?: number[];
  porPonta?: number[];
  noPino?: number[];
  naMochila?: number[];
  onde: OndeVaiAAnilha;
  /** Peso da barra (0 na polia e no lastro). */
  pesoBarra: number;
  /** Carga alcançada, na convenção do implemento. */
  total: number;
  /** Carga pedida. */
  pedido: number;
  exato: boolean;
  /** `total - pedido` quando não fecha exato (sempre ≤ 0). */
  diferenca?: number;
  aviso?: string;
}

interface Config {
  /** Peso da barra. */
  base: number;
  /** 2 quando as anilhas entram dos dois lados (barra, halter), 1 no pino. */
  fator: 1 | 2;
  /** Quantas anilhas de cada peso cabem em um lado / ponta / pino. */
  limitePorPeso: number;
  /** Teto do implemento, na convenção do `total`. */
  capacidade: number;
  onde: OndeVaiAAnilha;
}

function capacidadeDaBarra(id: string, padrao: number): number {
  return equipamentos.barras.find((b) => b.id === id)?.capacidade_kg ?? padrao;
}

function configuracao(
  implemento: ImplementoMontagem,
  opcoes: OpcoesMontagem = {},
): Config {
  switch (implemento) {
    case "barra_macica":
      return {
        base: opcoes.pesoBarra ?? pesoDaBarra("barra-macica") ?? 7.5,
        fator: 2,
        limitePorPeso: 2,
        capacidade: capacidadeDaBarra("barra-macica", 400),
        onde: "porLado",
      };
    case "barra_w":
      return {
        base: opcoes.pesoBarra ?? pesoDaBarra("barra-w") ?? PESO_BARRA_A_PESAR,
        fator: 2,
        limitePorPeso: 2,
        capacidade: capacidadeDaBarra("barra-w", 50),
        onde: "porLado",
      };
    case "barra_reta_oca":
      return {
        base:
          opcoes.pesoBarra ?? pesoDaBarra("barra-reta-oca") ?? PESO_BARRA_A_PESAR,
        fator: 2,
        limitePorPeso: 2,
        capacidade: capacidadeDaBarra("barra-reta-oca", 60),
        onde: "porLado",
      };
    case "halteres":
      return {
        base: opcoes.pesoBarra ?? pesoDaBarra("halteres") ?? 1.5,
        fator: 2,
        // os dois halteres são iguais: 4 pontas × 1 anilha = as 4 do estoque
        limitePorPeso: 1,
        capacidade: capacidadeDaBarra("halteres", 40),
        onde: "porPonta",
      };
    case "polia":
      return {
        base: 0,
        fator: 1,
        limitePorPeso: Number.POSITIVE_INFINITY,
        capacidade: 100,
        onde: "noPino",
      };
    case "barra_fixa":
    case "peso_corporal":
    case "anilha":
      return {
        base: 0,
        fator: 1,
        limitePorPeso: Number.POSITIVE_INFINITY,
        capacidade: equipamentos.anilhas.total_kg,
        onde: "naMochila",
      };
    case "corda":
    case "band":
      return { base: 0, fator: 1, limitePorPeso: 0, capacidade: 0, onde: "nenhum" };
  }
}

/** Pesos do estoque, do maior para o menor, com o limite deste implemento. */
function pesosDisponiveis(cfg: Config): { kg: number; max: number }[] {
  return anilhasDisponiveis()
    .map((a) => ({ kg: a.kg, max: Math.min(a.qtd, cfg.limitePorPeso) }))
    .filter((p) => p.max > 0);
}

function arredondar(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Somas inteiras possíveis de um lado / ponta / pino, em ordem crescente. */
function somasPossiveis(cfg: Config): number[] {
  const pesos = pesosDisponiveis(cfg);
  const teto = Math.max(0, Math.floor((cfg.capacidade - cfg.base) / cfg.fator));
  const alcancavel = new Set<number>([0]);
  for (const { kg, max } of pesos) {
    const atual = [...alcancavel];
    for (const s of atual) {
      for (let n = 1; n <= max; n++) {
        const soma = s + n * kg;
        if (soma <= teto) alcancavel.add(soma);
        else break;
      }
    }
  }
  return [...alcancavel].sort((a, b) => a - b);
}

/** Guloso do maior para o menor, com volta atrás quando o resto não fecha. */
function combinar(
  alvo: number,
  i: number,
  pesos: { kg: number; max: number }[],
): number[] | null {
  if (alvo === 0) return [];
  const p = pesos[i];
  if (!p) return null;
  const maximo = Math.min(p.max, Math.floor(alvo / p.kg));
  for (let n = maximo; n >= 0; n--) {
    const resto = combinar(alvo - n * p.kg, i + 1, pesos);
    if (resto) return [...(Array(n).fill(p.kg) as number[]), ...resto];
  }
  return null;
}

const cacheEscala = new Map<string, number[]>();

/**
 * Todas as cargas que o kit alcança neste implemento, em ordem crescente.
 * Barra maciça: 7,5 · 9,5 · … · 107,5. Halteres: 1,5 · 3,5 · … · 39,5 (por
 * halter). Polia: 0 a 100. Corda e elástico: só 0.
 */
export function cargasPossiveis(
  implemento: ImplementoMontagem,
  opcoes: OpcoesMontagem = {},
): number[] {
  const cfg = configuracao(implemento, opcoes);
  if (cfg.onde === "nenhum") return [0];
  const chave = `${implemento}:${cfg.base}`;
  const guardado = cacheEscala.get(chave);
  if (guardado) return guardado;
  const escala = somasPossiveis(cfg).map((s) => arredondar(cfg.base + cfg.fator * s));
  cacheEscala.set(chave, escala);
  return escala;
}

/**
 * A carga alcançável mais próxima **para baixo** (SPEC §6.4). Abaixo do mínimo
 * do implemento devolve o mínimo (barra vazia).
 */
export function alcancavelParaBaixo(
  kg: number,
  implemento: ImplementoMontagem,
  opcoes: OpcoesMontagem = {},
): number {
  const escala = cargasPossiveis(implemento, opcoes);
  const minimo = escala[0] ?? 0;
  let melhor = minimo;
  for (const carga of escala) {
    if (carga <= kg + 1e-9) melhor = carga;
    else break;
  }
  return melhor;
}

/** A menor carga do implemento (barra vazia, pino vazio). */
export function cargaMinima(
  implemento: ImplementoMontagem,
  opcoes: OpcoesMontagem = {},
): number {
  return cargasPossiveis(implemento, opcoes)[0] ?? 0;
}

/** A maior carga que o kit alcança neste implemento. */
export function cargaMaxima(
  implemento: ImplementoMontagem,
  opcoes: OpcoesMontagem = {},
): number {
  const escala = cargasPossiveis(implemento, opcoes);
  return escala[escala.length - 1] ?? 0;
}

/**
 * Quantas anilhas de cada peso, do maior para o menor, em um lado (barra),
 * em uma ponta (halteres), no pino (polia) ou na mochila (lastro).
 * Quando a carga pedida não existe na escala, devolve a alcançável para baixo
 * com `exato: false` e a `diferenca`; acima do teto do kit, com `aviso`.
 */
export function montagem(
  kg: number,
  implemento: ImplementoMontagem,
  opcoes: OpcoesMontagem = {},
): Montagem {
  const cfg = configuracao(implemento, opcoes);
  const pedido = arredondar(kg);

  if (cfg.onde === "nenhum") {
    return {
      implemento,
      anilhas: [],
      onde: "nenhum",
      pesoBarra: 0,
      total: 0,
      pedido,
      exato: pedido === 0,
    };
  }

  const total = alcancavelParaBaixo(kg, implemento, opcoes);
  const soma = Math.round((total - cfg.base) / cfg.fator);
  const anilhas = combinar(soma, 0, pesosDisponiveis(cfg)) ?? [];

  const m: Montagem = {
    implemento,
    anilhas,
    onde: cfg.onde,
    pesoBarra: cfg.base,
    total,
    pedido,
    exato: Math.abs(total - pedido) < 1e-9,
  };
  if (cfg.onde === "porLado") m.porLado = anilhas;
  else if (cfg.onde === "porPonta") m.porPonta = anilhas;
  else if (cfg.onde === "noPino") m.noPino = anilhas;
  else m.naMochila = anilhas;
  if (!m.exato) m.diferenca = arredondar(total - pedido);
  if (pedido > cargaMaxima(implemento, opcoes) + 1e-9) {
    m.aviso = "faltam anilhas de 10 kg";
  }
  return m;
}

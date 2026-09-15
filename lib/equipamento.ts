/**
 * O que existe no terraço (SPEC §3.9, tela Equipamento). Tudo vem de
 * `data/equipamentos.json`: aqui só se organiza para a tela — nenhum nome,
 * spec ou medida é escrito no código.
 */
import { caminhoPublico, equipamentos, pesoDaBarra } from "@/lib/dados";
import { PESO_BARRA_A_PESAR, type BarraId } from "@/lib/montagem";
import { pesosDasBarras } from "@/lib/preferencias";
import type { Prefs } from "@/lib/types";

/* --------------------------------------------------------- os 10 itens */

export interface ItemDoTerraco {
  id: string;
  nome: string;
  specs: string;
  /** A primeira foto da pasta do item (`assets/itens/<id>/<id>_01.jpg`). */
  foto: string;
}

/**
 * As fotos de cada item ficam numeradas na pasta dele (`banco_01.jpg`…). A
 * lista mostra a primeira; `data/equipamentos.json` guarda a pasta.
 */
export function fotoDoItem(id: string, pasta: string): string {
  const base = caminhoPublico(pasta).replace(/\/+$/, "");
  return `${base}/${id}_01.jpg`;
}

export function itensDoTerraco(): ItemDoTerraco[] {
  return equipamentos.itens.map((item) => ({
    id: item.id,
    nome: item.nome,
    specs: item.specs,
    foto: fotoDoItem(item.id, item.fotos),
  }));
}

/* ------------------------------------------------------- barras e pesos */

export type OrigemDoPeso = "perfil" | "json" | "provisorio";

export interface BarraDoTerraco {
  id: BarraId;
  nome: string;
  uso: string;
  capacidadeKg: number | null;
  /** O peso de `data/equipamentos.json` (null = ainda será pesada). */
  pesoDoJson: number | null;
  /** O peso medido na balança e guardado em `prefs.pesos_barras`. */
  pesoDoPerfil: number | null;
  /** O peso que a montagem usa hoje. */
  pesoKg: number;
  origem: OrigemDoPeso;
}

function ehIdDeBarra(id: string): id is BarraId {
  return (
    id === "barra-macica" ||
    id === "barra-w" ||
    id === "barra-reta-oca" ||
    id === "halteres"
  );
}

/**
 * As barras do kit com o peso que vale hoje: o que o perfil mediu vence o
 * JSON; sem nenhum dos dois vale o provisório de 2 kg (SPEC §3.9).
 */
export function barrasDoTerraco(
  prefs: Prefs | null | undefined,
): BarraDoTerraco[] {
  const doPerfil = pesosDasBarras(prefs);
  return equipamentos.barras.filter((b) => ehIdDeBarra(b.id)).map((b) => {
    const id = b.id as BarraId;
    const pesoDoPerfil = doPerfil[id] ?? null;
    const pesoDoJson = pesoDaBarra(id);
    const pesoKg = pesoDoPerfil ?? pesoDoJson ?? PESO_BARRA_A_PESAR;
    const origem: OrigemDoPeso =
      pesoDoPerfil !== null ? "perfil" : pesoDoJson !== null ? "json" : "provisorio";
    return {
      id,
      nome: b.nome,
      uso: b.uso,
      capacidadeKg: b.capacidade_kg ?? null,
      pesoDoJson,
      pesoDoPerfil,
      pesoKg,
      origem,
    };
  });
}

/* ----------------------------------------------------------- as anilhas */

export interface AnilhaDoKit {
  kg: number;
  qtd: number;
  diametroMm: number | null;
}

/** As anilhas do estoque, do maior para o menor peso. */
export function anilhasDoKit(): AnilhaDoKit[] {
  return [...equipamentos.anilhas.pecas]
    .sort((a, b) => b.kg - a.kg)
    .map((a) => ({ kg: a.kg, qtd: a.qtd, diametroMm: a.diametro_mm ?? null }));
}

export function totalDeAnilhasKg(): number {
  return equipamentos.anilhas.total_kg;
}

export function notaDasAnilhas(): string {
  return equipamentos.anilhas.nota;
}

export function presilhas(): number {
  return equipamentos.presilhas;
}

/** O que o guia diz que ainda falta comprar (`equipamentos.faltam`). */
export function oQueFalta(): string[] {
  return [...equipamentos.faltam];
}

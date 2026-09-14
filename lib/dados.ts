/**
 * Único ponto de entrada do conteúdo: importa os JSON de data/, valida com
 * zod na carga do módulo (falha ruidosa se algo estiver errado) e expõe
 * índices e helpers pequenos. Nenhum conteúdo de treino é escrito aqui.
 */
import cardioJson from "@/data/cardio.json";
import equipamentosJson from "@/data/equipamentos.json";
import exerciciosJson from "@/data/exercicios.json";
import perfilJson from "@/data/perfil.json";
import programaJson from "@/data/programa.json";
import progressaoJson from "@/data/progressao.json";
import {
  cardioSchema,
  equipamentosSchema,
  exerciciosSchema,
  perfilSchema,
  programaSchema,
  progressaoJsonSchema,
  type DiaPrograma,
  type DiaSemana,
  type Exercicio,
  type Fase,
  type FaseId,
  type Treino,
  type TreinoId,
} from "@/lib/schemas";
import type { ZodType } from "zod";

function validar<T>(schema: ZodType<T>, valor: unknown, arquivo: string): T {
  const r = schema.safeParse(valor);
  if (!r.success) {
    const primeiro = r.error.issues[0];
    const onde = primeiro ? primeiro.path.join(".") : "?";
    const msg = primeiro ? primeiro.message : "formato inválido";
    throw new Error(`data/${arquivo} inválido em "${onde}": ${msg}`);
  }
  return r.data;
}

export const exercicios = validar(
  exerciciosSchema,
  exerciciosJson,
  "exercicios.json",
);
export const programa = validar(programaSchema, programaJson, "programa.json");
export const cardio = validar(cardioSchema, cardioJson, "cardio.json");
export const progressao = validar(
  progressaoJsonSchema,
  progressaoJson,
  "progressao.json",
);
export const equipamentos = validar(
  equipamentosSchema,
  equipamentosJson,
  "equipamentos.json",
);
export const perfilInicial = validar(perfilSchema, perfilJson, "perfil.json");

/* --------------------------------------------------------------- índices */

export const exercicioPorId: ReadonlyMap<string, Exercicio> = new Map(
  exercicios.map((e) => [e.id, e]),
);

export const treinoPorId = programa.treinos as Readonly<
  Record<TreinoId, Treino>
>;

export const fasePorId: ReadonlyMap<FaseId, Fase> = new Map(
  programa.fases.map((f) => [f.id, f]),
);

export const DIAS: readonly DiaSemana[] = [
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
  "dom",
];

/* --------------------------------------------------------------- helpers */

/** Exercício por id; erro claro se o id não existir no catálogo. */
export function acharExercicio(id: string): Exercicio {
  const e = exercicioPorId.get(id);
  if (!e) throw new Error(`exercício desconhecido: ${id}`);
  return e;
}

export function acharTreino(id: TreinoId): Treino {
  return treinoPorId[id];
}

export function acharFase(id: FaseId): Fase {
  const f = fasePorId.get(id);
  if (!f) throw new Error(`fase desconhecida: ${id}`);
  return f;
}

/** "assets/figuras/x.svg" → "/figuras/x.svg" (o que npm run assets copiou). */
export function caminhoPublico(caminhoAsset: string): string {
  return `/${caminhoAsset.replace(/^assets\//, "")}`;
}

export function urlFigura(e: Exercicio): string | null {
  return e.figura ? caminhoPublico(e.figura) : null;
}

export function urlFotos(e: Exercicio): string[] {
  return e.fotos.map(caminhoPublico);
}

/** O dia do programa (seg…dom) de uma fase. */
export function diaDoPrograma(fase: FaseId, dia: DiaSemana): DiaPrograma {
  const d = acharFase(fase).semana.find((x) => x.dia === dia);
  if (!d) throw new Error(`dia ${dia} ausente na ${fase}`);
  return d;
}

/** Exercícios de um treino já com a ficha do catálogo ao lado. */
export function exerciciosDoTreino(id: TreinoId) {
  return acharTreino(id).exercicios.map((item) => ({
    item,
    exercicio: acharExercicio(item.exercicio_id),
  }));
}

/** Semana do plano de corrida (1…12), presa aos limites do plano. */
export function semanaDeCorrida(semana: number) {
  const lista = cardio.corrida.semanas;
  const i = Math.min(Math.max(semana, 1), lista.length) - 1;
  const s = lista[i];
  if (!s) throw new Error("plano de corrida vazio");
  return s;
}

/** Estágio da corda que cobre a semana pedida. */
export function estagioDeCorda(semana: number) {
  const lista = cardio.corda.semanas;
  const i = Math.min(Math.max(semana, 1), lista.length) - 1;
  const s = lista[i];
  if (!s) throw new Error("plano de corda vazio");
  return s;
}

/** Bloco de semanas da barra fixa que cobre a semana pedida ("1–2", "3–4"…). */
export function semanaDeBarraFixa(semana: number) {
  const lista = cardio.barra_fixa.semanas;
  const alvo = Math.max(semana, 1);
  const achado = lista.find((s) => {
    const [de, ate] = s.semanas.split(/[–-]/).map((n) => Number(n.trim()));
    if (de === undefined || Number.isNaN(de)) return false;
    const fim = ate === undefined || Number.isNaN(ate) ? de : ate;
    return alvo >= de && alvo <= fim;
  });
  const ultimo = lista[lista.length - 1];
  if (!ultimo) throw new Error("plano de barra fixa vazio");
  return achado ?? ultimo;
}

/** Anilhas disponíveis, do maior para o menor peso. */
export function anilhasDisponiveis() {
  return [...equipamentos.anilhas.pecas].sort((a, b) => b.kg - a.kg);
}

export function pesoDaBarra(id: string): number | null {
  return equipamentos.barras.find((b) => b.id === id)?.peso_kg ?? null;
}

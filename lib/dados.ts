/**
 * Único ponto de entrada do conteúdo: importa os JSON de data/, valida com
 * zod na carga do módulo (falha ruidosa se algo estiver errado) e expõe
 * índices e helpers pequenos. Nenhum conteúdo de treino é escrito aqui.
 */
import cardioJson from "@/data/cardio.json";
import equipamentosJson from "@/data/equipamentos.json";
import exerciciosJson from "@/data/exercicios.json";
import ilustracoesJson from "@/data/ilustracoes.json";
import medidasDeFotoJson from "@/data/medidas-de-foto.json";
import perfilJson from "@/data/perfil.json";
import programaJson from "@/data/programa.json";
import progressaoJson from "@/data/progressao.json";
import tutoriaisJson from "@/data/tutoriais.json";
import {
  cardioSchema,
  equipamentoTagSchema,
  equipamentosSchema,
  exerciciosSchema,
  ilustracoesSchema,
  medidasDeFotoSchema,
  perfilSchema,
  programaSchema,
  progressaoJsonSchema,
  tutoriaisSchema,
  type DiaSemana,
  type EquipamentoTag,
  type Exercicio,
  type Fase,
  type FaseId,
  type Ilustracao,
  type MedidaDeFoto,
  type MedidaDoCorpo,
  type RefDeTexto,
  type Treino,
  type TreinoId,
  type Tutorial,
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
export const ilustracoes = validar(
  ilustracoesSchema,
  ilustracoesJson,
  "ilustracoes.json",
);
export const tutoriais = validar(
  tutoriaisSchema,
  tutoriaisJson,
  "tutoriais.json",
).tutoriais;

/**
 * A medida de cada foto de execução do kit e da derivada WebP (SPEC §22.4
 * item 3). O arquivo é gerado por `npm run assets`, que abre foto por foto
 * com o sharp — as 162 fotos **não** têm todas a mesma medida, e supor isso
 * fazia a `<img>` mais pesada do app reservar uma caixa de proporção errada
 * (auditoria do lote 4). Quem lê isto na tela é `medidaDaFoto` (lib/midia.ts).
 */
export const medidasDeFoto: Readonly<Record<string, MedidaDeFoto>> = validar(
  medidasDeFotoSchema,
  medidasDeFotoJson,
  "medidas-de-foto.json",
).fotos;

/* --------------------------------------------------------------- índices */

export const exercicioPorId: ReadonlyMap<string, Exercicio> = new Map(
  exercicios.map((e) => [e.id, e]),
);

export const ilustracaoPorExercicioId: ReadonlyMap<string, Ilustracao> = new Map(
  ilustracoes.map((i) => [i.exercicio_id, i]),
);

/**
 * A ilustração com licença livre deste exercício (marco Mídia), ou `null`
 * quando ele fica com a figura animada do kit.
 */
export function ilustracaoPorExercicio(id: string): Ilustracao | null {
  return ilustracaoPorExercicioId.get(id) ?? null;
}

export const tutorialPorExercicioId: ReadonlyMap<string, Tutorial> = new Map(
  tutoriais.map((t) => [t.exercicio_id, t]),
);

/** O tutorial do YouTube deste exercício (SPEC §14.2), ou `null`. */
export function tutorialPorExercicio(id: string): Tutorial | null {
  return tutorialPorExercicioId.get(id) ?? null;
}

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

/** As 8 medidas com fita (SPEC §3.8), como estão em data/perfil.json. */
export const medidasDoCorpo: readonly MedidaDoCorpo[] = perfilInicial.medidas;

/* -------------------------------------------------- textos do motor §6 */

const TEXTOS_DO_MOTOR: Readonly<Record<string, string>> = {
  ...progressao.sugestoes,
  ...progressao.avisos,
};

/**
 * A frase de uma sugestão/aviso do motor, com `{reps}` e `{kg}` trocados pelos
 * números da decisão (vírgula decimal, SPEC §1).
 */
export function textoDoMotor(ref: RefDeTexto | null | undefined): string | null {
  if (!ref) return null;
  const modelo = TEXTOS_DO_MOTOR[ref.chave];
  if (modelo === undefined) {
    throw new Error(`data/progressao.json não tem o texto "${ref.chave}"`);
  }
  const dados = ref.dados ?? {};
  return modelo.replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
    const valor = dados[chave];
    if (valor === undefined) return inteiro;
    return typeof valor === "number" ? String(valor).replace(".", ",") : valor;
  });
}

/* ------------------------------------------------------ planos por faixa */

/** "1–2" cobre as semanas 1 e 2; "9–12", da 9 à 12. */
function cobreASemana(faixa: string, semana: number): boolean {
  const [de, ate] = faixa.split(/[–-]/).map((n) => Number(n.trim()));
  if (de === undefined || Number.isNaN(de)) return false;
  const fim = ate === undefined || Number.isNaN(ate) ? de : ate;
  return semana >= de && semana <= fim;
}

/** Estágio da corda que cobre a semana pedida ("1–2", "3–4", … "9–12"). */
export function estagioDeCorda(semana: number) {
  const lista = cardio.corda.semanas;
  const alvo = Math.max(semana, 1);
  const ultimo = lista[lista.length - 1];
  if (!ultimo) throw new Error("plano de corda vazio");
  return lista.find((s) => cobreASemana(s.semanas, alvo)) ?? ultimo;
}

/** Bloco de semanas da barra fixa que cobre a semana pedida ("1–2", "3–4"…). */
export function semanaDeBarraFixa(semana: number) {
  const lista = cardio.barra_fixa.semanas;
  const alvo = Math.max(semana, 1);
  const ultimo = lista[lista.length - 1];
  if (!ultimo) throw new Error("plano de barra fixa vazio");
  return lista.find((s) => cobreASemana(s.semanas, alvo)) ?? ultimo;
}

/**
 * Até que semana um plano por faixas vai ("9–12" → 12). O teto do plano é
 * conteúdo: mudar `data/cardio.json` tem de mudar o app (SPEC §5.5).
 */
export function ultimaSemanaDoPlano(
  faixas: readonly { semanas: string }[],
): number {
  let maior = 1;
  for (const faixa of faixas) {
    const partes = faixa.semanas.split(/[–-]/).map((n) => Number(n.trim()));
    for (const n of partes) {
      if (Number.isFinite(n) && n > maior) maior = n;
    }
  }
  return maior;
}

/** Teto do plano de corda (data/cardio.json). */
export function ultimaSemanaDeCorda(): number {
  return ultimaSemanaDoPlano(cardio.corda.semanas);
}

/** Teto do plano da primeira barra fixa (data/cardio.json). */
export function ultimaSemanaDeBarraFixa(): number {
  return ultimaSemanaDoPlano(cardio.barra_fixa.semanas);
}

/** Teto do plano de corrida — este já é uma semana por linha. */
export function ultimaSemanaDeCorrida(): number {
  return cardio.corrida.semanas.length;
}

/** Anilhas disponíveis, do maior para o menor peso. */
export function anilhasDisponiveis() {
  return [...equipamentos.anilhas.pecas].sort((a, b) => b.kg - a.kg);
}

export function pesoDaBarra(id: string): number | null {
  return equipamentos.barras.find((b) => b.id === id)?.peso_kg ?? null;
}

/**
 * As tags de equipamento que existem no terraço (data/equipamentos.json).
 * Usada pela troca de exercício do dia (SPEC §3.2): só entra na lista quem dá
 * para fazer aqui. O kit de 100 kg traz as anilhas, as barras ocas e os
 * halteres; os demais itens têm o próprio id igual à tag do catálogo.
 */
export function equipamentoDisponivel(): ReadonlySet<EquipamentoTag> {
  const tags = new Set<EquipamentoTag>();
  const talvez = (valor: string) => {
    const r = equipamentoTagSchema.safeParse(valor);
    if (r.success) tags.add(r.data);
  };
  for (const item of equipamentos.itens) talvez(item.id);
  for (const barra of equipamentos.barras) talvez(barra.id);
  if (equipamentos.anilhas.pecas.length > 0) tags.add("anilhas");
  return tags;
}

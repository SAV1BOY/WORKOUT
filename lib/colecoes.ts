/**
 * Coleções derivadas (SPEC §13.4 e §14.3/§14.4).
 *
 * Nada aqui é inventado: os grupos são o campo `grupo` de `exercicios.json`,
 * os aparelhos são `equipamentos.itens`, os circuitos são o campo `subgrupo`
 * (tatame 8 · corda 3 · band 3, os 14 de `origem = "aparelho"`), os planos são
 * `cardio.json` e os treinos são `programa.json`. Só os **rótulos de UI**
 * ("Parte do corpo em foco", "Core no tatame") são escritos aqui, como a
 * §13.8.6 permite.
 *
 * Funções puras: sem React, sem Supabase.
 */
import { capaDoExercicio, capaDoTreino } from "@/lib/capas";
import { SEMANAS_PARA_FASE2 } from "@/lib/calendario";
import { semAcento } from "@/lib/catalogo";
import {
  acharExercicio,
  acharFase,
  acharTreino,
  cardio,
  equipamentoDisponivel,
  equipamentos,
  exercicioPorId,
  exercicios,
  exerciciosDoTreino,
  programa,
  semanaDeCorrida,
  ultimaSemanaDeBarraFixa,
  ultimaSemanaDeCorrida,
} from "@/lib/dados";
import { dificuldadeDaColecao, type Raios } from "@/lib/dificuldade";
import {
  EXERCICIOS_DA_SESSAO_LIVRE,
  detalheDaColecao,
  minutosDaColecao,
  podeCircuito,
} from "@/lib/livre";
import { evitadosPorUltimo } from "@/lib/preferencias";
import type {
  EquipamentoTag,
  Exercicio,
  FaseId,
  Grupo,
  Subgrupo,
  TreinoId,
} from "@/lib/schemas";
import type { Prefs } from "@/lib/types";

export type TipoColecao = "grupo" | "aparelho" | "circuito" | "plano" | "treino";

/** Um plano de `cardio.json` — a coleção não abre sessão livre, abre a rota. */
export type PlanoId = "barra_fixa" | "corrida" | "corda";

export interface Colecao {
  /** "grupo:Core", "aparelho:tatame", "circuito:corda", "treino:A1". */
  id: string;
  tipo: TipoColecao;
  /** O nome que está no JSON (ou o rótulo de UI do circuito). */
  titulo: string;
  /** `foco`, `subtitulo`, `specs`, `regra`, `funções` — sempre do JSON. */
  subtitulo: string | null;
  /** Ids dos exercícios da coleção, na ordem do catálogo. */
  exercicios: string[];
  /** Foto de capa, sempre de `assets/` (SPEC §13.1). */
  capa: string | null;
  raios: Raios | null;
  minutos: number;
  /** "8 exercícios · ~26 min". */
  detalhe: string;
  /** Roda no modo por tempo (SPEC §13.6)? */
  circuito: boolean;
  /** Coleção de plano: para onde o "Fazer a sessão da semana" leva. */
  plano?: PlanoId;
  /** Coleção de treino do programa. */
  treino?: TreinoId;
}

/* ------------------------------------------------------------ apoio */

function fichas(ids: readonly string[]): Exercicio[] {
  return ids.map((id) => acharExercicio(id));
}

function montar(
  id: string,
  tipo: TipoColecao,
  titulo: string,
  subtitulo: string | null,
  lista: readonly Exercicio[],
  extra: Partial<Colecao> = {},
): Colecao {
  const ids = lista.map((e) => e.id);
  const comFoto = lista.find((e) => capaDoExercicio(e) !== null);
  return {
    id,
    tipo,
    titulo,
    subtitulo,
    exercicios: ids,
    capa: extra.capa ?? (comFoto ? capaDoExercicio(comFoto) : null),
    raios: dificuldadeDaColecao(lista),
    minutos: minutosDaColecao(lista),
    detalhe: detalheDaColecao(lista),
    circuito: podeCircuito(ids),
    ...extra,
  };
}

/* ---------------------------------------------- parte do corpo (§14.3) */

/** Os 8 grupos de `exercicios.json`, na ordem em que aparecem. */
export function grupos(): Grupo[] {
  const saida: Grupo[] = [];
  for (const e of exercicios) if (!saida.includes(e.grupo)) saida.push(e.grupo);
  return saida;
}

export function exerciciosDoGrupo(grupo: Grupo): Exercicio[] {
  return exercicios.filter((e) => e.grupo === grupo);
}

export function colecaoDoGrupo(grupo: Grupo): Colecao {
  return montar(`grupo:${grupo}`, "grupo", grupo, null, exerciciosDoGrupo(grupo));
}

export function colecoesPorGrupo(): Colecao[] {
  return grupos().map(colecaoDoGrupo);
}

/* ------------------------------------------------- por aparelho (§13.4) */

/*
 * A capa das coleções por aparelho NÃO é a foto do item (SPEC §15.3): as 95
 * fotos de `assets/itens/` são fotografia de anúncio — obra de terceiro sem
 * licença livre, que só se justifica como o registro particular das compras do
 * dono em Mais → Equipamento. A vitrine do Explorar usa a mesma capa das
 * outras coleções: a foto de execução do primeiro exercício da lista.
 */

/** Os exercícios que este item de `equipamentos.json` permite. */
export function exerciciosDoAparelho(id: string): Exercicio[] {
  return exercicios.filter((e) => (e.equipamento as readonly string[]).includes(id));
}

export function colecaoDoAparelho(id: string): Colecao | null {
  const item = equipamentos.itens.find((i) => i.id === id);
  if (!item) return null;
  const lista = exerciciosDoAparelho(id);
  if (lista.length === 0) return null;
  return montar(`aparelho:${id}`, "aparelho", item.nome, item.specs, lista);
}

export function colecoesPorAparelho(): Colecao[] {
  return equipamentos.itens
    .map((i) => colecaoDoAparelho(i.id))
    .filter((c): c is Colecao => c !== null);
}

/* -------------------------------------------------- circuitos (§13.4) */

/** Rótulo de UI de cada `subgrupo` (o JSON só traz a chave). */
export const NOME_DO_CIRCUITO: Record<Subgrupo, string> = {
  tatame: "Core no tatame",
  corda: "Corda",
  band: "Elástico",
};

export const SUBGRUPOS: readonly Subgrupo[] = ["tatame", "corda", "band"];

export function exerciciosDoCircuito(subgrupo: Subgrupo): Exercicio[] {
  return exercicios.filter((e) => e.subgrupo === subgrupo);
}

export function colecaoDoCircuito(subgrupo: Subgrupo): Colecao {
  const lista = exerciciosDoCircuito(subgrupo);
  const item = equipamentos.itens.find((i) =>
    subgrupo === "band" ? i.id === "super-band" : i.id === subgrupo,
  );
  return montar(
    `circuito:${subgrupo}`,
    "circuito",
    NOME_DO_CIRCUITO[subgrupo],
    item?.specs ?? null,
    lista,
  );
}

export function circuitos(): Colecao[] {
  return SUBGRUPOS.map(colecaoDoCircuito);
}

/* ------------------------------------------------- planos (§13.4/§14.3) */

export interface DadosDoPlano {
  id: PlanoId;
  /**
   * Rótulo de UI curto (SPEC §14.3 e §13.8.6) com o número de semanas que o
   * próprio plano tem; o `objetivo` do JSON fica no subtítulo.
   */
  titulo: string;
  subtitulo: string;
  /** Quantas semanas o plano tem (de `cardio.json`). */
  semanas: number;
  /** A rota que faz a sessão da semana. */
  href: string;
  /** O exercício cuja foto vira a capa (sempre de `assets/`). */
  exercicioDaCapa: string | null;
}

/** "5 km sem parar": a descrição da última semana do plano de corrida. */
function metaDaCorrida(): string {
  return semanaDeCorrida(ultimaSemanaDeCorrida()).descricao;
}

/** Os três planos reais de `data/cardio.json` — nenhum desafio inventado. */
export function planos(): DadosDoPlano[] {
  return [
    {
      /*
       * Título de card (SPEC §14.3): rótulo de UI curto com o número de
       * semanas vindo do plano; o `objetivo` do JSON, que é uma frase inteira
       * em caixa baixa, fica como subtítulo (§13.8.6).
       */
      id: "barra_fixa",
      titulo: `Primeira barra fixa em ${ultimaSemanaDeBarraFixa()} semanas`,
      subtitulo: cardio.barra_fixa.objetivo,
      semanas: ultimaSemanaDeBarraFixa(),
      href: "/barra-fixa",
      exercicioDaCapa: "barra-fixa-assistida",
    },
    {
      id: "corrida",
      titulo: `${metaDaCorrida()} em ${ultimaSemanaDeCorrida()} semanas`,
      subtitulo: cardio.corrida.objetivo,
      semanas: ultimaSemanaDeCorrida(),
      href: "/cardio/corrida",
      exercicioDaCapa: null,
    },
    {
      id: "corda",
      // rótulo de UI com o número de estágios que o próprio plano tem (§13.4)
      titulo: `Corda: ${cardio.corda.semanas.length} estágios`,
      subtitulo: cardio.corda.funcoes.join(" · "),
      semanas: cardio.corda.semanas.length,
      href: "/cardio/corda",
      exercicioDaCapa: "corrida-no-lugar-com-a-corda",
    },
  ];
}

export function colecaoDoPlano(dados: DadosDoPlano): Colecao {
  const lista = dados.exercicioDaCapa ? fichas([dados.exercicioDaCapa]) : [];
  return montar(`plano:${dados.id}`, "plano", dados.titulo, dados.subtitulo, lista, {
    plano: dados.id,
    /*
     * Um plano não é uma lista de exercícios: é a prescrição por semana de
     * `cardio.json`, e a lista daqui tem no máximo o exercício da capa. Contar
     * exercícios dava "0 exercícios · ~1 min" na corrida — informação errada
     * na tela. O que descreve um plano é o tamanho dele, que é do JSON.
     */
    minutos: 0,
    detalhe: `${dados.semanas} semanas`,
  });
}

export function colecoesDePlano(): Colecao[] {
  return planos().map(colecaoDoPlano);
}

/* ------------------------------------------ treinos do programa (§13.4) */

export function colecaoDoTreino(id: TreinoId): Colecao {
  const treino = acharTreino(id);
  const lista = exerciciosDoTreino(id).map(({ exercicio }) => exercicio);
  return montar(`treino:${id}`, "treino", treino.nome, treino.subtitulo, lista, {
    treino: id,
    minutos: treino.duracao_min,
    detalhe: `${lista.length} exercícios · ~${treino.duracao_min} min`,
  });
}

export function colecoesDeTreino(): Colecao[] {
  return (Object.keys(programa.treinos) as TreinoId[]).map(colecaoDoTreino);
}

/* -------------------------------------------------------- a vitrine */

/** Todas as coleções derivadas, na ordem da vitrine (SPEC §14.4). */
export function todasAsColecoes(): Colecao[] {
  return [
    ...colecoesDeTreino(),
    ...colecoesPorGrupo(),
    ...circuitos(),
    ...colecoesPorAparelho(),
    ...colecoesDePlano(),
  ];
}

export function acharColecao(id: string, lista = todasAsColecoes()): Colecao | null {
  return lista.find((c) => c.id === id) ?? null;
}

/* ---------------------------------------------- filtros derivados (§14.3) */

export type ChaveDoFiltro =
  | "ate15"
  | "de15a30"
  | "com-equipamento"
  | "sem-equipamento"
  | "core"
  | "cardio";

export const FILTROS: readonly { chave: ChaveDoFiltro; rotulo: string }[] = [
  { chave: "ate15", rotulo: "≤ 15 min" },
  { chave: "de15a30", rotulo: "15–30 min" },
  { chave: "com-equipamento", rotulo: "Com equipamento" },
  { chave: "sem-equipamento", rotulo: "Sem equipamento" },
  { chave: "core", rotulo: "Core" },
  { chave: "cardio", rotulo: "Cardio" },
];

/**
 * Os filtros de tempo olham a coleção inteira; os outros quatro olham
 * **exercício por exercício** — um grupo mistura barra e peso do corpo, então
 * "sem equipamento" que exigisse a coleção toda esvaziaria os oito grupos.
 */
export const FILTROS_DE_TEMPO: readonly ChaveDoFiltro[] = ["ate15", "de15a30"];

/** Só o peso do corpo: nada além do tatame, que é o chão do terraço. */
export function semEquipamento(exercicio: Exercicio): boolean {
  return exercicio.equipamento.every((tag) => tag === "tatame");
}

export function exercicioPassaNoFiltro(
  exercicio: Exercicio,
  filtro: ChaveDoFiltro,
): boolean {
  if (filtro === "com-equipamento") return !semEquipamento(exercicio);
  if (filtro === "sem-equipamento") return semEquipamento(exercicio);
  if (filtro === "core") return exercicio.grupo === "Core";
  if (filtro === "cardio") return exercicio.grupo === "Cardio";
  return true;
}

/** Os exercícios de uma coleção que passam nos filtros de conteúdo. */
export function exerciciosFiltrados(
  ids: readonly string[],
  filtros: readonly ChaveDoFiltro[],
): string[] {
  const doConteudo = filtros.filter((f) => !FILTROS_DE_TEMPO.includes(f));
  if (doConteudo.length === 0) return [...ids];
  return ids.filter((id) => {
    const e = exercicioPorId.get(id);
    return e !== undefined && doConteudo.every((f) => exercicioPassaNoFiltro(e, f));
  });
}

export function passaNoTempo(minutos: number, filtro: ChaveDoFiltro): boolean {
  if (filtro === "ate15") return minutos <= 15;
  if (filtro === "de15a30") return minutos > 15 && minutos <= 30;
  return true;
}

/**
 * A coleção depois dos filtros: a lista encolhe, a contagem e os minutos são
 * recalculados, e `null` quando não sobrou exercício ou o tempo não bate.
 */
export function colecaoFiltrada(
  colecao: Colecao,
  filtros: readonly ChaveDoFiltro[],
): Colecao | null {
  const ids = exerciciosFiltrados(colecao.exercicios, filtros);
  if (ids.length === 0) return null;
  const lista = fichas(ids);
  const minutos = minutosDaColecao(lista);
  for (const f of filtros) {
    if (FILTROS_DE_TEMPO.includes(f) && !passaNoTempo(minutos, f)) return null;
  }
  if (ids.length === colecao.exercicios.length) return colecao;
  return {
    ...colecao,
    exercicios: ids,
    raios: dificuldadeDaColecao(lista),
    minutos,
    detalhe: detalheDaColecao(lista),
    circuito: podeCircuito(ids),
  };
}

export function filtrarColecoes(
  lista: readonly Colecao[],
  filtros: readonly ChaveDoFiltro[],
): Colecao[] {
  if (filtros.length === 0) return [...lista];
  return lista.flatMap((c) => {
    const filtrada = colecaoFiltrada(c, filtros);
    return filtrada ? [filtrada] : [];
  });
}

/* ------------------------------------------------------------ busca */

/** Busca sem acento, por título da coleção ou nome de exercício dentro dela. */
export function buscarColecoes(
  termo: string,
  lista: readonly Colecao[] = todasAsColecoes(),
): Colecao[] {
  const termos = semAcento(termo).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...lista];
  return lista.filter((c) => {
    const alvo = semAcento(
      [c.titulo, c.subtitulo ?? "", ...c.exercicios.map((id) => exercicioPorId.get(id)?.nome ?? "")]
        .join(" "),
    );
    return termos.every((t) => alvo.includes(t));
  });
}

/* --------------------------------- a lista que vira sessão livre (§14.3) */

/** A ordem do motor: composto pesado, composto moderado, depois isolamento. */
const PESO_DA_CATEGORIA: Record<Exercicio["categoria"], number> = {
  composto_pesado: 0,
  composto_moderado: 1,
  core_peso_corporal: 2,
  isolamento: 3,
};

export interface OpcoesDaSessaoLivre {
  /** As tags do terraço; o que não dá para fazer aqui fica de fora. */
  disponiveis?: ReadonlySet<EquipamentoTag>;
  /** `profiles.prefs` — o "não gosto" cai para o fim (SPEC §14.1.2). */
  prefs?: Prefs | null;
  limite?: number;
}

export function equipamentoCabe(
  exercicio: Exercicio,
  disponiveis: ReadonlySet<EquipamentoTag>,
): boolean {
  return exercicio.equipamento.every((tag) => disponiveis.has(tag));
}

/**
 * Os exercícios que o "Começar" de uma coleção leva para a sessão livre
 * (SPEC §14.3): só o que dá para fazer com o equipamento do terraço, compostos
 * antes de isolamento, "não gosto" por último, e os `limite` primeiros.
 */
export function exerciciosParaSessao(
  ids: readonly string[],
  opcoes: OpcoesDaSessaoLivre = {},
): string[] {
  const disponiveis = opcoes.disponiveis ?? equipamentoDisponivel();
  const limite = opcoes.limite ?? EXERCICIOS_DA_SESSAO_LIVRE;

  const cabem = ids
    .map((id) => exercicioPorId.get(id))
    .filter((e): e is Exercicio => e !== undefined && equipamentoCabe(e, disponiveis));

  const ordenados = cabem
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const peso = PESO_DA_CATEGORIA[a.e.categoria] - PESO_DA_CATEGORIA[b.e.categoria];
      return peso !== 0 ? peso : a.i - b.i;
    })
    .map(({ e }) => e);

  // o "não gosto" só muda a ordem: ninguém some da lista (§14.1.2)
  const comEvitadosNoFim = evitadosPorUltimo(ordenados, (e) => e.id, opcoes.prefs);
  return comEvitadosNoFim.slice(0, limite).map((e) => e.id);
}

/* ------------------------------------------------- desafios (§14.3) */

export type DesafioId = "barra_fixa" | "corrida" | "fase";

/**
 * Um card do carrossel de Desafios. Não há desafio inventado: são os dois
 * planos de `cardio.json` com objetivo e prazo e a **fase em curso** do
 * `programa.json`, cada um com a semana de hoje e o progresso real.
 */
export interface Desafio {
  id: DesafioId;
  titulo: string;
  subtitulo: string | null;
  semanaAtual: number;
  semanas: number;
  capa: string | null;
  /** Para onde o botão leva. */
  href: string;
  /** Rótulo de UI do botão. */
  acao: string;
}

export interface EntradaDosDesafios {
  fase: FaseId;
  /** `semanaDaFase(hoje, perfil.fase_desde)`. */
  semanaDaFase: number;
  /** `profiles.semana_fixa`. */
  semanaFixa: number;
  /** `profiles.semana_corrida`. */
  semanaCorrida: number;
  /** O treino que a alternância indica agora (§5.2), para o card da fase. */
  proximoTreino: TreinoId;
}

/** Prende a semana ao tamanho do plano (a semana 14 de um plano de 12 é 12). */
export function semanaPresa(semana: number, total: number): number {
  return Math.min(Math.max(Math.round(semana), 1), Math.max(1, total));
}

/** Quanto do plano já foi, de 0 a 1 (a semana em curso conta como começada). */
export function progressoDoDesafio(d: Pick<Desafio, "semanaAtual" | "semanas">): number {
  if (d.semanas <= 0) return 0;
  return Math.min(1, Math.max(0, (d.semanaAtual - 1) / d.semanas));
}

export function desafios(e: EntradaDosDesafios): Desafio[] {
  const fase = acharFase(e.fase);
  const semanasDaFixa = ultimaSemanaDeBarraFixa();
  const semanasDaCorrida = ultimaSemanaDeCorrida();
  return [
    {
      /*
       * Título de card (SPEC §14.3): rótulo de UI curto com o número de
       * semanas vindo do plano; o `objetivo` do JSON, que é uma frase inteira
       * em caixa baixa, fica como subtítulo (§13.8.6).
       */
      id: "barra_fixa",
      titulo: `Primeira barra fixa em ${semanasDaFixa} semanas`,
      subtitulo: cardio.barra_fixa.objetivo,
      semanaAtual: semanaPresa(e.semanaFixa, semanasDaFixa),
      semanas: semanasDaFixa,
      capa: capaDoExercicio(acharExercicio("barra-fixa-assistida")),
      href: "/barra-fixa",
      acao: "Fazer a sessão da semana",
    },
    {
      id: "corrida",
      titulo: `${metaDaCorrida()} em ${semanasDaCorrida} semanas`,
      subtitulo: cardio.corrida.objetivo,
      semanaAtual: semanaPresa(e.semanaCorrida, semanasDaCorrida),
      semanas: semanasDaCorrida,
      // não há foto de corrida em assets/; o card fica com o gradiente (§13.3)
      capa: null,
      href: `/cardio/corrida?semana=${semanaPresa(e.semanaCorrida, semanasDaCorrida)}`,
      acao: "Fazer a sessão da semana",
    },
    {
      id: "fase",
      titulo: fase.nome,
      subtitulo: fase.periodo,
      semanaAtual: semanaPresa(e.semanaDaFase, SEMANAS_PARA_FASE2),
      semanas: SEMANAS_PARA_FASE2,
      capa: capaDoTreino(e.proximoTreino),
      href: "/treinar",
      acao: "Fazer a sessão da semana",
    },
  ];
}

/* ------------------------------------------------------------ rotas */

/** "grupo:Core" → "/explorar/grupo/Core" (a tela da coleção, §14.4). */
export function hrefDaColecao(c: Pick<Colecao, "id">): string {
  const [tipo, ...resto] = c.id.split(":");
  return `/explorar/${tipo}/${encodeURIComponent(resto.join(":"))}`;
}

/** O caminho de volta: os dois segmentos da rota viram o id da coleção. */
export function colecaoDaRota(tipo: string, valor: string): Colecao | null {
  return acharColecao(`${tipo}:${decodeURIComponent(valor)}`);
}

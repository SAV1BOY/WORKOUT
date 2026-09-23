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
  nomeCurtoDaFase,
  programa,
  semanaDeCorrida,
  ultimaSemanaDeBarraFixa,
  ultimaSemanaDeCorda,
  ultimaSemanaDeCorrida,
} from "@/lib/dados";
import { dificuldadeDaColecao, type Raios } from "@/lib/dificuldade";
import { formatarNumero } from "@/lib/formato";
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
  /**
   * A meta: "8 exercícios · ~26 min". `null` só no plano sem perfil cujo
   * objetivo já diz o prazo (SPEC §22.12 item 4) — a linha fica sem meta.
   */
  detalhe: string | null;
  /** Roda no modo por tempo (SPEC §13.6)? */
  circuito: boolean;
  /** Coleção de plano: o botão dela sai de `ctaDoPlano()` (SPEC §22.12 item 7). */
  plano?: PlanoId;
  /** Coleção de treino do programa. */
  treino?: TreinoId;
  /**
   * Por que a coleção apareceu numa busca (SPEC §22.12 item 3): só quando o
   * casamento veio de um exercício lá dentro — "contém Prancha frontal".
   */
  motivoDaBusca?: string | null;
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

/**
 * A meta da coleção de um aparelho (SPEC §22.12 item 2): a contagem, uma vez
 * só e dita como serventia — "8 exercícios que dão para fazer com ele". O
 * espaço entre "com" e "ele" é inseguível (U+00A0): a 360 px a frase quebra
 * em duas linhas, e "ele" sozinho na segunda era uma linha de uma palavra.
 */
export function metaDoAparelho(quantos: number): string {
  return quantos === 1
    ? "1 exercício que dá para fazer com\u00a0ele"
    : `${quantos} exercícios que dão para fazer com\u00a0ele`;
}

/**
 * SPEC §22.12 item 2: a ficha técnica (`specs` — kg, cm, posições) é do
 * registro das compras em Mais → Equipamento, não da vitrine. A coleção do
 * aparelho não tem subtítulo e a meta diz para que ele serve, sem minutos.
 */
export function colecaoDoAparelho(id: string): Colecao | null {
  const item = equipamentos.itens.find((i) => i.id === id);
  if (!item) return null;
  const lista = exerciciosDoAparelho(id);
  if (lista.length === 0) return null;
  // o nome da vitrine, sem marca nem medida; o completo fica em Mais → Equipamento
  return montar(`aparelho:${id}`, "aparelho", item.nome_curto ?? item.nome, null, lista, {
    detalhe: metaDoAparelho(lista.length),
  });
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

/**
 * SPEC §22.12 item 2: o circuito também não usa a ficha técnica do item
 * como subtítulo — "2 placas de 1 × 1 m…" não diz nada sobre o circuito.
 */
export function colecaoDoCircuito(subgrupo: Subgrupo): Colecao {
  const lista = exerciciosDoCircuito(subgrupo);
  return montar(`circuito:${subgrupo}`, "circuito", NOME_DO_CIRCUITO[subgrupo], null, lista);
}

export function circuitos(): Colecao[] {
  return SUBGRUPOS.map(colecaoDoCircuito);
}

/* ------------------------------------------------- planos (§13.4/§14.3) */

export interface DadosDoPlano {
  id: PlanoId;
  /**
   * Título curto da vitrine (SPEC §22.12 item 4): o prazo já está no
   * objetivo (subtítulo) e na meta, então não se repete aqui.
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
       * SPEC §22.12 item 4: título curto. "Primeira barra fixa em 12
       * semanas" repetia o prazo que o objetivo (subtítulo, do JSON) e a meta
       * já dizem.
       */
      id: "barra_fixa",
      titulo: "Primeira barra fixa",
      subtitulo: cardio.barra_fixa.objetivo,
      semanas: ultimaSemanaDeBarraFixa(),
      href: "/barra-fixa",
      exercicioDaCapa: "barra-fixa-assistida",
    },
    {
      // a meta da última semana do plano, do JSON: "5 km sem parar"
      id: "corrida",
      titulo: metaDaCorrida(),
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
      /*
       * A duração é a do JSON: os estágios vão de "1–2" a "9–12", então o
       * plano tem 12 semanas — contar os 5 estágios dizia "5 semanas".
       */
      semanas: ultimaSemanaDeCorda(),
      href: "/cardio/corda",
      exercicioDaCapa: "corrida-no-lugar-com-a-corda",
    },
  ];
}

/** Onde o usuário está nos planos com posição (`profiles.semana_*`). */
export interface PosicaoNosPlanos {
  semanaFixa: number;
  semanaCorrida: number;
}

/**
 * O texto já diz o prazo do plano? ("… em 8–12 semanas" diz 12 semanas.) Sem
 * acento e sem caixa; o número tem de ser o total, não parte de outro número.
 */
export function textoDizOPrazo(texto: string | null | undefined, semanas: number): boolean {
  if (!texto) return false;
  return new RegExp(`(^|\\D)${semanas}\\s*semanas?\\b`).test(semAcento(texto));
}

/**
 * A meta de um plano na vitrine (SPEC §22.12 item 4). Com o perfil, barra fixa
 * e corrida dizem a posição — "semana 3 de 12", presa ao tamanho do plano; sem
 * perfil, e sempre na corda (que não tem posição no perfil), a duração — a não
 * ser que o objetivo do JSON (o subtítulo) já diga o prazo: aí não há meta
 * (`null`), para o prazo não aparecer duas vezes na mesma linha.
 */
export function metaDoPlano(
  dados: { id: PlanoId; semanas: number; subtitulo: string | null },
  posicao?: PosicaoNosPlanos | null,
): string | null {
  const semana =
    posicao == null
      ? null
      : dados.id === "barra_fixa"
        ? posicao.semanaFixa
        : dados.id === "corrida"
          ? posicao.semanaCorrida
          : null;
  if (semana === null || !Number.isFinite(semana)) {
    return textoDizOPrazo(dados.subtitulo, dados.semanas) ? null : `${dados.semanas} semanas`;
  }
  return `semana ${semanaPresa(semana, dados.semanas)} de ${dados.semanas}`;
}

/** O botão de um plano: o rótulo, que diz o destino, e a rota. */
export interface CtaDoPlano {
  acao: string;
  href: string;
}

/**
 * O CTA de um plano (SPEC §22.12 item 7) — a fonte ÚNICA: `desafios()` (o
 * carrossel da Treino e o destaque do Explorar) e a página da coleção de plano
 * usam esta função, e nenhuma tela escreve o rótulo. A corrida diz a semana
 * do perfil, presa ao plano, e leva direto a ela; sem perfil, leva à tela da
 * corrida, que abre a semana do perfil quando ele chegar.
 */
export function ctaDoPlano(
  id: PlanoId,
  posicao?: PosicaoNosPlanos | null,
): CtaDoPlano {
  const base = planos().find((p) => p.id === id)?.href ?? "/explorar";
  if (id === "barra_fixa") return { acao: "Fazer a sessão de barra fixa", href: base };
  if (id === "corda") return { acao: "Fazer a sessão de corda", href: base };
  if (posicao == null || !Number.isFinite(posicao.semanaCorrida)) {
    return { acao: "Fazer a corrida", href: base };
  }
  const semana = semanaPresa(posicao.semanaCorrida, ultimaSemanaDeCorrida());
  return { acao: `Fazer a corrida da semana ${semana}`, href: `${base}?semana=${semana}` };
}

export function colecaoDoPlano(
  dados: DadosDoPlano,
  posicao?: PosicaoNosPlanos | null,
): Colecao {
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
    detalhe: metaDoPlano(dados, posicao),
  });
}

export function colecoesDePlano(posicao?: PosicaoNosPlanos | null): Colecao[] {
  return planos().map((p) => colecaoDoPlano(p, posicao));
}

/* ----------------------------------- as semanas de um plano (§22.13) */

/** Onde a linha do plano está em relação à semana do perfil. */
export type EstadoDaSemana = "feita" | "atual" | "a-fazer";

/** Uma linha da lista de semanas (ou estágios) de um plano. */
export interface SemanaDoPlano {
  /** Primeira e última semana da linha — corda e barra fixa vão por faixas. */
  de: number;
  ate: number;
  /** "Semana 3" ou "Semanas 1–2". */
  rotulo: string;
  /** O que a semana pede, saído de `data/cardio.json`. */
  descricao: string;
  /** `null` sem perfil: não há posição para comparar. */
  estado: EstadoDaSemana | null;
}

/** "1–2" → [1, 2]; "9–12" → [9, 12]; "3" → [3, 3]. */
function faixaDeSemanas(texto: string): [number, number] {
  const partes = texto
    .split(/[–-]/)
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n));
  const de = partes[0] ?? 1;
  return [de, partes[partes.length - 1] ?? de];
}

function rotuloDaFaixa(de: number, ate: number): string {
  return de === ate ? `Semana ${de}` : `Semanas ${de}–${ate}`;
}

/**
 * As semanas (ou estágios) de um plano, na ordem de `data/cardio.json`, cada
 * uma com o estado em relação à semana do perfil (SPEC §22.13 item 9): antes
 * dela, **feita**; a que contém, **atual**; depois, **a fazer**. A semana é
 * presa ao tamanho do plano (a semana 14 de um plano de 12 é a 12). Nenhum
 * texto de conteúdo é escrito aqui: a corrida usa a `descricao` da semana, a
 * corda os números do estágio e a barra fixa as séries e a assistência.
 */
export function semanasDoPlano(
  plano: PlanoId,
  semanaAtual: number | null | undefined,
): SemanaDoPlano[] {
  const linhas: Omit<SemanaDoPlano, "estado">[] =
    plano === "corrida"
      ? cardio.corrida.semanas.map((s) => ({
          de: s.semana,
          ate: s.semana,
          rotulo: rotuloDaFaixa(s.semana, s.semana),
          descricao: s.descricao,
        }))
      : plano === "corda"
        ? cardio.corda.semanas.map((s) => {
            const [de, ate] = faixaDeSemanas(s.semanas);
            return {
              de,
              ate,
              rotulo: rotuloDaFaixa(de, ate),
              descricao: `${s.blocos} blocos de ${s.bloco_s} s · ${s.descanso_s} s de descanso · ≈ ${formatarNumero(s.saltos_aprox)} saltos`,
            };
          })
        : cardio.barra_fixa.semanas.map((s) => {
            const [de, ate] = faixaDeSemanas(s.semanas);
            return {
              de,
              ate,
              rotulo: rotuloDaFaixa(de, ate),
              descricao: `${s.por_sessao} por sessão · ${s.assistencia}`,
            };
          });
  const total = linhas.reduce((maior, l) => Math.max(maior, l.ate), 1);
  const atual =
    semanaAtual == null || !Number.isFinite(semanaAtual)
      ? null
      : semanaPresa(semanaAtual, total);
  return linhas.map((l) => ({
    ...l,
    estado:
      atual === null ? null : l.ate < atual ? "feita" : l.de <= atual ? "atual" : "a-fazer",
  }));
}

/** A semana do perfil em cada plano (`profiles.semana_*`). */
export function semanaDoPerfilNoPlano(
  plano: PlanoId,
  perfil: { semana_corrida: number; semana_corda: number; semana_fixa: number } | null,
): number | null {
  if (!perfil) return null;
  return plano === "corrida"
    ? perfil.semana_corrida
    : plano === "corda"
      ? perfil.semana_corda
      : perfil.semana_fixa;
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
export function todasAsColecoes(posicao?: PosicaoNosPlanos | null): Colecao[] {
  return [
    ...colecoesDeTreino(),
    ...colecoesPorGrupo(),
    ...circuitos(),
    ...colecoesPorAparelho(),
    ...colecoesDePlano(posicao),
  ];
}

export function acharColecao(id: string, lista = todasAsColecoes()): Colecao | null {
  return lista.find((c) => c.id === id) ?? null;
}

/**
 * As fotos que uma coleção pode usar de capa, na ordem: a que `montar()`
 * escolheu (a do primeiro exercício) e depois as dos outros exercícios.
 */
function capasPossiveis(c: Colecao): string[] {
  const fotos: string[] = [];
  if (c.capa) fotos.push(c.capa);
  for (const id of c.exercicios) {
    const e = exercicioPorId.get(id);
    const foto = e ? capaDoExercicio(e) : null;
    if (foto && !fotos.includes(foto)) fotos.push(foto);
  }
  return fotos;
}

/**
 * Nenhuma capa repetida dentro da MESMA seção da vitrine (SPEC §22.9 item 7).
 *
 * `montar()` dá a cada coleção a foto do primeiro exercício dela, e
 * `supino-reto-com-barra-1.jpg` acabava sendo a capa de quatro coleções da
 * mesma tela — a 56 px, quatro linhas idênticas. Aqui cada coleção pega a
 * primeira foto **ainda não usada na seção**; quando não sobra nenhuma, a
 * capa fica `null` e a linha cai no ícone do tipo, que distingue melhor do
 * que a quarta cópia da mesma foto.
 *
 * É uma decisão de VITRINE: a coleção guardada em `montar()` não muda, então
 * a tela da coleção continua abrindo com a foto do primeiro exercício.
 */
export function semCapasRepetidas(itens: readonly Colecao[]): Colecao[] {
  const usadas = new Set<string>();
  return itens.map((c) => {
    const livre = capasPossiveis(c).find((f) => !usadas.has(f)) ?? null;
    if (livre !== null) usadas.add(livre);
    return livre === c.capa ? c : { ...c, capa: livre };
  });
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

/** Onde a busca casou: 0 = título, 1 = subtítulo, 2 = exercício lá dentro. */
export type OndeCasou = 0 | 1 | 2;

/** "A", "A e B", "A, B e C". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * Os exercícios responsáveis pelo casamento (SPEC §22.12 item 3). `termos`
 * são os que NÃO estavam no título nem no subtítulo. Termo a termo, na ordem
 * dos termos: para cada termo ainda descoberto, o exercício que o contém E
 * cobre mais termos ainda descobertos (empate: o primeiro da coleção). Assim
 * dois termos no mesmo exercício citam um nome só, com qualquer número de
 * termos. Depois sai, um de cada vez, quem teve todos os seus termos cobertos
 * por outro citado — nenhum nome sobra, nenhum se repete —, e a frase fica na
 * ordem do primeiro termo que cada nome cobre.
 */
export function exerciciosResponsaveis(
  termos: readonly string[],
  nomes: readonly string[],
): string[] {
  if (termos.length === 0) return [];
  const normais = nomes.map((n) => semAcento(n));
  const cobre = (i: number, t: string) => normais[i]?.includes(t) ?? false;
  const descobertos = new Set(termos);
  const citados: number[] = [];
  for (const t of termos) {
    if (!descobertos.has(t)) continue;
    let melhor = -1;
    let quantos = 0;
    normais.forEach((_, i) => {
      if (!cobre(i, t) || citados.includes(i)) return;
      const n = [...descobertos].filter((d) => cobre(i, d)).length;
      if (n > quantos) {
        melhor = i;
        quantos = n;
      }
    });
    if (melhor < 0) continue;
    citados.push(melhor);
    for (const d of [...descobertos]) if (cobre(melhor, d)) descobertos.delete(d);
  }
  // quem ficou com todos os seus termos cobertos por outro citado não é
  // responsável por nada: sai
  // (um de cada vez, contra os que ainda ficaram — dois nunca saem juntos
  // deixando um termo sem nome)
  const finais = [...citados];
  for (const i of citados) {
    const outros = finais.filter((j) => j !== i);
    const redundante = termos
      .filter((t) => cobre(i, t))
      .every((t) => outros.some((j) => cobre(j, t)));
    if (redundante) finais.splice(finais.indexOf(i), 1);
  }
  /*
   * A frase segue a ordem dos termos digitados: cada nome vai para a posição
   * do primeiro termo que ele cobre; dois que começam no mesmo termo, pelo
   * primeiro termo que só ele cobre entre os citados (cada citado tem um, e
   * esses não se repetem — é o que a passada acima garante).
   */
  const primeiro = (i: number) => termos.findIndex((t) => cobre(i, t));
  const proprio = (i: number) =>
    termos.findIndex((t) => cobre(i, t) && finais.every((j) => j === i || !cobre(j, t)));
  const ordem = [...finais].sort((a, b) => primeiro(a) - primeiro(b) || proprio(a) - proprio(b));
  return ordem.map((i) => nomes[i] ?? "");
}

/**
 * Busca sem acento e sem caixa, por título, subtítulo ou nome de exercício
 * dentro da coleção (SPEC §22.12 item 3). Todo termo tem de casar em algum
 * lugar. A ordem é título > subtítulo > conteúdo (e, dentro de cada degrau, a
 * da vitrine); quem casou por exercício leva `motivoDaBusca` — "contém
 * <exercício>" —, e quem casou pelo título ou subtítulo não leva motivo.
 */
export function buscarColecoes(
  termo: string,
  lista: readonly Colecao[] = todasAsColecoes(),
): Colecao[] {
  const termos = semAcento(termo).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...lista];
  const achadas: { c: Colecao; onde: OndeCasou; i: number }[] = [];
  lista.forEach((c, i) => {
    const titulo = semAcento(c.titulo);
    const cabeca = `${titulo} ${semAcento(c.subtitulo ?? "")}`;
    const nomes = c.exercicios.map((id) => exercicioPorId.get(id)?.nome ?? "");
    const normais = nomes.map((n) => semAcento(n));
    if (termos.every((t) => titulo.includes(t))) {
      achadas.push({ c: { ...c, motivoDaBusca: null }, onde: 0, i });
      return;
    }
    if (termos.every((t) => cabeca.includes(t))) {
      achadas.push({ c: { ...c, motivoDaBusca: null }, onde: 1, i });
      return;
    }
    const fora = termos.filter((t) => !cabeca.includes(t));
    if (!fora.every((t) => normais.some((n) => n.includes(t)))) return;
    const responsaveis = exerciciosResponsaveis(fora, nomes);
    achadas.push({
      c: { ...c, motivoDaBusca: `contém ${juntarNomes(responsaveis)}` },
      onde: 2,
      i,
    });
  });
  return achadas.sort((a, b) => a.onde - b.onde || a.i - b.i).map(({ c }) => c);
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
  /**
   * Rótulo de UI do botão, que diz o destino (SPEC §22.7 item 6). É a ÚNICA
   * fonte do CTA (SPEC §22.12 item 7): a aba Treino e o destaque do Explorar
   * mostram este texto, e nenhuma tela reescreve o rótulo por id.
   */
  acao: string;
}

/* o nome curto da fase mora em lib/dados.ts (fonte única, SPEC §22.12) */
export { nomeCurtoDaFase };

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

/**
 * Quantas semanas do plano já foram **fechadas** — a semana atual está em
 * curso e ainda não conta (SPEC §22.2 item 8).
 */
export function semanasConcluidasDoDesafio(
  d: Pick<Desafio, "semanaAtual" | "semanas">,
): number {
  if (d.semanas <= 0) return 0;
  return Math.min(d.semanas, Math.max(0, Math.round(d.semanaAtual) - 1));
}

/**
 * Quanto do plano já foi, de 0 a 1: as semanas concluídas sobre o total. O
 * card mostra a mesma leitura por extenso ("Semana 3 de 12 · 2 concluídas"),
 * para o rótulo e a barra nunca discordarem.
 */
export function progressoDoDesafio(d: Pick<Desafio, "semanaAtual" | "semanas">): number {
  if (d.semanas <= 0) return 0;
  return semanasConcluidasDoDesafio(d) / d.semanas;
}

export function desafios(e: EntradaDosDesafios): Desafio[] {
  const fase = acharFase(e.fase);
  const semanasDaFixa = ultimaSemanaDeBarraFixa();
  const semanasDaCorrida = ultimaSemanaDeCorrida();
  const titulo = (id: PlanoId) => planos().find((p) => p.id === id)?.titulo ?? "";
  return [
    {
      /*
       * Título do card = o da linha do plano na vitrine (SPEC §22.12 item 4):
       * o prazo já aparece logo abaixo, em "Semana N de T". O `objetivo` do
       * JSON, uma frase inteira em caixa baixa, fica como subtítulo (§13.8.6).
       */
      id: "barra_fixa",
      titulo: titulo("barra_fixa"),
      subtitulo: cardio.barra_fixa.objetivo,
      semanaAtual: semanaPresa(e.semanaFixa, semanasDaFixa),
      semanas: semanasDaFixa,
      capa: capaDoExercicio(acharExercicio("barra-fixa-assistida")),
      ...ctaDoPlano("barra_fixa", e),
    },
    {
      id: "corrida",
      titulo: titulo("corrida"),
      subtitulo: cardio.corrida.objetivo,
      semanaAtual: semanaPresa(e.semanaCorrida, semanasDaCorrida),
      semanas: semanasDaCorrida,
      // não há foto de corrida em assets/; o card fica com o gradiente (§13.3)
      capa: null,
      ...ctaDoPlano("corrida", e),
    },
    {
      id: "fase",
      titulo: fase.nome,
      subtitulo: fase.periodo,
      semanaAtual: semanaPresa(e.semanaDaFase, SEMANAS_PARA_FASE2),
      semanas: SEMANAS_PARA_FASE2,
      capa: capaDoTreino(e.proximoTreino),
      href: "/treinar",
      acao: `Fazer o treino da ${nomeCurtoDaFase(fase.nome).toLowerCase()}`,
    },
  ];
}

/* ------------------------------------------------------------ rotas */

/**
 * O segmento de URL de um valor de coleção (SPEC §22.9 item 9).
 *
 * O id da coleção é escrito para o humano ("grupo:Bíceps"), e a rota é
 * escrita para o navegador: minúscula, sem acento, espaço vira hífen. Os dois
 * lados da viagem passam por aqui — é isso que faz `/explorar/grupo/Bíceps`,
 * `/explorar/grupo/biceps` e o link que a própria vitrine gera abrirem a
 * MESMA coleção, em vez de divergirem em acento e caixa.
 */
export function segmentoDaColecao(valor: string): string {
  return semAcento(valor).replace(/\s+/g, "-");
}

/** "grupo:Bíceps" → "/explorar/grupo/biceps" (a tela da coleção, §14.4). */
export function hrefDaColecao(c: Pick<Colecao, "id">): string {
  const [tipo = "", ...resto] = c.id.split(":");
  return `/explorar/${segmentoDaColecao(tipo)}/${encodeURIComponent(
    segmentoDaColecao(resto.join(":")),
  )}`;
}

/**
 * O caminho de volta: os dois segmentos da rota viram a coleção. A comparação
 * é feita no segmento normalizado dos DOIS lados, então um link antigo (com
 * acento, com maiúscula) continua abrindo o que sempre abriu.
 */
export function colecaoDaRota(tipo: string, valor: string): Colecao | null {
  let cru = valor;
  try {
    cru = decodeURIComponent(valor);
  } catch {
    // segmento mal codificado: vale o texto como veio
  }
  const alvoTipo = segmentoDaColecao(tipo);
  const alvoValor = segmentoDaColecao(cru);
  return (
    todasAsColecoes().find((c) => {
      const [t = "", ...resto] = c.id.split(":");
      return (
        segmentoDaColecao(t) === alvoTipo &&
        segmentoDaColecao(resto.join(":")) === alvoValor
      );
    }) ?? null
  );
}

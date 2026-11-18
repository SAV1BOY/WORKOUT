/**
 * Catálogo de exercícios (SPEC §3.6): busca sem acento e filtros.
 *
 * Funções puras sobre `data/exercicios.json` — nenhum texto de exercício mora
 * aqui, só a regra de filtrar. A tela usa e os testes cobrem.
 */
import { exercicios, programa } from "@/lib/dados";
import type {
  EquipamentoTag,
  Exercicio,
  Grupo,
  Implemento,
  TreinoId,
} from "@/lib/schemas";

/** Minúsculas e sem acento, para a busca do celular ("triceps" acha "Tríceps"). */
export function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Os ids que aparecem em algum treino do programa (as duas fases). */
export function idsDoPrograma(): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const treino of Object.values(programa.treinos)) {
    for (const item of treino.exercicios) ids.add(item.exercicio_id);
  }
  return ids;
}

/** Em que treinos o exercício aparece (a etiqueta "no meu programa"). */
export function treinosDoExercicio(id: string): TreinoId[] {
  const saida: TreinoId[] = [];
  for (const [treinoId, treino] of Object.entries(programa.treinos)) {
    if (treino.exercicios.some((e) => e.exercicio_id === id)) {
      saida.push(treinoId as TreinoId);
    }
  }
  return saida;
}

/*
 * SPEC §22.14 itens 8 e 9: os rótulos dos filtros têm a grafia do conteúdo
 * (`equipamento_texto` e `equipamentos.json`) — "Cross over", "Super Band",
 * "Peso corporal" —, e a faixa elástica tem um nome só nos dois seletores:
 * o implemento `band` É a Super Band do equipamento.
 */
export const NOME_IMPLEMENTO: Record<Implemento, string> = {
  barra_macica: "Barra maciça",
  halteres: "Halteres",
  barra_w: "Barra W",
  polia: "Polia",
  barra_fixa: "Barra fixa",
  peso_corporal: "Peso corporal",
  anilha: "Anilha",
  corda: "Corda",
  band: "Super Band",
};

export const NOME_EQUIPAMENTO: Record<EquipamentoTag, string> = {
  anilhas: "Anilhas",
  banco: "Banco",
  "barra-macica": "Barra maciça",
  "barra-w": "Barra W",
  halteres: "Halteres",
  cavalete: "Cavalete",
  "barra-fixa": "Barra fixa",
  "cross-over": "Cross over",
  puxadores: "Puxadores",
  tatame: "Tatame",
  corda: "Corda",
  "super-band": "Super Band",
};

/**
 * O rótulo do implemento nos filtros (SPEC §22.17 item 1). "Implemento" é o
 * aparelho principal do exercício (um por exercício); "Equipamento", tudo o
 * que ele usa. Seis nomes aparecem nos dois seletores; quando o nome do
 * implemento é igual ao de um equipamento **e** os dois filtros dão listas
 * diferentes ("Halteres": 23 × 28), o do implemento diz "(principal)" — no
 * seletor e no chip. Com a mesma lista ("Barra W", 3 × 3), fica o nome. A
 * decisão vem dos dados, calculada uma vez.
 */
export function rotuloDoImplemento(
  implemento: Implemento,
  lista: readonly Exercicio[] = exercicios,
): string {
  const nome = NOME_IMPLEMENTO[implemento];
  const cache = lista === exercicios ? rotulosDoCatalogo : null;
  const pronto = cache?.get(implemento);
  if (pronto !== undefined) return pronto;
  const doImplemento = lista.filter((e) => e.implemento === implemento).map((e) => e.id);
  const ambiguo = (Object.keys(NOME_EQUIPAMENTO) as EquipamentoTag[]).some((tag) => {
    if (NOME_EQUIPAMENTO[tag].toLocaleLowerCase("pt-BR") !== nome.toLocaleLowerCase("pt-BR")) {
      return false;
    }
    const doEquipamento = lista.filter((e) => e.equipamento.includes(tag)).map((e) => e.id);
    return (
      doEquipamento.length !== doImplemento.length ||
      doEquipamento.some((id) => !doImplemento.includes(id))
    );
  });
  const rotulo = ambiguo ? `${nome} (principal)` : nome;
  cache?.set(implemento, rotulo);
  return rotulo;
}

const rotulosDoCatalogo = new Map<Implemento, string>();

export interface FiltrosCatalogo {
  busca: string;
  grupo: Grupo | "todos";
  equipamento: EquipamentoTag | "todos";
  implemento: Implemento | "todos";
  /** Só os exercícios que estão em algum treino do programa. */
  soPrograma: boolean;
}

export const FILTROS_VAZIOS: FiltrosCatalogo = {
  busca: "",
  grupo: "todos",
  equipamento: "todos",
  implemento: "todos",
  soPrograma: false,
};

export function temFiltro(f: FiltrosCatalogo): boolean {
  return (
    f.busca.trim() !== "" ||
    f.grupo !== "todos" ||
    f.equipamento !== "todos" ||
    f.implemento !== "todos" ||
    f.soPrograma
  );
}

/** Todas as palavras da busca têm de aparecer no nome (sem acento). */
function casaComABusca(exercicio: Exercicio, busca: string): boolean {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const nome = semAcento(exercicio.nome);
  return termos.every((t) => nome.includes(t));
}

export function filtrarExercicios(
  lista: readonly Exercicio[],
  filtros: Partial<FiltrosCatalogo>,
  doPrograma: ReadonlySet<string> = idsDoPrograma(),
): Exercicio[] {
  const f = { ...FILTROS_VAZIOS, ...filtros };
  return lista.filter((e) => {
    if (!casaComABusca(e, f.busca)) return false;
    if (f.grupo !== "todos" && e.grupo !== f.grupo) return false;
    if (f.equipamento !== "todos" && !e.equipamento.includes(f.equipamento)) return false;
    if (f.implemento !== "todos" && e.implemento !== f.implemento) return false;
    if (f.soPrograma && !doPrograma.has(e.id)) return false;
    return true;
  });
}

export interface OpcoesDoCatalogo {
  grupos: Grupo[];
  equipamentos: EquipamentoTag[];
  implementos: Implemento[];
}

/** As opções dos filtros saem do próprio catálogo, na ordem em que aparecem. */
export function opcoesDoCatalogo(
  lista: readonly Exercicio[] = exercicios,
): OpcoesDoCatalogo {
  const grupos: Grupo[] = [];
  const equipamentos: EquipamentoTag[] = [];
  const implementos: Implemento[] = [];
  for (const e of lista) {
    if (!grupos.includes(e.grupo)) grupos.push(e.grupo);
    if (!implementos.includes(e.implemento)) implementos.push(e.implemento);
    for (const tag of e.equipamento) {
      if (!equipamentos.includes(tag)) equipamentos.push(tag);
    }
  }
  return { grupos, equipamentos, implementos };
}

/** Uma linha da lista: o mínimo que o card mostra. */
export interface ItemDoCatalogo {
  id: string;
  nome: string;
  grupo: Grupo;
  implemento: Implemento;
  equipamentoTexto: string;
  prescricao: string;
  noPrograma: boolean;
}

export function itemDoCatalogo(
  e: Exercicio,
  doPrograma: ReadonlySet<string> = idsDoPrograma(),
): ItemDoCatalogo {
  return {
    id: e.id,
    nome: e.nome,
    grupo: e.grupo,
    implemento: e.implemento,
    equipamentoTexto: e.equipamento_texto,
    prescricao: e.prescricao_padrao.texto,
    noPrograma: doPrograma.has(e.id),
  };
}

/* ------------------------------------ a folha de filtros (SPEC §22.12 item 1) */

/** Os filtros que moram na folha (a busca fica fora dela, sempre à vista). */
export type ChaveDaFolha = "grupo" | "implemento" | "equipamento" | "soPrograma";

/**
 * Quantos filtros da folha estão ligados — é o selo do botão "Filtros". Conta
 * filtros, não exercícios: com Peito + halteres o selo diz 2, seja qual for o
 * número de resultados.
 */
export function quantosFiltrosLigados(f: FiltrosCatalogo): number {
  return (
    (f.grupo !== "todos" ? 1 : 0) +
    (f.implemento !== "todos" ? 1 : 0) +
    (f.equipamento !== "todos" ? 1 : 0) +
    (f.soPrograma ? 1 : 0)
  );
}

export interface ChipDoFiltro {
  chave: ChaveDaFolha;
  /** O que o chip mostra: "Peito", "Halteres", "No meu programa". */
  rotulo: string;
}

/**
 * Os chips removíveis acima da lista, um por filtro ligado, na ordem da folha.
 * Os nomes são os mesmos das opções dos selects.
 */
export function chipsDosFiltros(f: FiltrosCatalogo): ChipDoFiltro[] {
  const chips: ChipDoFiltro[] = [];
  if (f.grupo !== "todos") chips.push({ chave: "grupo", rotulo: f.grupo });
  if (f.implemento !== "todos") {
    chips.push({ chave: "implemento", rotulo: rotuloDoImplemento(f.implemento) });
  }
  if (f.equipamento !== "todos") {
    chips.push({ chave: "equipamento", rotulo: NOME_EQUIPAMENTO[f.equipamento] });
  }
  if (f.soPrograma) chips.push({ chave: "soPrograma", rotulo: "No meu programa" });
  return chips;
}

/** Os filtros sem aquele chip — a busca e os outros ficam como estavam. */
export function semOFiltro(f: FiltrosCatalogo, chave: ChaveDaFolha): FiltrosCatalogo {
  if (chave === "soPrograma") return { ...f, soPrograma: false };
  return { ...f, [chave]: "todos" };
}

/** Solta os filtros da folha e mantém a busca (o "Limpar" de dentro da folha). */
export function semFiltrosDaFolha(f: FiltrosCatalogo): FiltrosCatalogo {
  return { ...FILTROS_VAZIOS, busca: f.busca };
}

/**
 * O CTA que fecha a folha diz quantos exercícios a lista vai mostrar: "Ver 12
 * exercícios", "Ver 1 exercício" e, sem nenhum, "Nenhum exercício".
 */
export function rotuloDoVerResultados(quantos: number): string {
  if (quantos <= 0) return "Nenhum exercício";
  return quantos === 1 ? "Ver 1 exercício" : `Ver ${quantos} exercícios`;
}

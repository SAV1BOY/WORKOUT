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

export const NOME_IMPLEMENTO: Record<Implemento, string> = {
  barra_macica: "Barra maciça",
  halteres: "Halteres",
  barra_w: "Barra W",
  polia: "Polia",
  barra_fixa: "Barra fixa",
  peso_corporal: "Peso do corpo",
  anilha: "Anilha",
  corda: "Corda",
  band: "Elástico",
};

export const NOME_EQUIPAMENTO: Record<EquipamentoTag, string> = {
  anilhas: "Anilhas",
  banco: "Banco",
  "barra-macica": "Barra maciça",
  "barra-w": "Barra W",
  halteres: "Halteres",
  cavalete: "Cavalete",
  "barra-fixa": "Barra fixa",
  "cross-over": "Cross-over",
  puxadores: "Puxadores",
  tatame: "Tatame",
  corda: "Corda",
  "super-band": "Super band",
};

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

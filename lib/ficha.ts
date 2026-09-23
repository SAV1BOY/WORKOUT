/**
 * Regras puras da ficha do exercício (SPEC §22.14): que abas ela oferece, o
 * nível dos títulos conforme o contexto, para onde levam as tags de
 * equipamento e os treinos em que o exercício aparece, e quando o histórico
 * inteiro vira um cartão só. Nada de React nem de Supabase aqui.
 */
import { NOME_EQUIPAMENTO } from "@/lib/catalogo";
import { colecaoDoAparelho, colecaoDoTreino, hrefDaColecao } from "@/lib/colecoes";
import { acharTreino } from "@/lib/dados";
import type { EquipamentoTag, TreinoId } from "@/lib/schemas";

/** As abas da mídia da ficha (SPEC §14.2 e §22.14 item 4). */
export type AbaDaFicha = "video" | "musculos" | "tutorial";

/**
 * SPEC §22.14 item 4: a aba do tutorial só existe quando o exercício tem o
 * vídeo em `data/tutoriais.json` — nunca uma aba que abre vazia.
 */
export function abasDaFicha(temTutorial: boolean): AbaDaFicha[] {
  return temTutorial ? ["video", "musculos", "tutorial"] : ["video", "musculos"];
}

/** O rótulo da aba diz para onde ela leva (SPEC §22.14 item 4). */
export const ROTULO_DA_ABA: Readonly<Record<AbaDaFicha, string>> = {
  video: "Vídeo",
  musculos: "Músculos",
  tutorial: "Tutorial no YouTube",
};

export type NivelDeTitulo = 2 | 3;

/**
 * SPEC §22.14 item 3(e): o nível dos títulos das seções depende de onde a
 * ficha está. Na página o nome do exercício é o H1, então as seções são H2;
 * na folha o título da folha é o H2 (Radix), então as seções são H3.
 */
export function nivelDosTitulos(comoPagina: boolean): NivelDeTitulo {
  return comoPagina ? 2 : 3;
}

export interface TagDeEquipamento {
  tag: EquipamentoTag;
  rotulo: string;
  /** A coleção do aparelho no Explorar; `null` quando ela não existe. */
  href: string | null;
}

/**
 * SPEC §22.14 item 3(c): a tag de equipamento leva à coleção do aparelho
 * quando o Explorar tem uma (`colecaoDoAparelho`); anilhas, halteres e barra W
 * não são itens de `equipamentos.json` com exercícios e ficam como texto.
 */
export function hrefDoEquipamento(tag: EquipamentoTag): string | null {
  const colecao = colecaoDoAparelho(tag);
  return colecao ? hrefDaColecao(colecao) : null;
}

export function tagsDoEquipamento(
  tags: readonly EquipamentoTag[],
): TagDeEquipamento[] {
  return tags.map((tag) => ({
    tag,
    rotulo: NOME_EQUIPAMENTO[tag],
    href: hrefDoEquipamento(tag),
  }));
}

export interface TreinoDaFicha {
  id: TreinoId;
  nome: string;
  href: string;
}

/** SPEC §22.14 item 3(d): "Aparece em:" — cada treino abre a coleção dele. */
export function linksDosTreinos(ids: readonly TreinoId[]): TreinoDaFicha[] {
  return ids.map((id) => ({
    id,
    nome: acharTreino(id).nome,
    href: hrefDaColecao(colecaoDoTreino(id)),
  }));
}

/**
 * SPEC §22.14 item 2: sem recorde, sem ponto no gráfico, sem sessão e sem
 * evento do motor, os quatro cartões do histórico viram um só.
 */
export function historicoVazio(h: {
  temRecorde: boolean;
  pontos: number;
  sessoes: number;
  eventos: number;
}): boolean {
  return !h.temRecorde && h.pontos === 0 && h.sessoes === 0 && h.eventos === 0;
}

/** O cartão único (SPEC §22.14 item 2): o título e a frase do vazio. */
export const SEM_HISTORICO = {
  titulo: "Ainda sem histórico deste exercício",
  frase: "Ele começa na primeira série registrada.",
} as const;

/**
 * SPEC §22.14 item 1: o "Voltar" da ficha em página volta à página anterior
 * só quando ela é do app. A Navigation API diz isso direto (`canGoBack` só
 * conta as entradas desta origem: uma aba aberta direto na ficha, ou vinda de
 * outro site, não tem para onde voltar); sem ela, vale o tamanho do histórico.
 * Quando não dá para voltar, o link leva ao catálogo.
 */
export function podeVoltarNoApp(
  navegacao: { canGoBack?: unknown } | undefined,
  tamanhoDoHistorico: number,
): boolean {
  if (navegacao && typeof navegacao.canGoBack === "boolean") return navegacao.canGoBack;
  return tamanhoDoHistorico > 1;
}

/**
 * SPEC §22.14 item 2: na página, "Onde você está" de um exercício que o motor
 * ainda não avaliou (`primeira_vez`) é a carga inicial e a prescrição padrão —
 * que a página já mostra nas próprias seções, na mesma rolagem. Ali ele sai;
 * fica se a primeira sessão traz algo que as seções não dizem (assistência do
 * elástico ou semana leve). Na folha, que não tem essas seções, fica sempre.
 */
export function ondeVoceEstaRepete(c: {
  comoPagina: boolean;
  primeiraVez: boolean;
  assistencia: boolean;
  semanaLeve: boolean;
}): boolean {
  return c.comoPagina && c.primeiraVez && !c.assistencia && !c.semanaLeve;
}

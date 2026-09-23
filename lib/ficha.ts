/**
 * Regras puras da ficha do exercício (SPEC §22.14): que abas ela oferece, o
 * nível dos títulos conforme o contexto, para onde levam as tags de
 * equipamento e os treinos em que o exercício aparece, e quando o histórico
 * inteiro vira um cartão só. Nada de React nem de Supabase aqui.
 */
import { NOME_EQUIPAMENTO } from "@/lib/catalogo";
import { colecaoDoAparelho, colecaoDoTreino, hrefDaColecao } from "@/lib/colecoes";
import { acharTreino } from "@/lib/dados";
import { formatarKg, rotuloDaCarga } from "@/lib/formato";
import type { EquipamentoTag, Implemento, TreinoId } from "@/lib/schemas";

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
 * SPEC §22.14 item 3: a linha grande da seção "Carga inicial" da página — o
 * número de `carga_inicial.kg`, ou "peso do corpo" quando ele é 0.
 */
export function linhaDaCargaInicial(e: {
  carga_inicial: { kg: number };
  implemento: Implemento;
}): string {
  return e.carga_inicial.kg > 0
    ? `${formatarKg(e.carga_inicial.kg)} ${rotuloDaCarga(e.implemento)}`
    : "peso do corpo";
}

/**
 * SPEC §22.14 item 3 (correção da auditoria): com carga 0 a linha de cima já
 * diz "peso do corpo"; a nota não repete "peso corporal" logo abaixo — fica
 * só o complemento ("Anilha só quando passar de 15 limpas"), ou nada.
 */
export function notaDaCargaInicial(ci: { kg: number; nota: string }): string | null {
  if (ci.kg > 0) return ci.nota;
  const resto = ci.nota.replace(/^peso corporal\s*(?:[;,:·—–-]\s*)?/iu, "").trim();
  if (resto === "") return null;
  return resto.charAt(0).toLocaleUpperCase("pt-BR") + resto.slice(1);
}

/** O que o cartão "Onde você está" mostra (SPEC §22.14 item 2). */
export interface OndeVoceEstaNaFicha {
  /** O cartão aparece. */
  mostrar: boolean;
  /** A carga grande (a do motor). */
  carga: boolean;
  /** "Próxima sessão: séries × alvo", com o elástico e a semana leve. */
  proxima: boolean;
  /** "Ainda sem registro: <nota da carga inicial>." */
  nota: boolean;
  /** "Montada com o peso das suas barras" — a carga do motor não é a do JSON. */
  ajustePelasBarras: boolean;
}

/** Duas cargas iguais na tela (ao 0,01 kg; a vírgula mostra no máximo duas casas). */
function mesmaCarga(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/**
 * SPEC §22.14 item 2 (correção da auditoria): na página, um exercício que o
 * motor ainda não avaliou (`primeira_vez`) já tem a "Carga inicial" e a
 * "Prescrição padrão" nas seções, na mesma rolagem. "Onde você está" só diz
 * o que elas não dizem:
 * - a carga que o motor vai usar quando ela não é a do JSON — com as barras
 *   pesadas na balança (SPEC §3.9) o motor sobe ou desce ao que dá para
 *   montar, e a página não pode esconder a carga real;
 * - a assistência do elástico e a semana leve, na linha "Próxima sessão".
 * Sem elástico nem semana leve, essa linha seria a prescrição padrão da seção
 * e não aparece; a nota da carga inicial também não (ela está na seção). Sem
 * nada a dizer, o cartão sai. Na folha, que não tem essas seções, e depois da
 * primeira avaliação, o cartão é o de sempre.
 */
export function ondeVoceEsta(c: {
  comoPagina: boolean;
  primeiraVez: boolean;
  assistencia: boolean;
  semanaLeve: boolean;
  /** `cargaDeHoje(...).carga_kg`, com as opções de montagem do perfil. */
  cargaDoMotor: number | null;
  /** `carga_inicial.kg` do JSON — o que a seção "Carga inicial" mostra. */
  cargaInicial: number;
}): OndeVoceEstaNaFicha {
  if (!c.comoPagina || !c.primeiraVez) {
    return {
      mostrar: true,
      carga: true,
      proxima: true,
      nota: c.primeiraVez,
      ajustePelasBarras: false,
    };
  }
  const outraCarga = !mesmaCarga(c.cargaDoMotor ?? 0, c.cargaInicial);
  const proxima = c.assistencia || c.semanaLeve;
  return {
    mostrar: outraCarga || proxima,
    carga: outraCarga,
    proxima,
    nota: false,
    ajustePelasBarras: outraCarga && !c.semanaLeve,
  };
}

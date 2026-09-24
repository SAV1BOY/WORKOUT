/**
 * A regra da folha (SPEC §22.14 item 6, a11y-05) — a parte que se decide sem
 * DOM. Quem aplica é `components/ui/camada-modal.ts`, nos três primitivos do
 * Radix (`sheet.tsx`, `dialog.tsx`, `alert-dialog.tsx`) e na camada própria da
 * foto ampliada; aqui ficam as decisões, genéricas no tipo do nó para o Vitest
 * testar sem navegador.
 */

/** O que se sabe de um irmão da camada para decidir se ele fica inerte. */
export type IrmaoDaCamada = {
  /** `tagName` em maiúsculas, como o DOM devolve. */
  tag: string;
  /** Tem `aria-live` (os avisos: sonner, o anunciador de rota). */
  avisos: boolean;
  /**
   * Um véu do Radix (`data-slot` terminado em `-overlay`): o da própria
   * camada, cujo toque fora fecha, ou o de uma camada de baixo que seja irmã
   * desta — não é focável e fica coberto pelo véu de cima (SPEC §22.17 item 5).
   */
  veu: boolean;
};

const SEM_CONTEUDO = /^(SCRIPT|STYLE|LINK|TEMPLATE|META|NOSCRIPT)$/;

/**
 * O irmão entra no `inert`? Não entram os nós sem conteúdo, os avisos (quem
 * está na folha ainda ouve "Série salva") nem o véu (inerte, ele não receberia
 * o toque fora que fecha a camada).
 */
export function ficaInerte(irmao: IrmaoDaCamada): boolean {
  if (SEM_CONTEUDO.test(irmao.tag)) return false;
  if (irmao.tag === "NEXT-ROUTE-ANNOUNCER") return false;
  if (irmao.avisos || irmao.veu) return false;
  return true;
}

/**
 * Camadas empilhadas marcam o mesmo nó (o `<main>` fica inerte pela folha e
 * pelo alerta aberto sobre ela). Cada camada conta a sua marca; o `inert` só
 * sai quando a última que marcou fecha — em qualquer ordem. Devolve os nós
 * que acabaram de ganhar a primeira marca (quem põe o atributo).
 */
export function marcar<T>(contagem: Map<T, number>, alvos: readonly T[]): T[] {
  const novos: T[] = [];
  for (const alvo of alvos) {
    const antes = contagem.get(alvo) ?? 0;
    contagem.set(alvo, antes + 1);
    if (antes === 0) novos.push(alvo);
  }
  return novos;
}

/** O contrário de `marcar`: devolve os nós cuja última marca acabou de sair. */
export function desmarcar<T>(contagem: Map<T, number>, alvos: readonly T[]): T[] {
  const livres: T[] = [];
  for (const alvo of alvos) {
    const antes = contagem.get(alvo) ?? 0;
    if (antes <= 1) {
      contagem.delete(alvo);
      if (antes === 1) livres.push(alvo);
    } else {
      contagem.set(alvo, antes - 1);
    }
  }
  return livres;
}

/**
 * Quem recebe o foco quando a camada fecha. A camada guarda, ao abrir, quem
 * tinha o foco e — se esse alguém estava dentro de outra camada — os
 * candidatos dela também: o resumo do fim aberto pelo "Descartar este treino"
 * do alerta guarda o botão do alerta e, atrás dele, o "Descartar" do rodapé
 * que abriu o alerta. Ao fechar, vale o primeiro que ainda pode receber foco
 * (está no documento e não está inerte); nenhum → `null`, e quem fecha deixa
 * o Radix decidir.
 */
export function focoAoFechar<T>(
  candidatos: readonly T[],
  podeReceber: (no: T) => boolean,
): T | null {
  for (const candidato of candidatos) if (podeReceber(candidato)) return candidato;
  return null;
}

/**
 * Os candidatos que uma camada guarda ao abrir: quem tinha o foco (se não for
 * o `<body>`) e, se ele estava dentro de uma camada aberta, os candidatos
 * dela, na ordem.
 */
export function candidatosAoAbrir<T>(
  ativo: T | null,
  camadas: readonly { contem: (no: T) => boolean; candidatos: readonly T[] }[],
): T[] {
  if (ativo === null) return [];
  // a de cima primeiro: a camada mais recente que contém o foco
  for (let i = camadas.length - 1; i >= 0; i -= 1) {
    const camada = camadas[i]!;
    if (camada.contem(ativo)) return [ativo, ...camada.candidatos];
  }
  return [ativo];
}

/**
 * Tab preso na camada: para onde vai o foco. `atual` é a posição do foco na
 * lista de focáveis da camada (−1 se está fora dela). Devolve o índice que a
 * camada deve focar, ou `null` quando o navegador pode seguir sozinho (o
 * próximo focável ainda é da camada).
 */
export function proximoDoTab(total: number, atual: number, voltando: boolean): number | null {
  if (total <= 0) return null;
  if (atual < 0) return voltando ? total - 1 : 0;
  if (voltando && atual === 0) return total - 1;
  if (!voltando && atual === total - 1) return 0;
  return null;
}

/* ------------------------------------------------------------------------ */
/*  O voltar do celular (SPEC §22.17 item 6, a11y-voltar-fecha-camada)       */
/* ------------------------------------------------------------------------ */

/** A chave do estado do histórico que marca a entrada de uma camada. */
export const CHAVE_DA_ENTRADA = "camadaModal";

/**
 * O número da entrada de camada no estado do histórico (`history.state`), ou
 * 0 quando a entrada não é de camada (a da página, a da Visão geral).
 */
export function entradaDoEstado(estado: unknown): number {
  if (typeof estado !== "object" || estado === null) return 0;
  const valor = (estado as Record<string, unknown>)[CHAVE_DA_ENTRADA];
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0 ? valor : 0;
}

/** A chave da sessão da aba (`sessionStorage`) com o último número de entrada. */
export const CHAVE_DA_SESSAO = "camadaModal:ultimaEntrada";

/**
 * O número da próxima entrada de camada: acima do último desta página
 * (`ultima`), do guardado na sessão da aba (`guardada`, o texto do
 * `sessionStorage`, ou `null`) e do da entrada atual do histórico. A sessão
 * vive junto com o histórico da aba: depois de recarregar, os números
 * continuam crescendo, e as entradas novas ficam acima das mortas de antes
 * — a régua não confunde umas com as outras.
 */
export function proximaEntrada(
  ultima: number,
  guardada: string | null,
  estadoDoTopo: unknown,
): number {
  const g = Number(guardada);
  const daSessao = guardada !== null && Number.isInteger(g) && g > 0 ? g : 0;
  return Math.max(ultima, daSessao, entradaDoEstado(estadoDoTopo)) + 1;
}

/**
 * A camada que abre põe uma entrada no histórico? Sim, menos quando a
 * entrada do topo é a da Visão geral do treino (§22.14 item 6): ela já
 * devolve a própria entrada e entrega um Esc à camada de cima no `popstate`,
 * e uma segunda entrada faria o voltar gastar dois toques.
 */
export function empilhaEntrada(estadoDoTopo: unknown): boolean {
  if (typeof estadoDoTopo === "object" && estadoDoTopo !== null) {
    if ((estadoDoTopo as Record<string, unknown>).visaoGeralDoTreino === true) return false;
  }
  return true;
}

/**
 * O que o `popstate` faz. `abertas` são as entradas das camadas abertas que
 * empilharam uma (de baixo para cima); `atual`, a entrada em que o histórico
 * chegou (0 quando não é de camada).
 *
 * - `fechar`: as entradas das camadas que o voltar tirou — as acima da atual —,
 *   de cima para baixo. Cada uma recebe o Esc da vez.
 * - `morta`: a entrada atual é de uma camada que já fechou (um link dentro
 *   dela levou a outra rota no mesmo documento, ou ela saiu pelo Esc ou pelo
 *   voltar e o avançar chegou nela): o app anda mais um passo — para onde,
 *   quem diz é `passoNoHistorico` —, e ninguém gasta um toque numa entrada
 *   vazia. Quem decide é o ouvinte do `popstate`, que só existe depois de a
 *   primeira camada abrir no documento: recarregar com a camada aberta, ou
 *   chegar a uma entrada morta de outro documento pelo avançar, ainda gasta
 *   um toque (SPEC §22.17 item 6).
 */
export function aoAndarNoHistorico(
  abertas: readonly number[],
  atual: number,
): { fechar: number[]; morta: boolean } {
  const fechar = abertas.filter((e) => e > atual).sort((a, b) => b - a);
  const ficam = abertas.filter((e) => e <= atual);
  const morta = atual > 0 && !ficam.includes(atual);
  return { fechar, morta };
}

/**
 * Ao fechar por outro caminho (Esc, X, toque fora, "Ver resultados"), a
 * camada desfaz a própria entrada (`history.back()`) só se ela ainda é a do
 * topo: se o voltar já a tirou, ou se outra rota empilhou por cima, um
 * `back()` cego tiraria outra coisa.
 */
export function desfazAoFechar(estadoDoTopo: unknown, entrada: number | null): boolean {
  return entrada !== null && entrada > 0 && entradaDoEstado(estadoDoTopo) === entrada;
}

/* ------------------------------------------------------------------------ */
/*  A direção do passo, sem a Navigation API (SPEC §22.17 item 6)            */
/* ------------------------------------------------------------------------ */

/**
 * A régua: onde o histórico está, contado nos números das entradas de
 * camada (crescentes na ordem do histórico, porque um `pushState` apaga o
 * que estava à frente). Numa entrada de camada, o número dela; numa entrada
 * de página, que não tem número, meio passo acima ou abaixo da entrada de
 * camada vizinha que o app conhece. `null`: o documento ainda não viu
 * nenhuma (acabou de carregar, ou recarregou).
 *
 * É só o que o app grava no próprio histórico: vale no Safari do iPhone e em
 * qualquer navegador sem `window.navigation`.
 */
export type Regua = number | null;

/** Para onde o passo foi: +1 avançou, −1 voltou, 0 não se sabe. */
export type Direcao = -1 | 0 | 1;

/**
 * A direção do passo que chegou à entrada `agora` vindo da régua `antes`:
 * número maior, avançou; menor, voltou. Não se sabe (0) quando a régua não
 * sabe (`null`), quando a entrada é de página (`agora` 0) ou quando é a
 * mesma — e o que não se sabe **não** vira voltar.
 */
export function direcaoDoPasso(antes: Regua, agora: number): Direcao {
  if (antes === null || agora <= 0 || agora === antes) return 0;
  return agora > antes ? 1 : -1;
}

/**
 * O `popstate`, na régua. `atual` é a entrada em que o histórico chegou (0
 * quando é de página); `morta` e `fechar` vêm de `aoAndarNoHistorico`;
 * `semSaida` diz se `atual` é a entrada de uma camada desfeita pelo Esc
 * (ou X, toque fora, "Ver resultados") ou fechada pelo voltar — acima dela
 * só há entradas de camadas fechadas.
 *
 * - `passo`: numa entrada morta, o passo a mais que o app dá — na direção
 *   do passo que chegou, ou nenhum (0) se ela não se sabe; numa sem saída,
 *   sempre um voltar (o avançar que chega nela volta para onde estava).
 * - `regua`: onde a régua fica. Numa entrada de camada, o número dela (meio
 *   passo além, se o app vai andar mais um); numa de página, meio passo
 *   abaixo da mais baixa das camadas que o voltar fechou, ou onde estava.
 */
export function passoNoHistorico(
  antes: Regua,
  atual: number,
  { morta, fechar, semSaida }: { morta: boolean; fechar: readonly number[]; semSaida: boolean },
): { passo: Direcao; regua: Regua } {
  if (atual <= 0) {
    const regua = fechar.length > 0 ? Math.min(...fechar) - 0.5 : antes;
    return { passo: 0, regua };
  }
  if (!morta) return { passo: 0, regua: atual };
  const passo: Direcao = semSaida ? -1 : direcaoDoPasso(antes, atual);
  return { passo, regua: atual + passo / 2 };
}

/**
 * A régua quando a camada da entrada `entrada` sai por outro caminho que
 * não o voltar. `desfez`: ela desfez a própria entrada (`history.back()`), e
 * o histórico vai para meio passo abaixo dela. Senão, uma rota (ou outra
 * camada) foi por cima: a régua fica pelo menos meio passo acima da entrada,
 * agora morta.
 */
export function reguaAoSair(antes: Regua, entrada: number, desfez: boolean): number {
  if (desfez) return entrada - 0.5;
  return Math.max(antes ?? 0, entrada + 0.5);
}

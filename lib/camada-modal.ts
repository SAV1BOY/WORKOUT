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
  /** O véu da própria camada (`data-slot="…-overlay"` ou `data-veu`): o toque fora fecha. */
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

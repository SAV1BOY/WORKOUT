"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  aoAndarNoHistorico,
  candidatosAoAbrir,
  CHAVE_DA_ENTRADA,
  desfazAoFechar,
  desmarcar,
  empilhaEntrada,
  entradaDoEstado,
  ficaInerte,
  focoAoFechar,
  marcar,
  proximoDoTab,
} from "@/lib/camada-modal";

/**
 * A regra da folha (SPEC §22.14 item 6, a11y-05) num lugar só. Vale para as
 * três camadas do Radix (`sheet.tsx`, `dialog.tsx`, `alert-dialog.tsx`, pelo
 * `useCamadaModal`) e para a camada própria da foto ampliada e do "Apagar
 * esta foto?" (`useCamadaPropria` — a foto não usa o Radix para não levar
 * ~200 kB à ficha, ver `foto-ampliada.tsx`). As decisões estão em
 * `lib/camada-modal.ts`, com Vitest; aqui só o DOM.
 *
 * - Ao abrir, a camada guarda quem tinha o foco; ao fechar, devolve a ele.
 * - Enquanto aberta, os irmãos dela (e dos ancestrais, até o `<body>`) ficam
 *   `inert`: fora do Tab, do toque e da árvore do leitor de tela. Os avisos
 *   (`aria-live`) e os véus das camadas do Radix (`data-slot="…-overlay"`)
 *   ficam de fora — o da própria camada e o de uma camada de baixo que seja
 *   irmã dela, coberto pelo véu de cima (SPEC §22.17 item 5).
 * - Camadas empilhadas contam as marcas: fechar uma não libera o que outra
 *   ainda precisa inerte, em qualquer ordem.
 * - O voltar do celular fecha só a camada de cima (SPEC §22.17 item 6): ao
 *   abrir, a camada põe uma entrada no histórico (mesma rota); o `popstate`
 *   que a tira entrega um Esc à camada de cima; fechada de outro jeito, ela
 *   desfaz a própria entrada se ainda é a do topo.
 *
 * Sem dependência do Radix: a foto importa daqui sem levar o diálogo junto.
 */

type Camada = {
  no: HTMLElement;
  candidatos: HTMLElement[];
  /** O número da entrada que ela pôs no histórico (`null`: não pôs, ou já saiu). */
  entrada: number | null;
};

/** As camadas abertas, de baixo para cima. */
const abertas: Camada[] = [];
/** Quantas camadas marcaram cada nó como `inert`. */
const marcas = new Map<Element, number>();

/* ---------------------------------------- o voltar do celular (§22.17 item 6) */

/** A última entrada posta no histórico (as de cima têm número maior). */
let ultimaEntrada = 0;
/** A direção do último passo no histórico: −1 voltou, +1 avançou. */
let direcao = -1;
/** O `scrollRestoration` de antes da primeira camada (`null`: não mexemos). */
let rolagemDeAntes: ScrollRestoration | null = null;
let ouvindo = false;

type Navegacao = EventTarget & { currentEntry: { index: number } | null };
type EventoDeNavegar = Event & {
  navigationType: string;
  destination: { index: number };
};

function navegacao(): Navegacao | null {
  return (window as unknown as { navigation?: Navegacao }).navigation ?? null;
}

/** O voltar vira o Esc da camada de cima: cada uma fecha do jeito dela. */
function entregarEsc(): void {
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
}

function empilharEntrada(camada: Camada): void {
  if (rolagemDeAntes === null) rolagemDeAntes = window.history.scrollRestoration;
  /*
   * Fechar a camada não mexe na rolagem da página de baixo: o navegador não a
   * restaura na volta (o "Ver resultados" leva ao primeiro resultado e fica lá).
   */
  window.history.scrollRestoration = "manual";
  ultimaEntrada = Math.max(ultimaEntrada, entradaDoEstado(window.history.state)) + 1;
  camada.entrada = ultimaEntrada;
  window.history.pushState({ [CHAVE_DA_ENTRADA]: ultimaEntrada }, "");
}

/** Sem camada com entrada, a rolagem volta a ser a do navegador. */
function devolverRolagem(): void {
  if (rolagemDeAntes === null || abertas.some((c) => c.entrada !== null)) return;
  window.history.scrollRestoration = rolagemDeAntes;
}

function devolverRolagemDepois(): void {
  // depois do quadro da volta: a restauração (ou não) da rolagem já passou
  requestAnimationFrame(() => setTimeout(devolverRolagem, 0));
}

function aoAndar(evento: PopStateEvent): void {
  const comEntrada = abertas.filter((c) => c.entrada !== null);
  const { fechar, morta } = aoAndarNoHistorico(
    comEntrada.map((c) => c.entrada!),
    entradaDoEstado(evento.state),
  );
  if (fechar.length > 0) {
    const tiradas = comEntrada.filter((c) => fechar.includes(c.entrada!));
    for (const c of tiradas) c.entrada = null;
    const deCima = tiradas[tiradas.length - 1]!;
    entregarEsc();
    /*
     * A camada que não aceitou o Esc (o resumo do fim gravando) continua
     * aberta: ela volta a ter entrada, e o próximo voltar é dela de novo.
     */
    requestAnimationFrame(() =>
      setTimeout(() => {
        const aberta =
          abertas.includes(deCima) &&
          deCima.no.isConnected &&
          deCima.no.getAttribute("data-state") !== "closed";
        if (aberta && deCima.entrada === null) empilharEntrada(deCima);
      }, 0),
    );
  }
  if (morta) {
    if (direcao > 0) window.history.forward();
    else window.history.back();
  }
  direcao = -1;
  devolverRolagemDepois();
}

function ouvirOHistorico(): void {
  if (ouvindo) return;
  ouvindo = true;
  window.addEventListener("popstate", aoAndar);
  const nav = navegacao();
  // a Navigation API diz a direção do passo (Chrome); sem ela, voltou
  nav?.addEventListener("navigate", (evento) => {
    const e = evento as EventoDeNavegar;
    if (e.navigationType !== "traverse") return;
    const agora = nav.currentEntry?.index ?? 0;
    direcao = e.destination.index > agora ? 1 : -1;
  });
}

function podeReceberFoco(no: HTMLElement): boolean {
  return no.isConnected && no !== document.body && no.closest("[inert]") === null;
}

function irmaosParaInert(elemento: HTMLElement): Element[] {
  const alvos: Element[] = [];
  let atual: HTMLElement | null = elemento;
  while (atual && atual !== document.body && atual.parentElement) {
    for (const irmao of Array.from(atual.parentElement.children)) {
      if (irmao === atual) continue;
      // inerte por outro motivo que não uma camada: não é nosso
      if (irmao.hasAttribute("inert") && !marcas.has(irmao)) continue;
      const slot = irmao.getAttribute("data-slot") ?? "";
      const decide = ficaInerte({
        tag: irmao.tagName,
        avisos: irmao.hasAttribute("aria-live"),
        veu: slot.endsWith("-overlay"),
      });
      if (decide) alvos.push(irmao);
    }
    atual = atual.parentElement;
  }
  return alvos;
}

/**
 * Abre a camada `no`: guarda o foco de agora, põe o fundo `inert` e a empilha.
 * Devolve os candidatos ao foco da volta e a função que desfaz (tira as
 * marcas desta camada e a desempilha) — que não mexe no foco.
 */
export function abrirCamada(no: HTMLElement): {
  candidatos: HTMLElement[];
  soltar: () => void;
} {
  const ativo = document.activeElement;
  const candidatos = candidatosAoAbrir(
    ativo instanceof HTMLElement && ativo !== document.body && !no.contains(ativo)
      ? ativo
      : null,
    abertas.map((c) => ({
      contem: (el: HTMLElement) => c.no.contains(el),
      candidatos: c.candidatos,
    })),
  );
  const camada: Camada = { no, candidatos, entrada: null };
  abertas.push(camada);
  const alvos = irmaosParaInert(no);
  for (const el of marcar(marcas, alvos)) el.setAttribute("inert", "");
  ouvirOHistorico();
  /*
   * A entrada vai no fim da tarefa: o `StrictMode` do React monta, desmonta e
   * monta de novo na mesma tarefa, e só a camada que ficou empilha.
   */
  queueMicrotask(() => {
    if (!abertas.includes(camada) || camada.entrada !== null) return;
    if (empilhaEntrada(window.history.state)) empilharEntrada(camada);
  });
  return {
    candidatos,
    soltar: () => {
      const i = abertas.indexOf(camada);
      if (i >= 0) abertas.splice(i, 1);
      for (const el of desmarcar(marcas, alvos)) el.removeAttribute("inert");
      const entrada = camada.entrada;
      camada.entrada = null;
      if (entrada === null) {
        devolverRolagem();
        return;
      }
      /*
       * Decide depois do commit: se a camada saiu porque a rota mudou (um link
       * dentro dela, o "Concluir" que leva à Treino), a rota nova já está no
       * topo e a entrada dela fica embaixo — morta, e o voltar a pula. Se
       * fechou pelo Esc, pelo X ou pelo toque fora, a entrada é a do topo e sai.
       */
      setTimeout(() => {
        if (desfazAoFechar(window.history.state, entrada)) window.history.back();
        else devolverRolagem();
      }, 0);
    },
  };
}

/** O primeiro candidato que ainda pode receber o foco (ou `null`). */
export function focoDeVolta(candidatos: readonly HTMLElement[]): HTMLElement | null {
  return focoAoFechar(candidatos, podeReceberFoco);
}

/**
 * Para os primitivos do Radix: `ref` no `Content` (marca ao montar, desmarca
 * ao desmontar — depois da animação de saída e antes de o Radix devolver o
 * foco, que ele faz num `setTimeout`) e `devolverFoco` no `onCloseAutoFocus`.
 * O Radix só devolve o foco ao `Trigger`; as camadas abertas por estado (a
 * ficha no player, o "Descartar este treino?", o resumo do fim) não têm
 * Trigger, e o foco caía no `<body>`.
 */
export function useCamadaModal(): {
  ref: (no: HTMLElement | null) => (() => void) | undefined;
  devolverFoco: (evento: Event) => void;
} {
  const candidatos = useRef<HTMLElement[]>([]);
  const ref = useCallback((no: HTMLElement | null) => {
    if (!no) return undefined;
    const aberta = abrirCamada(no);
    candidatos.current = aberta.candidatos;
    return aberta.soltar;
  }, []);
  const devolverFoco = useCallback((evento: Event) => {
    if (evento.defaultPrevented) return;
    const alvo = focoDeVolta(candidatos.current);
    candidatos.current = [];
    if (!alvo) return;
    evento.preventDefault();
    alvo.focus();
  }, []);
  return { ref, devolverFoco };
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focaveisDe(no: HTMLElement): HTMLElement[] {
  return Array.from(no.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
    (el) => el.closest("[inert]") === null && el.getClientRects().length > 0,
  );
}

/**
 * Para uma camada que não é do Radix (a foto ampliada e o "Apagar esta
 * foto?"): a mesma regra, mais o Tab preso — o que o `FocusScope` do Radix faz
 * nas outras. Monta com a camada; `focoInicial` recebe o foco ao abrir. Ao
 * desmontar, o foco volta a quem abriu (se ainda existir e não estiver
 * inerte).
 */
export function useCamadaPropria(
  camada: RefObject<HTMLElement | null>,
  focoInicial: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const no = camada.current;
    if (!no) return;
    const aberta = abrirCamada(no);
    focoInicial.current?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented) return;
      // só a camada de cima prende o Tab
      if (abertas[abertas.length - 1]?.no !== no) return;
      const focaveis = focaveisDe(no);
      const ativo = document.activeElement;
      const atual = ativo instanceof HTMLElement ? focaveis.indexOf(ativo) : -1;
      const destino = proximoDoTab(focaveis.length, atual, e.shiftKey);
      if (destino === null) return;
      e.preventDefault();
      focaveis[destino]?.focus();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      aberta.soltar();
      focoDeVolta(aberta.candidatos)?.focus({ preventScroll: true });
    };
    // monta e desmonta com a camada: as refs são estáveis
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

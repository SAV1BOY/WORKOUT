"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  candidatosAoAbrir,
  desmarcar,
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
 *   (`aria-live`) e o véu da própria camada ficam de fora.
 * - Camadas empilhadas contam as marcas: fechar uma não libera o que outra
 *   ainda precisa inerte, em qualquer ordem.
 *
 * Sem dependência do Radix: a foto importa daqui sem levar o diálogo junto.
 */

type Camada = { no: HTMLElement; candidatos: HTMLElement[] };

/** As camadas abertas, de baixo para cima. */
const abertas: Camada[] = [];
/** Quantas camadas marcaram cada nó como `inert`. */
const marcas = new Map<Element, number>();

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
        veu: slot.endsWith("-overlay") || irmao.hasAttribute("data-veu"),
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
  const camada: Camada = { no, candidatos };
  abertas.push(camada);
  const alvos = irmaosParaInert(no);
  for (const el of marcar(marcas, alvos)) el.setAttribute("inert", "");
  return {
    candidatos,
    soltar: () => {
      const i = abertas.indexOf(camada);
      if (i >= 0) abertas.splice(i, 1);
      for (const el of desmarcar(marcas, alvos)) el.removeAttribute("inert");
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

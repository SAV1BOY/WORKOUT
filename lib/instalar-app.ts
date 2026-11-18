"use client";

import { useSyncExternalStore } from "react";

interface Convite extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let convite: Convite | null = null;
const assinantes = new Set<() => void>();
const avisar = () => { for (const fn of assinantes) fn(); };
function assinar(fn: () => void) {
  assinantes.add(fn);
  return () => { assinantes.delete(fn); };
}

/** O evento pode chegar na aba Treino, antes da abertura de Mais. */
export function observarInstalacao() {
  const modo = window.matchMedia("(display-mode: standalone)");
  const oferecer = (e: Event) => { e.preventDefault(); convite = e as Convite; avisar(); };
  const instalada = () => { convite = null; avisar(); };
  modo.addEventListener("change", avisar);
  window.addEventListener("beforeinstallprompt", oferecer);
  window.addEventListener("appinstalled", instalada);
  return () => {
    modo.removeEventListener("change", avisar);
    window.removeEventListener("beforeinstallprompt", oferecer);
    window.removeEventListener("appinstalled", instalada);
  };
}

function estado() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?: boolean}).standalone) return "instalado";
  return convite ? "disponivel" : ios ? "ios" : "indisponivel";
}

export function useInstalacao() {
  const atual = useSyncExternalStore(assinar, estado, () => "indisponivel");
  return {
    botao: atual === "disponivel",
    instrucao: atual === "ios" ? "Para instalar, toque em Compartilhar no Safari e em Adicionar à Tela de Início." : null,
    async instalar() {
      const atual = convite;
      if (!atual) return;
      convite = null;
      avisar();
      try { await atual.prompt(); await atual.userChoice; }
      catch { /* O navegador pode recusar um convite expirado. */ }
    },
  };
}

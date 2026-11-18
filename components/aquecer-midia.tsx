"use client";

import { useEffect } from "react";
import { aquecerMidiaDaFase, redePermiteAquecimento } from "@/lib/precache-do-programa";
import { usePerfil } from "@/lib/queries/dados";

/**
 * Depois que o service worker assume, guarda no cache as figuras e fotos dos
 * exercícios da fase atual (SPEC §8) — é o que faz o treino abrir inteiro no
 * terraço sem sinal. Roda uma vez por fase e nunca atrapalha a tela.
 */
export function AquecerMidia() {
  const perfilQ = usePerfil();
  const fase = perfilQ.data?.fase_atual ?? null;

  useEffect(() => {
    if (!fase) return;
    const conexao = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!redePermiteAquecimento(conexao) || !navigator.serviceWorker) return;
    let pendente: number | undefined;
    let agendado = false;
    const tentar = () => {
      if (!navigator.serviceWorker.controller || agendado) return;
      agendado = true;
      if (typeof window.requestIdleCallback === "function") {
        pendente = window.requestIdleCallback(() => void aquecerMidiaDaFase(fase), { timeout: 5000 });
      } else {
        void aquecerMidiaDaFase(fase);
      }
    };
    const inicio = window.setTimeout(() => {
      navigator.serviceWorker.addEventListener("controllerchange", tentar);
      tentar();
    }, 3500);
    return () => {
      window.clearTimeout(inicio);
      if (pendente !== undefined) window.cancelIdleCallback(pendente);
      navigator.serviceWorker.removeEventListener("controllerchange", tentar);
    };
  }, [fase]);

  return null;
}

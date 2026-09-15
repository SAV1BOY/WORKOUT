"use client";

import { useEffect } from "react";
import { aquecerMidiaDaFase } from "@/lib/precache-do-programa";
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
    let vivo = true;

    const tentar = () => {
      if (vivo) void aquecerMidiaDaFase(fase);
    };

    const sw = navigator.serviceWorker;
    if (!sw) return;

    /*
     * `ready` resolve quando o service worker está ativo, mas a aba só passa a
     * ser controlada um instante depois (`clientsClaim`): sem esperar o
     * `controllerchange` o aquecimento sairia fora do cache na primeira visita.
     */
    sw.addEventListener("controllerchange", tentar);
    if (sw.controller) tentar();
    else void sw.ready.then(tentar).catch(() => {});

    return () => {
      vivo = false;
      sw.removeEventListener("controllerchange", tentar);
    };
  }, [fase]);

  return null;
}

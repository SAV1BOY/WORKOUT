/**
 * Manter a tela acesa durante a sessão (SPEC §3.2 e §7). O navegador solta o
 * wake lock sozinho quando a aba some — daí a reaquisição ao voltar visível.
 * A preferência mora em `profiles.prefs.manter_tela`.
 */
"use client";

import { useEffect } from "react";

interface Sentinela {
  released: boolean;
  release: () => Promise<void>;
}

type ComWakeLock = Navigator & {
  wakeLock?: { request: (tipo: "screen") => Promise<Sentinela> };
};

export function useTelaAcesa(ativo: boolean): void {
  useEffect(() => {
    if (!ativo || typeof navigator === "undefined") return;
    const api = (navigator as ComWakeLock).wakeLock;
    if (!api) return;

    let sentinela: Sentinela | null = null;
    let cancelado = false;

    const pedir = async () => {
      if (cancelado || document.visibilityState !== "visible") return;
      try {
        sentinela = await api.request("screen");
      } catch {
        // a bateria pode estar baixa: sem tela acesa, mas sem erro na cara
      }
    };

    const aoVoltar = () => {
      if (document.visibilityState === "visible" && (!sentinela || sentinela.released)) {
        void pedir();
      }
    };

    void pedir();
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoVoltar);
      void sentinela?.release().catch(() => {});
    };
  }, [ativo]);
}

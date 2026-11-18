"use client";

import { useSyncExternalStore } from "react";

function assinar(avise: () => void) {
  window.addEventListener("online", avise);
  window.addEventListener("offline", avise);
  return () => {
    window.removeEventListener("online", avise);
    window.removeEventListener("offline", avise);
  };
}

export function useRede(): boolean {
  return useSyncExternalStore(assinar, () => navigator.onLine, () => true);
}

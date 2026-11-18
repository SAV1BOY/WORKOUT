"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { pendentes } from "@/lib/outbox";

export function useFilaPendente() {
  const [quantos, setQuantos] = useState(0);
  useEffect(() => {
    const consulta = liveQuery(pendentes).subscribe({ next: setQuantos, error: () => {} });
    return () => consulta.unsubscribe();
  }, []);
  return quantos;
}

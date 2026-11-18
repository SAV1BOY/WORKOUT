"use client";

import { useFilaPendente } from "@/lib/usar-fila";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { lerCache } from "@/lib/db";
import { CHAVE_CACHE } from "@/lib/persistencia-query";
import { useRede } from "@/lib/usar-rede";

export function EstadoDaRede() {
  const online = useRede();
  const caminho = usePathname();
  const quantos = useFilaPendente();
  const [salvoEm, setSalvoEm] = useState<number>();
  useEffect(() => {
    if (online) return;
    let atual = true;
    void lerCache<{ salvoEm: number }>(CHAVE_CACHE).then(cache => {
      if (atual) setSalvoEm(cache?.salvoEm);
    }).catch(() => {});
    return () => { atual = false; };
  }, [online]);

  if (online && (!quantos || caminho === "/mais")) return null;
  const hora = salvoEm && new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <aside className="bg-muted text-muted-foreground mx-auto max-w-lg px-4 py-1.5 text-xs">
      <span role="status" aria-live="polite">
        {!online && <>Sem rede · mostrando o que já estava no celular{hora ? ` às ${hora}` : ""}.</>}
        {quantos > 0 && <> {quantos === 1 ? "1 registro aguardando envio." : `${quantos} registros aguardando envio.`}</>}
      </span>
      {quantos > 0 && caminho !== "/mais" && <Link href="/mais#sincronizacao" className="foco ml-1 inline-flex min-h-11 items-center underline">Ver sincronização</Link>}
    </aside>
  );
}

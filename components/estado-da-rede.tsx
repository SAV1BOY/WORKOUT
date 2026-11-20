"use client";

import { liveQuery } from "dexie";
import { useFilaPendente } from "@/lib/usar-fila";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { lerUltimaSincronizacao } from "@/lib/persistencia-query";
import { useRede } from "@/lib/usar-rede";

export function EstadoDaRede({ conta }: { conta: string }) {
  const online = useRede();
  const caminho = usePathname();
  const quantos = useFilaPendente();
  const [ultimaLeitura, setUltimaLeitura] = useState<{ conta: string; horario: number | null } | null>(null);
  useEffect(() => {
    if (online) return;
    const assinatura = liveQuery(() => lerUltimaSincronizacao(conta)).subscribe({
      next: horario => setUltimaLeitura({ conta, horario }),
      error: () => {},
    });
    return () => assinatura.unsubscribe();
  }, [conta, online]);

  if (online && (!quantos || caminho === "/mais")) return null;
  const sincronizadoEm = ultimaLeitura?.conta === conta ? ultimaLeitura.horario : null;
  const hora = sincronizadoEm && new Date(sincronizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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

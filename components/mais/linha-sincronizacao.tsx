"use client";

import { liveQuery } from "dexie";
import { useRede } from "@/lib/usar-rede";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  estadoDaFila,
  resumoDaFila,
  tentarAgora,
  type EstadoDaFila,
} from "@/lib/outbox";

/**
 * A fila de saída (SPEC §8) em /mais: quantos itens esperam a rede, o erro do
 * mais antigo e um "Tentar agora".
 *
 * Sem esta linha a fila só aparecia no cabeçalho da sessão de força, e um item
 * que falha para sempre (um 400 do PostgREST contra um schema velho) ficaria
 * tentando em silêncio — nada se perde, mas ninguém descobre.
 */
export function LinhaSincronizacao() {
  const [estado, setEstado] = useState<EstadoDaFila>({ quantos: 0 });
  const [tentando, setTentando] = useState(false);

  const online = useRede();
  useEffect(() => {
    const assinatura = liveQuery(estadoDaFila).subscribe({ next: setEstado, error: () => {} });
    return () => assinatura.unsubscribe();
  }, []);

  const { titulo, detalhe, travada } = resumoDaFila(estado);

  const tentar = async () => {
    setTentando(true);
    try {
      const subiram = await tentarAgora();
      const sobrou = await estadoDaFila();
      setEstado(sobrou);
      if (sobrou.quantos === 0) toast.success("Tudo sincronizado.");
      else if (subiram > 0) toast.success(`${subiram} subiram; ${sobrou.quantos} na fila.`);
      else toast.error(sobrou.erro ?? "Ainda não deu. Tente de novo com rede.");
    } finally {
      setTentando(false);
    }
  };

  return (
    <section
      id="sincronizacao"
      aria-label="Sincronização"
      className="bg-muted flex items-center gap-2 px-3 py-2"
    >
      <RefreshCw
        aria-hidden
        className={`size-4 shrink-0 ${travada ? "text-destructive" : "text-muted-foreground"}`}
      />
      <span role="status" aria-live="polite" className="flex min-w-0 flex-col">
        <span className="font-medium">{titulo}</span>
        {/* SPEC §22.3 item 11: o detalhe é cortado em três linhas. */}
        <span
          className="text-muted-foreground line-clamp-3 text-xs text-balance"
          title={detalhe}
        >
          {detalhe}
        </span>
      </span>
      {estado.quantos > 0 ? (
        <Button
          variant="outline"
          className="alvo ml-auto shrink-0"
          disabled={!online || tentando}
          onClick={() => void tentar()}
        >
          {!online ? "Sem rede" : tentando ? "Tentando…" : "Tentar agora"}
        </Button>
      ) : null}
    </section>
  );
}

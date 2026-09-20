"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

  const olhar = useCallback(async () => {
    setEstado(await estadoDaFila().catch(() => ({ quantos: 0 })));
  }, []);

  useEffect(() => {
    void olhar();
    const relogio = setInterval(() => void olhar(), 5_000);
    return () => clearInterval(relogio);
  }, [olhar]);

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
      aria-label="Sincronização"
      className="border-border flex items-center gap-3 rounded-lg border px-3 py-3"
    >
      <RefreshCw
        aria-hidden
        className={`size-5 shrink-0 ${travada ? "text-destructive" : "text-muted-foreground"}`}
      />
      <span className="flex min-w-0 flex-col">
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
          disabled={tentando}
          onClick={() => void tentar()}
        >
          {tentando ? "Tentando…" : "Tentar agora"}
        </Button>
      ) : null}
    </section>
  );
}

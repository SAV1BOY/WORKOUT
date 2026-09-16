"use client";

import { useState } from "react";
import { IconeDaCelula } from "@/components/relatorio/conquistas";
import { useConquistas } from "@/components/relatorio/usar-conquistas";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/formato";

/**
 * O aviso de conquista nova (SPEC §19.5): um card sóbrio com o ícone, o nome e
 * a data. Sem confete, sem som, sem pontos. O "Ok" grava os ids em
 * `prefs.conquistas_vistas` pela fila de saída (§8) e o card some na hora.
 *
 * Aparece no Relatório e na Conclusão do player — ali `sessaoConcluida` faz a
 * sessão que acabou contar antes de a fila subir.
 */
export function AvisoDeConquista({
  sessaoConcluida = null,
}: {
  sessaoConcluida?: { id: string; data: string } | null;
}) {
  const { novas, pronto, marcarComoVistas } = useConquistas({ sessaoConcluida });
  const [fechado, setFechado] = useState(false);

  if (!pronto || fechado || novas.length === 0) return null;

  return (
    <section
      aria-label="Conquista nova"
      data-aviso-conquista={novas.map((c) => c.id).join(" ")}
      className="cartao border-primary/40 bg-primary/5 flex flex-col gap-2 border p-3"
    >
      <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {novas.length === 1 ? "Conquista" : "Conquistas"}
      </h2>
      <ul className="flex flex-col gap-2">
        {novas.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
              <IconeDaCelula nome={c.icone} className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-balance">{c.nome}</span>
              <span className="text-muted-foreground text-xs text-balance">
                {c.descricao}
              </span>
            </span>
            {c.em ? (
              <span className="numero text-muted-foreground shrink-0 text-xs">
                {formatarData(c.em)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        className="alvo h-11"
        onClick={() => {
          setFechado(true);
          void marcarComoVistas(novas.map((c) => c.id));
        }}
      >
        Ok
      </Button>
    </section>
  );
}

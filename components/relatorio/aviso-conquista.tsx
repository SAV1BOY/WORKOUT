"use client";

import { useState } from "react";
import { IconeDaCelula } from "@/components/relatorio/conquistas";
import { useConquistas } from "@/components/relatorio/usar-conquistas";
import { Button } from "@/components/ui/button";
import { formatarData, formatarNumero } from "@/lib/formato";
import { useHoje } from "@/lib/relogio";

/** Quantas conquistas o aviso mostra antes de resumir em "e mais N". */
const LIMITE = 3;

/**
 * O aviso de conquista nova (SPEC §19.5 e §22.6 item 6): um card sóbrio com o
 * ícone, o nome e a data. Sem confete, sem som, sem pontos. O "Ok" grava os
 * ids em `prefs.conquistas_vistas` pela fila de saída (§8) e o card some na
 * hora.
 *
 * Três regras do §22.6: no máximo **3** linhas (o resto vira "e mais N"), a
 * data **só quando não é a de hoje** — anunciar como novidade uma conquista de
 * 1º de junho tira a credibilidade do aviso — e `role="status"`, para o leitor
 * de tela anunciar o card quando ele surge sem roubar o foco.
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
  const hoje = useHoje();
  const [fechado, setFechado] = useState(false);

  if (!pronto || fechado || novas.length === 0) return null;

  const mostradas = novas.slice(0, LIMITE);
  const aMais = novas.length - mostradas.length;

  return (
    <section
      role="status"
      aria-label="Conquista nova"
      data-aviso-conquista={novas.map((c) => c.id).join(" ")}
      className="cartao border-primary/40 bg-primary/5 flex flex-col gap-2 border p-3"
    >
      {/*
        "Nova conquista", não "Conquistas": a mesma tela já tem uma SEÇÃO
        chamada Conquistas, e o aviso ficava parecendo o título dela.
      */}
      <h2 className="text-muted-foreground text-rotulo font-medium tracking-wide uppercase">
        {novas.length === 1 ? "Nova conquista" : "Novas conquistas"}
      </h2>
      {/*
        Uma LINHA por conquista (SPEC §22.6 item 6): ícone, nome e, quando não
        é de hoje, a data. A descrição fica na seção Conquistas — aqui ela
        fazia o aviso ocupar 300 px no alto da tela.
      */}
      <ul className="flex flex-col gap-1.5">
        {mostradas.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
              <IconeDaCelula nome={c.icone} className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {c.nome}
            </span>
            {c.em && c.em !== hoje ? (
              <span className="numero text-muted-foreground shrink-0 text-xs">
                {formatarData(c.em)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {aMais > 0 ? (
        <p className="text-muted-foreground text-xs">
          e mais {formatarNumero(aMais)}
          {aMais === 1 ? " conquista" : " conquistas"} · veja em Conquistas
        </p>
      ) : null}
      <Button
        variant="outline"
        className="alvo"
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

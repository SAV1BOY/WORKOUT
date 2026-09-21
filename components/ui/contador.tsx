import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Número grande com rótulo (SPEC §13.1: "números grandes"). Usado nos
 * contadores da aba Treino e do Relatório.
 *
 * O rótulo ocupa **uma linha só** (SPEC §22.2 item 1). A 360 px cada coluna de
 * uma faixa de três tem ~80 px de texto: "VOLUME (KG)" e "BARRA FIXA" quebravam
 * em duas linhas e desciam o número, deixando os três contadores com bases
 * diferentes. A linha do rótulo tem altura fixa e não quebra — quem não couber
 * é encurtado no fim, nunca empurra o número para baixo.
 *
 * O encurtamento é a rede de segurança, não o normal: **nenhum rótulo real do
 * app pode chegar nela** (SPEC §22.6 item 7). O ladrilho de 95 px de uma
 * fileira de três deixava 55 px de texto e "BARRA FIXA" pede 62 — saía
 * "BARRA F…". A linha ganhou os pixels de volta em dois lugares: o ladrilho
 * usa `px-2` (8 px, e não 10) e o rótulo perdeu o `tracking-wide`, que a
 * 10 px custava 0,25 px por letra justo no rótulo mais comprido. Com o
 * `px-2` da seção do Relatório são **64 px para 60 px de texto**, 4 px de
 * folga onde antes faltavam 7.
 */
export function Contador({
  valor,
  rotulo,
  detalhe,
  icone,
  className,
}: {
  valor: ReactNode;
  rotulo: string;
  detalhe?: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-contador={rotulo}
      className={cn(
        "cartao border-border bg-card flex flex-col gap-0.5 border px-2 py-2.5",
        className,
      )}
    >
      <span
        data-rotulo={rotulo}
        /*
         * Duas regras ao mesmo tempo, e elas brigam se a gente for
         * desatento (SPEC §22.6 item 7).
         *
         * 1. Nada corta o rótulo na VERTICAL: o til de "SESSÕES" em
         *    versalete sobe acima da caixa de linha de 12 px
         *    (`text-micro`: 10 px × 1,2) e qualquer `overflow` que recorte
         *    em y come o acento — a linha saía "SESSOES".
         * 2. Nada escapa na HORIZONTAL: na fileira de Totais o ladrilho é
         *    uma GRADE (`grid-rows-[auto_1fr_auto]`, vinda do chamador),
         *    então este span é um item de grade e o `min-width: auto` dele
         *    só vira 0 quando o `overflow` do item NÃO é `visible`. Deixar
         *    os dois eixos `visible` fazia um rótulo maior que o ladrilho
         *    de 95 px estourar para 283 px, sem "…", e a página passava a
         *    rolar para o lado a 360 px.
         *
         * `min-w-0` + `overflow-x-clip` + `overflow-y-visible` (a única
         * combinação que o CSS deixa conviver com `visible`) atende as
         * duas: o span volta a caber no ladrilho, o "…" pinta e o til
         * também. O mesmo tratamento vale para o span de dentro, que é
         * quem desenha o "…". A altura fixa de 16 px — que alinha a base
         * dos três números — fica.
         */
        className="text-muted-foreground flex h-4 min-w-0 items-center gap-1 overflow-x-clip overflow-y-visible text-micro whitespace-nowrap uppercase"
      >
        {icone ? <span className="flex shrink-0 items-center">{icone}</span> : null}
        <span className="min-w-0 overflow-x-clip overflow-y-visible text-ellipsis whitespace-nowrap">
          {rotulo}
        </span>
      </span>
      <span className="numero-grande text-2xl leading-tight">{valor}</span>
      {detalhe ? (
        <span className="text-muted-foreground text-xs">{detalhe}</span>
      ) : null}
    </div>
  );
}

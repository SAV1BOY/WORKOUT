import { createCn } from "cn/config";

/**
 * O `cn` do projeto.
 *
 * O mesclador de classes do Tailwind precisa saber que `text-rotulo` e
 * `text-micro` (SPEC §22.3 item 6) são TAMANHOS de fonte do `@theme`. Sem
 * isso ele os lê como cor de texto — `text-<algo>` desconhecido cai no grupo
 * da cor — e, numa chamada como
 *
 *     cn("text-rotulo leading-none", aceso ? "text-primary" : "text-muted-foreground")
 *
 * ele joga o tamanho fora por "conflito" com a cor. Foi o que aconteceu na
 * faixa da semana e na barra de abas: os rótulos voltaram para 16 px e a
 * faixa passou a vazar os 360 px.
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["rotulo", "micro"] }] } },
});

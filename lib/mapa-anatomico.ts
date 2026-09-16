/**
 * O contrato do mapa muscular anatômico (marco Mídia): o id do símbolo que o
 * sprite publica e o `viewBox` do arquivo. Fica num módulo só para que o
 * componente (cliente) e o sprite (servidor, lê o disco) usem o mesmo número —
 * `lib/midia.test.ts` confere que ele continua batendo com o SVG de verdade.
 *
 * Geometria: MuscleMap (Melih Colpan, MIT), via openGym. Atribuição em
 * `assets/mapa-muscular/LICENCA-mapa-anatomico.md` e na tela Mais → Créditos.
 */

/** O `<symbol id="…">` que `SpriteMuscular` inline uma vez no layout. */
export const ID_MAPA_ANATOMICO = "mapa-anatomico";

/** O `viewBox` de `assets/mapa-muscular/mapa-anatomico.svg` (frente + costas). */
export const VIEWBOX_MAPA_ANATOMICO = "39 82 1370 1275";

/** A proporção do desenho, para a caixa não pular enquanto carrega. */
export const PROPORCAO_MAPA_ANATOMICO = "1370 / 1275";

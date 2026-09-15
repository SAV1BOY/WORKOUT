import { readFileSync } from "node:fs";
import { join } from "node:path";

let spriteEmCache: string | null = null;

/**
 * O sprite do corpo (assets/mapa-muscular/corpo-sprite.svg), inline uma vez no
 * layout. Fica separado de `MapaMuscular` porque lê do disco: importar este
 * arquivo de um componente de cliente levaria `node:fs` para o navegador.
 */
export function SpriteMuscular() {
  spriteEmCache ??= readFileSync(
    join(process.cwd(), "assets", "mapa-muscular", "corpo-sprite.svg"),
    "utf8",
  );
  return (
    <div
      aria-hidden="true"
      className="hidden"
      dangerouslySetInnerHTML={{ __html: spriteEmCache }}
    />
  );
}

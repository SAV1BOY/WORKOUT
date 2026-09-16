import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ID_MAPA_ANATOMICO, VIEWBOX_MAPA_ANATOMICO } from "@/lib/mapa-anatomico";

let spriteEmCache: string | null = null;

const PASTA = join(process.cwd(), "assets", "mapa-muscular");

function ler(arquivo: string): string {
  return readFileSync(join(PASTA, arquivo), "utf8");
}

/**
 * `mapa-anatomico.svg` é um SVG inteiro; aqui ele vira um `<symbol>` com o
 * mesmo `viewBox`, para o `<use>` do `MapaAnatomico` poder apontar para ele.
 * `<title>`/`<desc>` saem: quem dá o nome acessível é o `<svg>` que usa o
 * símbolo, e repetir viraria dois rótulos para a mesma figura.
 */
function comoSimbolo(): string {
  const bruto = ler("mapa-anatomico.svg");
  const abertura = /<svg\b[^>]*>/.exec(bruto);
  const fim = bruto.lastIndexOf("</svg>");
  if (!abertura || fim < 0) {
    throw new Error("assets/mapa-muscular/mapa-anatomico.svg não é um SVG");
  }
  const viewBox = /viewBox="([^"]+)"/.exec(abertura[0])?.[1];
  if (viewBox !== VIEWBOX_MAPA_ANATOMICO) {
    throw new Error(
      `mapa-anatomico.svg mudou de viewBox ("${viewBox}"): atualize VIEWBOX_MAPA_ANATOMICO`,
    );
  }
  const interno = bruto
    .slice(abertura.index + abertura[0].length, fim)
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/<desc>[\s\S]*?<\/desc>/g, "");
  return `<svg width="0" height="0" aria-hidden="true"><defs><symbol id="${ID_MAPA_ANATOMICO}" viewBox="${viewBox}">${interno}</symbol></defs></svg>`;
}

/**
 * Os corpos do mapa muscular, inline uma vez no layout: o sprite antigo
 * (`#bf`/`#bb`, compacto) e o mapa anatômico do marco Mídia
 * (`#mapa-anatomico`). Fica separado dos componentes de mapa porque lê do
 * disco: importar este arquivo de um componente de cliente levaria `node:fs`
 * para o navegador.
 */
export function SpriteMuscular() {
  spriteEmCache ??= ler("corpo-sprite.svg") + comoSimbolo();
  return (
    <div
      aria-hidden="true"
      className="hidden"
      dangerouslySetInnerHTML={{ __html: spriteEmCache }}
    />
  );
}

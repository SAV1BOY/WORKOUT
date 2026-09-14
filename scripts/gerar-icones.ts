/**
 * npm run icones — desenha o ícone do app em SVG e rasteriza em PNG com sharp.
 * Sem rede: o SVG é gerado aqui. Os PNG ficam em public/icons e vão para o git.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const fundo = "#0a0a0a";
const destaque = "#f97316";
const destino = join(process.cwd(), "public", "icons");

/** Barra com anilhas, centralizada; `margem` em % para a versão maskable. */
function svg(tamanho: number, margem: number): string {
  const s = tamanho;
  const c = s / 2;
  const escala = (1 - margem * 2) / 1;
  const b = (v: number) => c + (v - 50) * escala * (s / 100);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${fundo}"/>
  <g stroke="${destaque}" stroke-linecap="round" fill="${destaque}">
    <rect x="${b(18)}" y="${b(46)}" width="${b(82) - b(18)}" height="${b(54) - b(46)}" rx="${(s / 100) * 2 * escala}"/>
    <rect x="${b(22)}" y="${b(34)}" width="${b(30) - b(22)}" height="${b(66) - b(34)}" rx="${(s / 100) * 3 * escala}"/>
    <rect x="${b(70)}" y="${b(34)}" width="${b(78) - b(70)}" height="${b(66) - b(34)}" rx="${(s / 100) * 3 * escala}"/>
    <rect x="${b(12)}" y="${b(40)}" width="${b(20) - b(12)}" height="${b(60) - b(40)}" rx="${(s / 100) * 3 * escala}"/>
    <rect x="${b(80)}" y="${b(40)}" width="${b(88) - b(80)}" height="${b(60) - b(40)}" rx="${(s / 100) * 3 * escala}"/>
  </g>
</svg>`;
}

async function gerar() {
  mkdirSync(destino, { recursive: true });
  const arquivos: Array<[string, number, number]> = [
    ["icone-192.png", 192, 0.06],
    ["icone-512.png", 512, 0.06],
    ["icone-maskable-512.png", 512, 0.18],
    ["apple-touch-icon.png", 180, 0.06],
  ];
  for (const [nome, tamanho, margem] of arquivos) {
    const png = await sharp(Buffer.from(svg(tamanho, margem))).png().toBuffer();
    writeFileSync(join(destino, nome), png);
    console.log(`  public/icons/${nome}`);
  }
  // favicon do app router (app/icon.png)
  const favicon = await sharp(Buffer.from(svg(256, 0.06))).png().toBuffer();
  writeFileSync(join(process.cwd(), "app", "icon.png"), favicon);
  console.log("  app/icon.png");
  console.log("✓ ícones gerados");
}

gerar().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

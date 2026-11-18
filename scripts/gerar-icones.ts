/**
 * npm run icones — desenha o ícone do app em SVG e rasteriza em PNG com sharp.
 * Sem rede: o SVG é gerado aqui. Os PNG ficam em public/icons e vão para o git.
 *
 * SPEC §22.4 itens 5, 6 e 9 — além dos ícones, este script gera:
 *   · o `icone-maskable-192`, que faltava no manifest;
 *   · o `app/favicon.ico`, para `/favicon.ico` responder imagem e não o HTML
 *     de 404 (o App Router só serve esse caminho a partir deste arquivo);
 *   · as telas de abertura do iPhone (`apple-touch-startup-image`).
 *
 * A cor do destaque sai do token `--primary` do tema escuro em
 * `app/globals.css` — antes era um `#f97316` escrito à mão aqui, fora dos
 * tokens, e o ícone instalado tinha um laranja que não existe no app.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const raiz = process.cwd();

/** Lê `--primary` de dentro do bloco `.dark` de app/globals.css. */
function primariaDoTemaEscuro(): string {
  const css = readFileSync(join(raiz, "app", "globals.css"), "utf8");
  const escuro = /\.dark\s*\{([\s\S]*?)\n\}/.exec(css);
  const cor = escuro && /--primary:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(escuro[1]!);
  if (!cor) {
    throw new Error("não achei --primary no bloco .dark de app/globals.css");
  }
  return cor[1]!;
}

const fundo = "#0a0a0a";
const destaque = primariaDoTemaEscuro();
const destino = join(raiz, "public", "icons");

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

/**
 * O badge da notificação (SPEC §23.13): a mesma barra com anilhas, **branca
 * em fundo transparente**. O Android desenha o badge só pelo canal alfa — o
 * ícone colorido com fundo virava um quadrado branco na barra de status.
 */
function svgBadge(s: number): string {
  const b = (v: number) => (v / 100) * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <g fill="#ffffff">
    <rect x="${b(14)}" y="${b(45)}" width="${b(72)}" height="${b(10)}" rx="${b(2)}"/>
    <rect x="${b(20)}" y="${b(30)}" width="${b(10)}" height="${b(40)}" rx="${b(3)}"/>
    <rect x="${b(70)}" y="${b(30)}" width="${b(10)}" height="${b(40)}" rx="${b(3)}"/>
    <rect x="${b(8)}" y="${b(37)}" width="${b(10)}" height="${b(26)}" rx="${b(3)}"/>
    <rect x="${b(82)}" y="${b(37)}" width="${b(10)}" height="${b(26)}" rx="${b(3)}"/>
  </g>
</svg>`;
}

/**
 * As telas de abertura do iPhone: o app instalado abria num preto sem nada
 * até o shell pintar. Fundo `#0a0a0a` (o mesmo `background_color` do
 * manifest) e o ícone no meio, a 30 % do lado menor.
 */
const ABERTURAS: Array<[largura: number, altura: number]> = [
  [1170, 2532],
  [1284, 2778],
  [1179, 2556],
  [1290, 2796],
  [828, 1792],
  [750, 1334],
];

/**
 * Um .ico com um PNG dentro (o formato aceita isso desde o Vista e todo
 * navegador que interessa lê). Assim não entra dependência nova só para
 * escrever 22 bytes de cabeçalho.
 */
function icoComPng(png: Buffer, lado: number): Buffer {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // 1 = ícone
  cabecalho.writeUInt16LE(1, 4); // uma imagem só
  const entrada = Buffer.alloc(16);
  entrada.writeUInt8(lado >= 256 ? 0 : lado, 0); // largura (0 = 256)
  entrada.writeUInt8(lado >= 256 ? 0 : lado, 1); // altura
  entrada.writeUInt8(0, 2); // paleta: nenhuma
  entrada.writeUInt8(0, 3); // reservado
  entrada.writeUInt16LE(1, 4); // planos
  entrada.writeUInt16LE(32, 6); // bits por pixel
  entrada.writeUInt32LE(png.length, 8);
  entrada.writeUInt32LE(6 + 16, 12); // onde o PNG começa
  return Buffer.concat([cabecalho, entrada, png]);
}

async function gerar() {
  mkdirSync(destino, { recursive: true });
  console.log(`  destaque ${destaque} (--primary do tema escuro)`);
  const arquivos: Array<[string, number, number]> = [
    ["icone-192.png", 192, 0.06],
    ["icone-512.png", 512, 0.06],
    // o manifest pedia um maskable de 192: sem ele o Android reescalava o de
    // 512 e o atalho da tela inicial saía com o desenho borrado
    ["icone-maskable-192.png", 192, 0.18],
    ["icone-maskable-512.png", 512, 0.18],
    ["apple-touch-icon.png", 180, 0.06],
  ];
  for (const [nome, tamanho, margem] of arquivos) {
    const png = await sharp(Buffer.from(svg(tamanho, margem))).png().toBuffer();
    writeFileSync(join(destino, nome), png);
    console.log(`  public/icons/${nome}`);
  }

  // o badge: só alfa (branco puro onde há desenho), 96 px como o Chrome pede
  const badge = await sharp(Buffer.from(svgBadge(96))).ensureAlpha().png().toBuffer();
  writeFileSync(join(destino, "badge-96.png"), badge);
  console.log("  public/icons/badge-96.png");

  // ícone do app router (app/icon.png) e o /favicon.ico, que é outro arquivo
  const favicon = await sharp(Buffer.from(svg(256, 0.06))).png().toBuffer();
  writeFileSync(join(raiz, "app", "icon.png"), favicon);
  console.log("  app/icon.png");
  const de32 = await sharp(Buffer.from(svg(32, 0.06))).png().toBuffer();
  writeFileSync(join(raiz, "app", "favicon.ico"), icoComPng(de32, 32));
  console.log("  app/favicon.ico");

  for (const [largura, altura] of ABERTURAS) {
    const lado = Math.round(Math.min(largura, altura) * 0.3);
    const icone = await sharp(Buffer.from(svg(lado, 0.06))).png().toBuffer();
    const png = await sharp({
      create: {
        width: largura,
        height: altura,
        channels: 4,
        background: fundo,
      },
    })
      .composite([{ input: icone, gravity: "centre" }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    const nome = `abertura-${largura}x${altura}.png`;
    writeFileSync(join(destino, nome), png);
    console.log(`  public/icons/${nome}`);
  }
  console.log("✓ ícones gerados");
}

gerar().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

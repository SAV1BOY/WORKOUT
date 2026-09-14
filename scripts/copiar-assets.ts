/**
 * npm run assets — copia assets/{figuras,fotos,itens,mapa-muscular} para public/.
 * Idempotente: só copia o que mudou de tamanho ou data. As pastas de destino
 * ficam no .gitignore; o prebuild roda este script.
 */
import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const pastas = ["figuras", "fotos", "itens", "mapa-muscular"];

let copiadas = 0;

for (const pasta of pastas) {
  const origem = join(raiz, "assets", pasta);
  const destino = join(raiz, "public", pasta);
  if (!existsSync(origem)) {
    console.error(`✗ assets/${pasta} não existe`);
    process.exit(1);
  }
  mkdirSync(destino, { recursive: true });
  cpSync(origem, destino, {
    recursive: true,
    force: true,
    filter(src, dest) {
      const a = statSync(src);
      if (a.isDirectory()) return true;
      if (!existsSync(dest)) {
        copiadas += 1;
        return true;
      }
      const b = statSync(dest);
      const mudou = a.size !== b.size || a.mtimeMs > b.mtimeMs;
      if (mudou) copiadas += 1;
      return mudou;
    },
  });
}

console.log(
  copiadas === 0
    ? "✓ assets já estavam em public/ (nada a copiar)"
    : `✓ ${copiadas} arquivo(s) copiado(s) para public/`,
);

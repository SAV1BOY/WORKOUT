/**
 * npm run assets — copia assets/{figuras,fotos,ilustracoes,itens,mapa-muscular}
 * para public/ e gera ali as **derivadas** de imagem (SPEC §22.4 item 1).
 * `assets/videos` é opcional (SPEC §13.1): se a pasta existir, os .mp4 vão
 * junto para `public/videos`; se não existir, nada acontece.
 * Idempotente: só copia o que mudou de tamanho ou data. As pastas de destino
 * ficam no .gitignore; o prebuild roda este script.
 *
 * As derivadas nascem aqui e só aqui — nada delas entra em `assets/` nem no
 * git, e nenhuma imagem nova é baixada: são recortes do que já veio no kit.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import sharp, { type Sharp } from "sharp";

const raiz = process.cwd();
const pastas = ["figuras", "fotos", "ilustracoes", "itens", "mapa-muscular"];
/** Pastas que podem não existir — nenhum vídeo vem no kit (SPEC §13.1). */
const opcionais = ["videos"];

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

for (const pasta of opcionais) {
  const origem = join(raiz, "assets", pasta);
  if (!existsSync(origem)) continue;
  const destino = join(raiz, "public", pasta);
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

/* ------------------------------------------------------------------ *
 * Derivadas (SPEC §22.4 item 1)
 *
 * O kit só tem JPEG grande: a foto de execução é 850×567 e ia inteira para
 * uma miniatura de 56 px (7,6× o necessário) e para a capa de 326×160 (1,30×,
 * mole no retina). Aqui cada original ganha, em `public/`:
 *
 *   <nome>.webp        fotos e itens, até 1200 px — a versão grande
 *   <nome>-mini.webp   112×112 (2× de 56) — fotos, ilustrações e itens
 *   <nome>-capa.webp   720×360 (2× da caixa da capa) — só as fotos `-1`
 *
 * Quem aponta para elas é `lib/midia.ts`/`lib/capas.ts`, sempre com o arquivo
 * original de reserva: se a derivada faltar, a tela continua desenhando.
 * ------------------------------------------------------------------ */

/** Qualidade do WebP: 78 é o joelho da curva para foto de execução. */
const QUALIDADE = 78;
/** Maior lado da versão grande — a ficha aberta nunca passa disso. */
const LADO_MAXIMO = 1200;
/** Lado da miniatura: 2× a caixa de 56 px, para a tela retina. */
const LADO_MINI = 112;
/** Caixa da capa (326×160) em 2×, arredondada para 2:1. */
const CAPA = { largura: 720, altura: 360 };
/** Uma ilustração mais alta que isto é cortada pelo alto em vez de encolher. */
const PROPORCAO_ALTA = 0.7;

/** Extensões que viram derivada em cada pasta. */
const ORIGINAIS: Record<string, RegExp> = {
  fotos: /\.jpe?g$/i,
  itens: /\.jpe?g$/i,
  ilustracoes: /\.(webp|svg)$/i,
};

function arquivosDe(pasta: string, aceita: RegExp): string[] {
  const raizDaPasta = join(raiz, "public", pasta);
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) andar(caminho);
      else if (aceita.test(entrada.name)) achados.push(caminho);
    }
  };
  if (existsSync(raizDaPasta)) andar(raizDaPasta);
  return achados;
}

/** A derivada só é refeita quando o original é mais novo que ela. */
function precisaRefazer(origem: string, destino: string): boolean {
  if (!existsSync(destino)) return true;
  return statSync(origem).mtimeMs > statSync(destino).mtimeMs;
}

/** `/public/fotos/x.jpg` + "-mini" → `/public/fotos/x-mini.webp` */
function derivada(origem: string, sufixo: string): string {
  return origem.slice(0, origem.length - extname(origem).length) + sufixo + ".webp";
}

type Tarefa = { origem: string; destino: string; recorte: (s: Sharp) => Sharp };

const tarefas: Tarefa[] = [];

function pedir(origem: string, sufixo: string, recorte: Tarefa["recorte"]) {
  const destino = derivada(origem, sufixo);
  if (precisaRefazer(origem, destino)) tarefas.push({ origem, destino, recorte });
}

for (const [pasta, aceita] of Object.entries(ORIGINAIS)) {
  for (const origem of arquivosDe(pasta, aceita)) {
    const nome = origem.slice(0, origem.length - extname(origem).length);
    // uma derivada nunca vira fonte de outra
    if (/-(mini|capa)$/.test(nome)) continue;

    if (pasta === "ilustracoes") {
      pedir(origem, "-mini", (s) => s);
      continue;
    }
    pedir(origem, "", (s) =>
      s.resize(LADO_MAXIMO, LADO_MAXIMO, { fit: "inside", withoutEnlargement: true }),
    );
    pedir(origem, "-mini", (s) =>
      s.resize(LADO_MINI, LADO_MINI, {
        fit: "cover",
        // a foto de execução é uma pessoa: cortar pelo alto mostra o corpo;
        // o item de equipamento é um objeto centrado na foto
        position: pasta === "fotos" ? "top" : "centre",
      }),
    );
    if (pasta === "fotos" && /-1$/.test(nome)) {
      pedir(origem, "-capa", (s) =>
        s.resize(CAPA.largura, CAPA.altura, { fit: "cover", position: "centre" }),
      );
    }
  }
}

/**
 * A miniatura da ilustração precisa saber a proporção do arquivo antes de
 * escolher o recorte, e isso só o `sharp` responde — por isso ela é decidida
 * na hora de gerar, e não no laço acima.
 */
async function miniaturaDaIlustracao(origem: string, destino: string) {
  // `density` alta: os 30 SVG da coleção são vetoriais e rasterizam sem serrilha
  const entrada = sharp(origem, { density: 384 });
  const { width = 1, height = 1 } = await entrada.metadata();
  const proporcao = width / height;
  const caixa =
    proporcao < PROPORCAO_ALTA
      ? // ilustração alta: corta pelo alto, o corpo ocupa a caixa inteira
        ({ fit: "cover", position: "top" } as const)
      : // larga ou quase quadrada: cabe inteira, com margem transparente
        ({ fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } } as const);
  await entrada
    .resize(LADO_MINI, LADO_MINI, caixa)
    .webp({ quality: QUALIDADE, alphaQuality: 100 })
    .toFile(destino);
}

async function gerarDerivadas() {
  if (tarefas.length === 0) {
    console.log("✓ derivadas de imagem já estavam em public/");
    return;
  }
  // 4 CPUs: o sharp já usa libvips em paralelo, 4 arquivos de cada vez basta
  const FRENTES = 4;
  let feitas = 0;
  let erros = 0;
  const fila = [...tarefas];
  await Promise.all(
    Array.from({ length: FRENTES }, async () => {
      for (let t = fila.pop(); t; t = fila.pop()) {
        try {
          if (t.destino.endsWith("-mini.webp") && t.origem.includes("/ilustracoes/")) {
            await miniaturaDaIlustracao(t.origem, t.destino);
          } else {
            await t
              .recorte(sharp(t.origem, { density: 384 }))
              .webp({ quality: QUALIDADE })
              .toFile(t.destino);
          }
          feitas += 1;
        } catch (e) {
          erros += 1;
          console.error(`✗ ${relative(raiz, t.destino)}: ${(e as Error).message}`);
        }
      }
    }),
  );
  if (erros > 0) process.exit(1);
  console.log(`✓ ${feitas} derivada(s) de imagem geradas em public/`);
}

gerarDerivadas().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

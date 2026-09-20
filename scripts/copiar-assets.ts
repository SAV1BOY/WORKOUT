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
 *
 * O que entra no git é `data/medidas-de-foto.json`: a medida **medida** de
 * cada foto do kit e da derivada que as telas pedem (SPEC §22.4 item 3). Quem
 * abre cada arquivo com o sharp é este script, então é ele quem sabe — nada de
 * supor que as 162 fotos têm todas o mesmo tamanho (auditoria do lote 4).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, relative } from "node:path";
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
 * O kit só tem JPEG grande: a foto de execução tem 850 px de largura (a
 * altura varia, ver o bloco das medidas mais abaixo) e ia inteira para uma
 * miniatura de 56 px (7,6× o necessário) e para a capa de 326×160 (1,30×,
 * mole no retina). Aqui cada original ganha, em `public/`:
 *
 *   <nome>.webp        só as fotos, até 1200 px — a versão grande
 *   <nome>-mini.webp   112×112 (2× de 56) — fotos, ilustrações e itens
 *   <nome>-capa.webp   720×360 (2× da caixa da capa) — só as fotos `-1`
 *
 * A versão grande é da foto de execução e só dela: é o que a ficha do
 * exercício e a foto em tela cheia pedem (44 kB no lugar de 70). O item de
 * equipamento nunca aparece maior que a caixa de 64 px, então gerar a versão
 * grande dele eram 85 arquivos que ninguém pedia (auditoria do lote 4).
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

function arquivosDe(pasta: string, aceita: RegExp, base = "public"): string[] {
  const raizDaPasta = join(raiz, base, pasta);
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
    if (pasta === "fotos") {
      pedir(origem, "", (s) =>
        s.resize(LADO_MAXIMO, LADO_MAXIMO, { fit: "inside", withoutEnlargement: true }),
      );
    }
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

/* ------------------------------------------------------------------ *
 * A medida de cada foto (SPEC §22.4 item 3)
 *
 * A `<img>` só reserva a caixa certa se disser o tamanho **do arquivo que
 * ela pede**. As fotos do kit não são uniformes — 152 medem 850×567, seis
 * medem 850×1275 (e a derivada, limitada a 1200 px no maior lado, sai
 * 800×1200) e quatro medem 850×569 —, então supor uma medida só punha a
 * `<img>` mais pesada do app para reservar uma caixa de proporção errada
 * (auditoria do lote 4).
 *
 * Como este script já abre cada foto com o sharp, é aqui que a medida real
 * fica registrada, em `data/medidas-de-foto.json` — o mesmo papel que
 * `data/ilustracoes.json` cumpre para as ilustrações. O arquivo entra no git
 * (as telas o importam pelo `lib/dados.ts`) e é reescrito só quando muda.
 * ------------------------------------------------------------------ */

const ARQUIVO_DAS_MEDIDAS = join(raiz, "data", "medidas-de-foto.json");

type Par = [number, number];

async function medir(arquivo: string): Promise<Par> {
  const { width, height } = await sharp(arquivo).metadata();
  if (!width || !height) {
    throw new Error(`não deu para medir ${relative(raiz, arquivo)}`);
  }
  return [width, height];
}

async function medirFotos() {
  const originais = arquivosDe("fotos", /\.jpe?g$/i, "assets").sort();
  const fotos: Record<string, { kit: Par; webp: Par }> = {};
  const faltando: string[] = [];

  for (const original of originais) {
    const nome = basename(original, extname(original));
    const derivada = join(raiz, "public", "fotos", `${nome}.webp`);
    if (!existsSync(derivada)) {
      faltando.push(nome);
      continue;
    }
    fotos[nome] = { kit: await medir(original), webp: await medir(derivada) };
  }

  if (faltando.length > 0) {
    console.error(
      `✗ ${faltando.length} foto(s) sem derivada WebP em public/fotos (ex.: ${faltando[0]})`,
    );
    process.exit(1);
  }

  // uma foto por linha: 162 entradas de quatro números ficam ilegíveis se o
  // JSON.stringify quebrar cada par em três linhas
  const linhas = Object.entries(fotos).map(
    ([nome, m]) =>
      `    ${JSON.stringify(nome)}: { "kit": [${m.kit.join(", ")}], "webp": [${m.webp.join(", ")}] }`,
  );
  const cabecalho = {
    gerado_por:
      "npm run assets (scripts/copiar-assets.ts) — medido com sharp, não editar à mão",
    formato:
      "<nome da foto>: kit = [largura, altura] de assets/fotos/<nome>.jpg · webp = [largura, altura] da derivada public/fotos/<nome>.webp, que é o arquivo que as telas pedem",
  };
  const texto = [
    "{",
    `  ${JSON.stringify("gerado_por")}: ${JSON.stringify(cabecalho.gerado_por)},`,
    `  ${JSON.stringify("formato")}: ${JSON.stringify(cabecalho.formato)},`,
    '  "fotos": {',
    linhas.join(",\n"),
    "  }",
    "}",
    "",
  ].join("\n");

  const antes = existsSync(ARQUIVO_DAS_MEDIDAS)
    ? readFileSync(ARQUIVO_DAS_MEDIDAS, "utf8")
    : "";
  if (antes === texto) {
    console.log(`✓ data/medidas-de-foto.json já tinha as ${originais.length} fotos`);
    return;
  }
  writeFileSync(ARQUIVO_DAS_MEDIDAS, texto);
  console.log(`✓ data/medidas-de-foto.json: ${originais.length} fotos medidas`);
}

gerarDerivadas()
  .then(medirFotos)
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });

/**
 * npm run ilustracoes — importa as ilustrações de exercício com licença livre.
 *
 * **Não faz parte dos portões nem do build.** É uma ferramenta de uma vez só:
 * o levantamento (Everkinetic no Wikimedia Commons + wger) vive fora do
 * repositório, e o que entra aqui é o resultado — `assets/ilustracoes/`,
 * `data/ilustracoes.json` e `data/ilustracoes-creditos.md`, todos versionados.
 * Rodar de novo com a mesma origem dá exatamente o mesmo resultado.
 *
 * Uso:
 *
 *   npx tsx scripts/importar-ilustracoes.ts <pasta-do-levantamento>
 *   # ou: MIDIA_ORIGEM=<pasta> npm run ilustracoes
 *
 * A pasta precisa ter `everkinetic/manifesto.json` e `wger/manifesto.json`
 * junto dos arquivos que eles citam.
 *
 * Regra de escolha por exercício (decisão do dono, 15/09/2026 — veja
 * `docs/analise-referencia-treino-em-casa.md` §4):
 *
 *   Everkinetic exata → wger exata → Everkinetic aproximada → wger aproximada
 *   → nenhuma (o exercício continua com a figura animada do kit)
 *
 * Só ilustração: nada de `.mov`, nada de fotografia de pessoa real, e nada sem
 * autor **e** licença registrados (sem os dois o exercício fica de fora).
 * PNG/JPEG/WebP viram **WebP** com no máximo 640 px de largura; SVG é copiado
 * como está.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { exerciciosSchema, type Exercicio } from "../lib/schemas";

/* --------------------------------------------------------------- entrada */

const raiz = process.cwd();
const origem = process.argv[2] ?? process.env.MIDIA_ORIGEM ?? "";

if (!origem) {
  console.error(
    [
      "uso: npx tsx scripts/importar-ilustracoes.ts <pasta-do-levantamento>",
      "",
      "A pasta precisa ter everkinetic/manifesto.json e wger/manifesto.json.",
      "O resultado (assets/ilustracoes, data/ilustracoes.json e",
      "data/ilustracoes-creditos.md) já está versionado: só rode isto para",
      "refazer a importação a partir de um levantamento novo.",
    ].join("\n"),
  );
  process.exit(1);
}

/** Largura máxima das ilustrações rasterizadas (o app mostra a 360 px, 2×). */
const LARGURA_MAX = 640;
/** No máximo duas posições por exercício: início (-1) e fim (-2). */
const POSICOES = 2;

const DESTINO = join(raiz, "assets", "ilustracoes");

/*
 * Revisão visual dos arquivos que a regra escolheria no wger: estes são
 * **fotografia de pessoa real** (ou render 3D de procedência não resolvida),
 * não ilustração, e a decisão do dono é usar só ilustração. Com os três fora,
 * `agachamento-goblet` cai para a figura animada do kit.
 */
const RECUSADOS: Readonly<Record<string, string>> = {
  "agachamento-goblet-1.jpeg": "fotografia de pessoa real",
  "agachamento-goblet-2.jpeg": "fotografia de pessoa real",
  "agachamento-goblet-3.gif": "render 3D de procedência não resolvida",
};

/** Extensões que não são ilustração parada. */
const EXTENSOES_FORA = new Set(["mov", "mp4", "webm"]);

/* ------------------------------------------------------------ manifestos */

interface ItemEverkinetic {
  exercicio_id: string;
  arquivos?: string[];
  titulo_commons?: string[];
  url_pagina?: string[];
  autor?: string;
  licenca?: string;
  correspondencia: string;
  nota?: string;
}

interface ArquivoWger {
  arquivo: string;
  url: string;
  licenca?: string;
  autor?: string;
  autor_origem?: string;
}

interface ItemWger {
  exercicio_id: string;
  wger_id: number;
  nome_wger?: string;
  arquivos?: ArquivoWger[];
  correspondencia: string;
  nota?: string;
}

function lerManifesto<T>(pasta: string): T[] {
  const caminho = join(origem, pasta, "manifesto.json");
  if (!existsSync(caminho)) {
    console.error(`✗ ${caminho} não existe`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(caminho, "utf8")) as T[];
}

const everkinetic = lerManifesto<ItemEverkinetic>("everkinetic");
const wger = lerManifesto<ItemWger>("wger");

const exercicios = exerciciosSchema.parse(
  JSON.parse(readFileSync(join(raiz, "data", "exercicios.json"), "utf8")),
);

/* ------------------------------------------------------------- a escolha */

type Fonte = "everkinetic" | "wger";
type Correspondencia = "exata" | "aproximada";

interface Candidato {
  fonte: Fonte;
  correspondencia: Correspondencia;
  /** Arquivos na pasta de origem, já filtrados, na ordem das posições. */
  arquivos: string[];
  autor: string;
  licenca: string;
  url_fonte: string;
  titulo_fonte: string;
  nota: string;
}

function extensao(arquivo: string): string {
  return arquivo.slice(arquivo.lastIndexOf(".") + 1).toLowerCase();
}

function aceitavel(pasta: string, arquivo: string): boolean {
  if (RECUSADOS[arquivo] !== undefined) return false;
  if (EXTENSOES_FORA.has(extensao(arquivo))) return false;
  return existsSync(join(origem, pasta, arquivo));
}

/** "CC-BY-SA 4" / "CC BY-SA 3.0 Unported" → "CC BY-SA 4.0" / "CC BY-SA 3.0". */
function licencaNormal(bruta: string): string {
  const versao = /(\d)(?:\.(\d))?/.exec(bruta);
  const n = versao ? `${versao[1]}.${versao[2] ?? "0"}` : "";
  return `CC BY-SA ${n}`.trim();
}

function candidatoEverkinetic(item: ItemEverkinetic | undefined): Candidato | null {
  if (!item) return null;
  if (item.correspondencia !== "exata" && item.correspondencia !== "aproximada") {
    return null;
  }
  if (!item.autor || !item.licenca) return null;
  const arquivos = (item.arquivos ?? [])
    .filter((a) => aceitavel("everkinetic", a))
    .slice(0, POSICOES);
  if (arquivos.length === 0) return null;
  return {
    fonte: "everkinetic",
    correspondencia: item.correspondencia,
    arquivos,
    autor: item.autor,
    licenca: licencaNormal(item.licenca),
    url_fonte: item.url_pagina?.[0] ?? "https://commons.wikimedia.org/",
    titulo_fonte: item.titulo_commons?.[0] ?? arquivos[0]!,
    nota: item.nota ?? "",
  };
}

function candidatoWger(item: ItemWger | undefined): Candidato | null {
  if (!item) return null;
  if (item.correspondencia !== "exata" && item.correspondencia !== "aproximada") {
    return null;
  }
  const bons = (item.arquivos ?? []).filter(
    (a) =>
      !!a.autor &&
      !!a.licenca &&
      // autoria só pelo histórico do exercício não serve como crédito da imagem
      !(a.autor_origem ?? "").includes("author_history") &&
      aceitavel("wger", a.arquivo),
  );
  const primeiro = bons[0];
  if (!primeiro) return null;
  // um crédito por entrada: só entram os arquivos do mesmo autor e licença
  const arquivos = bons
    .filter((a) => a.autor === primeiro.autor && a.licenca === primeiro.licenca)
    .slice(0, POSICOES);
  return {
    fonte: "wger",
    correspondencia: item.correspondencia,
    arquivos: arquivos.map((a) => a.arquivo),
    autor: primeiro.autor!,
    licenca: licencaNormal(primeiro.licenca!),
    url_fonte: `https://wger.de/en/exercise/${item.wger_id}/view/`,
    titulo_fonte: item.nome_wger ?? String(item.wger_id),
    nota: item.nota ?? "",
  };
}

const porIdEverkinetic = new Map(everkinetic.map((e) => [e.exercicio_id, e]));
const porIdWger = new Map(wger.map((e) => [e.exercicio_id, e]));

/** A regra do dono, na ordem. */
function escolher(exercicio: Exercicio): Candidato | null {
  const ev = candidatoEverkinetic(porIdEverkinetic.get(exercicio.id));
  const wg = candidatoWger(porIdWger.get(exercicio.id));
  if (ev?.correspondencia === "exata") return ev;
  if (wg?.correspondencia === "exata") return wg;
  if (ev?.correspondencia === "aproximada") return ev;
  if (wg?.correspondencia === "aproximada") return wg;
  return null;
}

/* ------------------------------------------------------------- a cópia */

interface ArquivoDaIlustracao {
  arquivo: string;
  largura: number;
  altura: number;
}

interface Ilustracao {
  exercicio_id: string;
  fonte: Fonte;
  correspondencia: Correspondencia;
  arquivos: ArquivoDaIlustracao[];
  autor: string;
  licenca: string;
  url_fonte: string;
  titulo_fonte: string;
  nota: string;
}

async function copiar(
  pasta: Fonte,
  arquivo: string,
  destinoBase: string,
): Promise<ArquivoDaIlustracao> {
  const de = join(origem, pasta, arquivo);
  const ext = extensao(arquivo);

  if (ext === "svg") {
    const nome = `${destinoBase}.svg`;
    copyFileSync(de, join(DESTINO, nome));
    const m = await sharp(de).metadata();
    return {
      arquivo: `assets/ilustracoes/${nome}`,
      largura: m.width ?? 0,
      altura: m.height ?? 0,
    };
  }

  /*
   * O formato real é decidido pelo conteúdo, não pela extensão — no
   * levantamento há `.jpg` que é WebP e `.jfif` que é JPEG. `sharp` fareja o
   * arquivo, então a extensão errada na origem não atrapalha.
   */
  const nome = `${destinoBase}.webp`;
  const saida = await sharp(de)
    .resize({ width: LARGURA_MAX, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(join(DESTINO, nome));
  return {
    arquivo: `assets/ilustracoes/${nome}`,
    largura: saida.width,
    altura: saida.height,
  };
}

/* ------------------------------------------------------------- créditos */

function creditos(lista: Ilustracao[]): string {
  const porFonte = (f: Fonte) => lista.filter((i) => i.fonte === f);
  const linha = (i: Ilustracao) =>
    `| ${i.exercicio_id} | [${i.titulo_fonte}](${i.url_fonte}) | ${i.autor} | ${i.licenca} | ${i.correspondencia}${i.nota ? ` — ${i.nota}` : ""} |`;

  return [
    "# Créditos das ilustrações",
    "",
    "Gerado por `scripts/importar-ilustracoes.ts`. **Não edite à mão.**",
    "",
    `As ${lista.length} ilustrações de \`assets/ilustracoes/\` são obra de terceiros,`,
    "usadas sob **CC BY-SA** com atribuição. As imagens foram **redimensionadas**",
    "(no máximo 640 px de largura) e convertidas para WebP; SVG ficou SVG.",
    "Uma obra derivada de material CC BY-SA continua sob CC BY-SA — as versões",
    "redimensionadas aqui continuam sob a mesma licença da obra original.",
    "",
    "A tela **Mais → Créditos** mostra isto dentro do app.",
    "",
    `## Everkinetic, via Wikimedia Commons (${porFonte("everkinetic").length} exercícios)`,
    "",
    "Desenhos do acervo [Everkinetic](https://everkinetic.com/), publicados no",
    "Wikimedia Commons e no repositório `chaosbastler/opentraining-exercises`.",
    "",
    "| exercício | arquivo de origem | autor | licença | correspondência |",
    "|---|---|---|---|---|",
    ...porFonte("everkinetic").map(linha),
    "",
    `## wger (${porFonte("wger").length} exercícios)`,
    "",
    "Imagens enviadas por colaboradores do [wger](https://wger.de/), cada uma com",
    "o autor e a licença que o próprio wger registra.",
    "",
    "| exercício | exercício no wger | autor | licença | correspondência |",
    "|---|---|---|---|---|",
    ...porFonte("wger").map(linha),
    "",
    "## Fora",
    "",
    "Arquivos recusados na revisão visual (a decisão é usar só ilustração):",
    "",
    ...Object.entries(RECUSADOS).map(([a, m]) => `- \`${a}\` — ${m}`),
    "",
  ].join("\n");
}

/* ----------------------------------------------------------------- main */

async function main() {
  // a pasta é reescrita do zero: o que sai do manifesto não fica para trás
  if (existsSync(DESTINO)) {
    for (const f of readdirSync(DESTINO)) rmSync(join(DESTINO, f));
  } else {
    mkdirSync(DESTINO, { recursive: true });
  }

  const lista: Ilustracao[] = [];
  const semIlustracao: string[] = [];

  for (const exercicio of exercicios) {
    const escolhido = escolher(exercicio);
    if (!escolhido) {
      semIlustracao.push(exercicio.id);
      continue;
    }
    const arquivos: ArquivoDaIlustracao[] = [];
    for (let i = 0; i < escolhido.arquivos.length; i++) {
      arquivos.push(
        await copiar(
          escolhido.fonte,
          escolhido.arquivos[i]!,
          `${exercicio.id}-${i + 1}`,
        ),
      );
    }
    lista.push({
      exercicio_id: exercicio.id,
      fonte: escolhido.fonte,
      correspondencia: escolhido.correspondencia,
      arquivos,
      autor: escolhido.autor,
      licenca: escolhido.licenca,
      url_fonte: escolhido.url_fonte,
      titulo_fonte: escolhido.titulo_fonte,
      nota: escolhido.nota,
    });
  }

  writeFileSync(
    join(raiz, "data", "ilustracoes.json"),
    `${JSON.stringify(lista, null, 2)}\n`,
  );
  writeFileSync(join(raiz, "data", "ilustracoes-creditos.md"), creditos(lista));

  const porFonte = (f: Fonte) => lista.filter((i) => i.fonte === f).length;
  const exatas = lista.filter((i) => i.correspondencia === "exata").length;
  console.log(
    `✓ ${lista.length} ilustrações (${porFonte("everkinetic")} Everkinetic · ${porFonte("wger")} wger · ${exatas} exatas)`,
  );
  console.log(
    `  ${semIlustracao.length} exercício(s) seguem com a figura do kit: ${semIlustracao.join(", ")}`,
  );
}

void main();

/**
 * Compara duas pastas de capturas (a base do ultraloop e a de depois de um
 * lote) e diz, tela por tela, quanto mudou.
 *
 *   npx tsx scripts/comparar-capturas.ts <base> <depois> \
 *     [--saida <dir>] [--esperadas 11-relatorio-topo,15-corpo-peso] [--limiar 0.5]
 *
 * Para cada PNG presente nas DUAS pastas: lê em `.raw()` com sharp (já é
 * dependência do projeto), conta os pixels em que algum canal difere por mais
 * de 16, escreve `<nome>.diff.png` (o que mudou em vermelho sobre a nova em
 * cinza) e monta `comparacao.md`. Sai com 1 se alguma tela NÃO esperada passou
 * do limiar — é assim que o portão visual de um lote reprova sozinho.
 *
 * `--esperadas` casa por prefixo: `11-relatorio-topo` cobre os dois temas, e
 * o nome sem o número também vale (SPEC §22.12 item 8): `explorar` cobre
 * `06-explorar-claro.png` e `06-explorar-escuro.png`.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const LIMITE_CANAL = 16;

interface Opcoes {
  base: string;
  depois: string;
  saida: string;
  esperadas: string[];
  limiar: number;
}

function ler(argv: string[]): Opcoes {
  const soltos: string[] = [];
  let saida = "";
  let esperadas: string[] = [];
  let limiar = 0.5;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--saida") saida = argv[++i] ?? "";
    else if (a === "--esperadas") esperadas = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--limiar") limiar = Number(argv[++i] ?? "0.5");
    else soltos.push(a);
  }
  if (soltos.length < 2) {
    console.error("uso: comparar-capturas.ts <base> <depois> [--saida dir] [--esperadas a,b] [--limiar 0.5]");
    process.exit(2);
  }
  return {
    base: soltos[0] ?? "",
    depois: soltos[1] ?? "",
    saida: saida || join(soltos[1] ?? "", "diff"),
    esperadas,
    limiar,
  };
}

interface Linha {
  tela: string;
  delta: number;
  esperada: boolean;
  veredito: "igual" | "mudou" | "dimensao" | "só na base" | "só depois";
}

function pngs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".png") && !n.endsWith(".diff.png"))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function comparar(o: Opcoes): Promise<number> {
  mkdirSync(o.saida, { recursive: true });
  const naBase = pngs(o.base);
  const noDepois = pngs(o.depois);
  const linhas: Linha[] = [];

  for (const nome of naBase) {
    if (!noDepois.includes(nome)) {
      linhas.push({ tela: basename(nome, ".png"), delta: 100, esperada: esperada(o, nome), veredito: "só na base" });
    }
  }
  for (const nome of noDepois) {
    if (!naBase.includes(nome)) {
      linhas.push({ tela: basename(nome, ".png"), delta: 100, esperada: esperada(o, nome), veredito: "só depois" });
    }
  }

  for (const nome of naBase.filter((n) => noDepois.includes(n))) {
    const a = await sharp(join(o.base, nome)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(join(o.depois, nome)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const tela = basename(nome, ".png");
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
      linhas.push({ tela, delta: 100, esperada: esperada(o, nome), veredito: "dimensao" });
      continue;
    }

    const total = b.info.width * b.info.height;
    const diff = Buffer.alloc(total * 3);
    let diferentes = 0;
    for (let p = 0; p < total; p++) {
      const i = p * 4;
      const mudou =
        Math.abs(a.data[i]! - b.data[i]!) > LIMITE_CANAL ||
        Math.abs(a.data[i + 1]! - b.data[i + 1]!) > LIMITE_CANAL ||
        Math.abs(a.data[i + 2]! - b.data[i + 2]!) > LIMITE_CANAL;
      const j = p * 3;
      if (mudou) {
        diferentes++;
        diff[j] = 255;
        diff[j + 1] = 24;
        diff[j + 2] = 32;
      } else {
        // a nova, em cinza claro, como pano de fundo
        const cinza = Math.round(
          (b.data[i]! * 0.299 + b.data[i + 1]! * 0.587 + b.data[i + 2]! * 0.114) * 0.45 + 120,
        );
        const c = Math.min(255, cinza);
        diff[j] = c;
        diff[j + 1] = c;
        diff[j + 2] = c;
      }
    }
    await sharp(diff, { raw: { width: b.info.width, height: b.info.height, channels: 3 } })
      .png()
      .toFile(join(o.saida, `${tela}.diff.png`));

    const delta = (diferentes / total) * 100;
    linhas.push({
      tela,
      delta,
      esperada: esperada(o, nome),
      veredito: delta > o.limiar ? "mudou" : "igual",
    });
  }

  linhas.sort((x, y) => y.delta - x.delta || x.tela.localeCompare(y.tela, "pt-BR"));
  const surpresas = linhas.filter(
    (l) => !l.esperada && l.veredito !== "igual",
  );

  const md = [
    "# Comparação de capturas",
    "",
    `base: \`${o.base}\`  ·  depois: \`${o.depois}\`  ·  limiar: ${o.limiar} %`,
    "",
    "| tela | Δ% | esperada? | veredito |",
    "| --- | ---: | :---: | --- |",
    ...linhas.map(
      (l) => `| ${l.tela} | ${l.delta.toFixed(2)} | ${l.esperada ? "sim" : "não"} | ${l.veredito} |`,
    ),
    "",
    surpresas.length
      ? `**${surpresas.length} tela(s) mudaram sem estar na lista de esperadas:** ${surpresas
          .map((s) => s.tela)
          .join(", ")}`
      : "Nenhuma tela mudou fora do esperado.",
    "",
  ].join("\n");
  writeFileSync(join(o.saida, "comparacao.md"), md);
  console.log(md);
  return surpresas.length ? 1 : 0;
}

function esperada(o: Opcoes, nome: string): boolean {
  return casaEsperada(o.esperadas, nome);
}

/**
 * Um PNG é esperado quando o nome começa por alguma das `esperadas` — com o
 * número ("06-explorar") ou sem ele ("explorar"). Sem o número, o nome tem de
 * casar a partir do começo do nome da tela e parar numa fronteira ("-" ou
 * ".png"): "colecao" casa "07-colecao-claro.png", mas "cao" não casa, nem
 * "explo" casa "06-explorar".
 */
export function casaEsperada(esperadas: readonly string[], nome: string): boolean {
  const semNumero = nome.replace(/^\d+-/, "");
  return esperadas.some((e) => {
    if (e === "") return false;
    if (nome.startsWith(e)) return true;
    if (!semNumero.startsWith(e)) return false;
    const resto = semNumero.slice(e.length);
    return resto === "" || resto.startsWith("-") || resto.startsWith(".");
  });
}

/* Só roda quando chamado pela linha de comando — o teste importa a função. */
const principal = process.argv[1] ? resolve(process.argv[1]) : "";
if (principal === fileURLToPath(import.meta.url)) {
  comparar(ler(process.argv.slice(2)))
    .then((codigo) => process.exit(codigo))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}

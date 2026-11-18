/** Confere o conteúdo real do worker gerado contra os manifestos desta compilação. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

function lerJson<T>(arquivo: string): T {
  return JSON.parse(readFileSync(join(".next", arquivo), "utf8"));
}

function propriedade(no: ts.Node, nome: string): no is ts.PropertyAssignment {
  return ts.isPropertyAssignment(no)
    && (ts.isIdentifier(no.name) || ts.isStringLiteral(no.name))
    && no.name.text === nome;
}

function localizarManifesto(no: ts.Node): ts.ArrayLiteralExpression | undefined {
  if (propriedade(no, "precacheEntries") && ts.isArrayLiteralExpression(no.initializer)) {
    return no.initializer;
  }
  return ts.forEachChild(no, localizarManifesto);
}

function entradasDoWorker(): Set<string> {
  const fonte = ts.createSourceFile("sw.js", readFileSync("public/sw.js", "utf8"), ts.ScriptTarget.Latest);
  const manifesto = localizarManifesto(fonte);
  if (!manifesto) throw new Error("O worker compilado não tem o manifesto de instalação");
  const urls = new Set<string>();
  for (const entrada of manifesto.elements) {
    if (ts.isStringLiteral(entrada)) {
      urls.add(decodeURIComponent(entrada.text));
      continue;
    }
    const url = ts.isObjectLiteralExpression(entrada)
      ? entrada.properties.find((campo) => propriedade(campo, "url"))
      : undefined;
    if (!url || !ts.isPropertyAssignment(url) || !ts.isStringLiteral(url.initializer)) {
      throw new Error("Entrada de precache sem URL estática");
    }
    urls.add(decodeURIComponent(url.initializer.text));
  }
  return urls;
}

const urls = entradasDoWorker();
const app = lerJson<{ pages: Record<string, string[]> }>("app-build-manifest.json");
const dinamicos = lerJson<Record<string, { files: string[] }>>("react-loadable-manifest.json");
const next = lerJson<{ pages: Record<string, string[]>; polyfillFiles: string[] }>("build-manifest.json");
const necessarios = new Set([
  ...Object.values(app.pages).flat(),
  ...Object.values(dinamicos).flatMap((grupo) => grupo.files),
  ...next.polyfillFiles,
]);
const faltantes = [...necessarios].map((arquivo) => "/_next/" + arquivo).filter((url) => !urls.has(url));
if (!urls.has("/~offline")) faltantes.push("/~offline");
if (faltantes.length) throw new Error("Faltam recursos para funcionamento offline: " + faltantes.join(", "));

const indevidos = [...urls].filter((url) => url.startsWith("/figuras/"));
if (!existsSync("pages") && !existsSync("src/pages")) {
  const soPages = new Set(Object.values(next.pages).flat().filter((nome) => !necessarios.has(nome)));
  for (const url of urls) {
    if (soPages.has(url.slice("/_next/".length)) || /\/_next\/static\/[^/]+\/_(build|ssg)Manifest\.js$/.test(url)) {
      indevidos.push(url);
    }
  }
}
if (indevidos.length) throw new Error("Recursos extras no precache de instalação: " + indevidos.join(", "));

const total = [...urls].reduce((soma, url) => {
  let arquivo = join("public", url);
  if (url === "/~offline") arquivo = ".next/server/app/~offline.html";
  if (url.startsWith("/_next/")) arquivo = join(".next", url.slice("/_next/".length));
  return soma + statSync(arquivo).size;
}, 0);
console.log(`Precache verificado: ${urls.size} recursos, ${total} bytes (${(total / 1048576).toFixed(2)} MiB).`);

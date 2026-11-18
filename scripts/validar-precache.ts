/** Confere o conteúdo real do worker gerado contra os manifestos desta compilação. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

function lerJson<T>(arquivo: string): T {
  return JSON.parse(readFileSync(join(".next", arquivo), "utf8"));
}

function entradasDoWorker(): Set<string> {
  const fonte = ts.createSourceFile("sw.js", readFileSync("public/sw.js", "utf8"), ts.ScriptTarget.Latest);
  const urls = new Set<string>();
  function visitar(no: ts.Node): void {
    if (ts.isPropertyAssignment(no) && ts.isIdentifier(no.name) && no.name.text === "precacheEntries" && ts.isArrayLiteralExpression(no.initializer)) {
      for (const entrada of no.initializer.elements) {
        if (ts.isObjectLiteralExpression(entrada)) {
          for (const campo of entrada.properties) {
            if (ts.isPropertyAssignment(campo) && (ts.isIdentifier(campo.name) || ts.isStringLiteral(campo.name)) && campo.name.text === "url" && ts.isStringLiteral(campo.initializer)) {
              urls.add(decodeURIComponent(campo.initializer.text));
            }
          }
        }
      }
      return;
    }
    ts.forEachChild(no, visitar);
  }
  visitar(fonte);
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
  const arquivo = url === "/~offline" ? ".next/server/app/~offline.html" :
    url.startsWith("/_next/") ? join(".next", url.slice("/_next/".length)) : join("public", url);
  return soma + statSync(arquivo).size;
}, 0);
console.log(`Precache verificado: ${urls.size} recursos, ${total} bytes (${(total / 1048576).toFixed(2)} MiB).`);

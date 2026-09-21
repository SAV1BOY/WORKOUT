import { describe, expect, it } from "vitest";
import { MAXIMO_DE_ASSETS, copiaServe, urlsDeAssets } from "@/lib/sw-assets";

const ORIGEM = "https://treino-terraco.vercel.app";

/** O HTML que a `/~offline` do Next devolve: 14 pedaços e uma folha. */
function paginaDoNext(pedacos: number): string {
  const scripts = Array.from(
    { length: pedacos },
    (_, i) =>
      `<script src="/_next/static/chunks/app/~offline/page-${i}.js" async=""></script>`,
  ).join("");
  return [
    "<!DOCTYPE html><html lang=\"pt-BR\"><head>",
    '<link rel="stylesheet" href="/_next/static/css/folha.css" data-precedence="next"/>',
    '<script>self.__next_f=[];self.__next_f.push([1,"..."])</script>',
    "</head><body>",
    scripts,
    "</body></html>",
  ].join("");
}

describe("urlsDeAssets", () => {
  it("pega os scripts com src e a folha de estilo, na ordem e sem repetir", () => {
    const urls = urlsDeAssets(paginaDoNext(3), ORIGEM);
    expect(urls).toEqual([
      "/_next/static/css/folha.css",
      "/_next/static/chunks/app/~offline/page-0.js",
      "/_next/static/chunks/app/~offline/page-1.js",
      "/_next/static/chunks/app/~offline/page-2.js",
    ]);
  });

  it("ignora o script embutido do Next, que não tem src", () => {
    expect(urlsDeAssets('<script>self.__next_f=[]</script>', ORIGEM)).toEqual([]);
  });

  it("ignora link que não é folha de estilo", () => {
    const html = [
      '<link rel="icon" href="/icone.png"/>',
      '<link rel="preload" as="image" href="/figura.svg"/>',
      '<link rel="stylesheet" href="/_next/static/css/a.css"/>',
    ].join("");
    expect(urlsDeAssets(html, ORIGEM)).toEqual(["/_next/static/css/a.css"]);
  });

  it("deixa de fora o que vem de outro domínio, e guarda o que vem do nosso por URL inteira", () => {
    const html = [
      '<script src="https://cdn.de-fora.test/a.js"></script>',
      `<script src="${ORIGEM}/_next/static/chunks/b.js"></script>`,
      '<script src="data:text/javascript,1"></script>',
    ].join("");
    expect(urlsDeAssets(html, ORIGEM)).toEqual(["/_next/static/chunks/b.js"]);
  });

  it("não repete a mesma URL duas vezes", () => {
    const html =
      '<script src="/a.js"></script><script src="/a.js"></script>';
    expect(urlsDeAssets(html, ORIGEM)).toEqual(["/a.js"]);
  });

  it("aceita aspas simples e os atributos em qualquer ordem", () => {
    const html =
      "<script async src='/a.js' type='module'></script><link href=\"/b.css\" rel=\"stylesheet\"/>";
    expect(urlsDeAssets(html, ORIGEM)).toEqual(["/a.js", "/b.css"]);
  });

  it("guarda a busca da URL: é ela que diferencia dois pedaços", () => {
    expect(urlsDeAssets('<script src="/a.js?v=2"></script>', ORIGEM)).toEqual([
      "/a.js?v=2",
    ]);
  });
});

describe("copiaServe", () => {
  it("com os 14 pedaços da página e todos em cache, a cópia serve", () => {
    const urls = urlsDeAssets(paginaDoNext(14), ORIGEM);
    expect(urls).toHaveLength(15); // 14 pedaços + a folha
    expect(copiaServe(urls, new Set(urls))).toBe(true);
  });

  it("faltando um só pedaço, a cópia NÃO serve — é a tela do 'Application error'", () => {
    const urls = urlsDeAssets(paginaDoNext(14), ORIGEM);
    const menosUm = new Set(urls.slice(0, -1));
    expect(copiaServe(urls, menosUm)).toBe(false);
  });

  it("página sem asset nenhum serve", () => {
    expect(copiaServe([], new Set())).toBe(true);
  });

  it("assets demais não servem, nem que estejam todos em cache", () => {
    const urls = Array.from({ length: MAXIMO_DE_ASSETS + 1 }, (_, i) => `/a${i}.js`);
    expect(copiaServe(urls, new Set(urls))).toBe(false);
    expect(copiaServe(urls.slice(0, MAXIMO_DE_ASSETS), new Set(urls))).toBe(true);
  });
});

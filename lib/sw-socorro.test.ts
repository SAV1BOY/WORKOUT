import { describe, expect, it } from "vitest";
import {
  FRASE,
  IR_PARA_O_TREINO,
  TENTAR,
  TITULO,
  htmlDeSocorro,
} from "@/lib/sw-socorro";

const html = htmlDeSocorro();

describe("o HTML de socorro do service worker (SPEC §22.10)", () => {
  it("diz a mesma coisa que a página /~offline", () => {
    expect(html).toContain(`<title>${TITULO} — Treino do Terraço</title>`);
    expect(html).toContain(`<h1>${TITULO}</h1>`);
    expect(html).toContain(FRASE);
  });

  /*
   * O defeito de 21/09: o socorro tinha só o título e a frase. Quem caía nele
   * não tinha como sair — nem recarregar, nem voltar ao Treino.
   */
  it("tem os dois atos da página: recarregar e ir para o Treino", () => {
    expect(html).toContain(TENTAR);
    expect(html).toContain("location.reload()");
    expect(html).toContain(IR_PARA_O_TREINO);
    expect(html).toContain('href="/"');
  });

  it("os dois alvos têm 48 px de altura e largura cheia (SPEC §11)", () => {
    expect(html).toContain("min-height:48px");
    const atos = html.match(/class="ato /g) ?? [];
    expect(atos).toHaveLength(2);
    expect(html).toMatch(/\.ato\{[^}]*width:100%/);
    /*
     * Um é `<button>` e o outro é `<a>`: `:first-of-type` e `:last-of-type`
     * casariam com os DOIS (cada um é o primeiro e o último do seu tipo) e o
     * botão de ação perderia o preenchimento. Cada um leva a sua classe.
     */
    expect(html).toContain('class="ato primeiro"');
    expect(html).toContain('class="ato segundo"');
    expect(html).not.toMatch(/:(first|last)-of-type/);
    expect(html).toMatch(/\.primeiro\{[^}]*background:var\(--destaque\)/);
  });

  it("tem os dois temas com os tokens de app/globals.css", () => {
    expect(html).toContain("--fundo:rgb(224,224,221)");
    expect(html).toContain("--texto:rgb(10,10,10)");
    expect(html).toContain("@media(prefers-color-scheme:dark)");
    expect(html).toContain("--fundo:rgb(10,10,10)");
    expect(html).toContain("--texto:rgb(245,245,244)");
  });

  it("respeita o entalhe do celular e declara o idioma", () => {
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain("env(safe-area-inset-top)");
    expect(html).toContain("env(safe-area-inset-bottom)");
    expect(html).toContain("env(safe-area-inset-left)");
    expect(html).toContain("env(safe-area-inset-right)");
  });

  /*
   * É o único HTML que tem de abrir com o aparelho vazio: nenhum arquivo, de
   * lugar nenhum. Nem `<script src>`, nem fonte, nem folha de estilo.
   */
  it("não busca nada de fora", () => {
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/url\(/i);
  });

  it("cabe numa resposta mínima (< 4 KB)", () => {
    expect(new TextEncoder().encode(html).length).toBeLessThan(4096);
  });

  it("é função pura: duas chamadas, a mesma string", () => {
    expect(htmlDeSocorro()).toBe(html);
  });
});

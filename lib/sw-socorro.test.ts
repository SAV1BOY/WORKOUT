import { describe, expect, it } from "vitest";
import {
  FRASE,
  IR_PARA_O_TREINO,
  TENTAR,
  TITULO,
  htmlDeSocorro,
} from "@/lib/sw-socorro";

const html = htmlDeSocorro();

type Cor = [number, number, number];

function deHex(hex: string): Cor {
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Cor;
}

/** Luminância relativa da WCAG 2.2. */
function luz([r, g, b]: Cor): number {
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function razao(a: Cor, b: Cor): number {
  const [maior, menor] = [luz(a), luz(b)].sort((x, y) => y - x);
  return (maior! + 0.05) / (menor! + 0.05);
}


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

  /*
   * WCAG 1.4.11: o contorno é a única coisa que desenha o alvo secundário, e
   * ele é a segunda saída de quem caiu aqui. Com o `--linha` do app o botão
   * quase sumia no fundo (1,3:1 no claro).
   */
  it("o contorno do alvo secundário tem 3:1 contra o fundo nos dois temas", () => {
    const linhas = [...html.matchAll(/--linha:#([0-9a-f]{6})/g)].map((m) => m[1]);
    expect(linhas).toHaveLength(2);

    const claro: Cor = [224, 224, 221];
    const escuro: Cor = [10, 10, 10];
    expect(razao(deHex(linhas[0]!), claro)).toBeGreaterThanOrEqual(3);
    expect(razao(deHex(linhas[1]!), escuro)).toBeGreaterThanOrEqual(3);
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

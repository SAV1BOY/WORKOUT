/**
 * O tema tem de passar no WCAG AA nos dois modos (SPEC §3: "tema escuro de
 * verdade" e celular no sol). As cores moram em `app/globals.css`, então o
 * teste lê o arquivo e faz a conta — mudar um token e perder contraste
 * quebra aqui, não na tela do Miguel.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Cor = { r: number; g: number; b: number };

const CSS = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

/** Os `--token: #rrggbb` de um bloco (`:root` ou `.dark`). */
function tokens(seletor: string): Record<string, Cor> {
  const i = CSS.indexOf(`${seletor} {`);
  if (i < 0) throw new Error(`bloco ${seletor} não existe em globals.css`);
  const j = CSS.indexOf("\n}", i);
  const bloco = CSS.slice(i, j);
  const saida: Record<string, Cor> = {};
  for (const [, nome, hex] of bloco.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    if (nome && hex) saida[nome] = hex6(hex);
  }
  return saida;
}

function hex6(hex: string): Cor {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

/** Frente com opacidade `alfa` sobre o fundo (o `bg-primary/10` do Tailwind). */
function sobre(frente: Cor, fundo: Cor, alfa: number): Cor {
  return {
    r: frente.r * alfa + fundo.r * (1 - alfa),
    g: frente.g * alfa + fundo.g * (1 - alfa),
    b: frente.b * alfa + fundo.b * (1 - alfa),
  };
}

function luminancia({ r, g, b }: Cor): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(a: Cor, b: Cor): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const CLARO = tokens(":root");
const ESCURO = tokens(".dark");

describe.each([
  ["tema claro", CLARO],
  ["tema escuro", ESCURO],
])("%s — WCAG AA (4,5:1 para texto normal)", (_nome, t) => {
  const pega = (chave: string): Cor => {
    const cor = t[chave];
    if (!cor) throw new Error(`token --${chave} não existe`);
    return cor;
  };

  it("texto sobre o fundo e sobre o card", () => {
    expect(contraste(pega("foreground"), pega("background"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(pega("card-foreground"), pega("card"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(pega("popover-foreground"), pega("popover"))).toBeGreaterThanOrEqual(4.5);
  });

  it("texto secundário (muted-foreground) sobre o fundo e sobre o card", () => {
    expect(contraste(pega("muted-foreground"), pega("background"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(pega("muted-foreground"), pega("card"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(pega("muted-foreground"), pega("muted"))).toBeGreaterThanOrEqual(4.5);
  });

  it("o botão de destaque (bg-primary + text-primary-foreground)", () => {
    expect(contraste(pega("primary-foreground"), pega("primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(pega("secondary-foreground"), pega("secondary"))).toBeGreaterThanOrEqual(4.5);
  });

  it("texto na cor de destaque (item aceso da navegação, chips)", () => {
    for (const fundo of ["background", "card", "secondary"] as const) {
      expect(contraste(pega("primary"), pega(fundo))).toBeGreaterThanOrEqual(4.5);
    }
    // `bg-primary/10` com `text-primary` (o pill do "saiu firme?", §3.2)
    for (const fundo of ["background", "card"] as const) {
      const tinta = sobre(pega("primary"), pega(fundo), 0.1);
      expect(contraste(pega("primary"), tinta)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("os erros (text-destructive, inclusive sobre bg-destructive/10)", () => {
    for (const fundo of ["background", "card"] as const) {
      expect(contraste(pega("destructive"), pega(fundo))).toBeGreaterThanOrEqual(4.5);
      const tinta = sobre(pega("destructive"), pega(fundo), 0.1);
      expect(contraste(pega("destructive"), tinta)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("o anel de foco aparece sobre o fundo (3:1, elemento gráfico)", () => {
    expect(contraste(pega("ring"), pega("background"))).toBeGreaterThanOrEqual(3);
    expect(contraste(pega("ring"), pega("card"))).toBeGreaterThanOrEqual(3);
  });

  it("as linhas dos gráficos sobre o card (3:1, elemento gráfico)", () => {
    for (const chave of ["chart-1", "chart-2", "chart-3"] as const) {
      expect(contraste(pega(chave), pega("card"))).toBeGreaterThanOrEqual(3);
    }
  });

  it("o mapa muscular distingue principal, auxiliar e corpo", () => {
    expect(contraste(pega("mprim"), pega("mbody"))).toBeGreaterThanOrEqual(3);
    expect(contraste(pega("msec"), pega("mbody"))).toBeGreaterThanOrEqual(1.2);
  });
});

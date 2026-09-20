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

export function luminancia({ r, g, b }: Cor): number {
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
    expect(contraste(pega("ring"), pega("muted"))).toBeGreaterThanOrEqual(3);
  });

  /*
   * SPEC §22.3 item 2. Medido antes do lote: card contra fundo dava 1,07:1 no
   * escuro e 1,04:1 no claro — as superfícies praticamente não existiam. Os
   * limiares deste bloco só sobem; afrouxar aqui é desfazer o item.
   */
  it("o card é um degrau acima do fundo, e a borda um degrau acima do card", () => {
    expect(contraste(pega("card"), pega("background"))).toBeGreaterThanOrEqual(1.3);
    expect(contraste(pega("popover"), pega("background"))).toBeGreaterThanOrEqual(1.3);
    expect(contraste(pega("border"), pega("card"))).toBeGreaterThanOrEqual(1.5);
    // as superfícies secundárias não podem voltar a ser buracos no card
    for (const chave of ["secondary", "muted", "accent"] as const) {
      expect(contraste(pega(chave), pega("card"))).toBeGreaterThanOrEqual(1.1);
    }
  });

  /*
   * SPEC §22.3 item 3 — WCAG SC 1.4.11: a borda de um campo é um elemento de
   * interface, e precisa de 3:1 contra a superfície que o cerca. `--input`
   * valia 1,36–1,46:1 no escuro.
   */
  it("a borda do campo tem 3:1 contra card, fundo e superfície secundária", () => {
    for (const fundo of ["card", "background", "muted", "secondary"] as const) {
      expect(contraste(pega("input"), pega(fundo))).toBeGreaterThanOrEqual(3);
    }
  });

  it("as linhas dos gráficos sobre o card (3:1, elemento gráfico)", () => {
    for (const chave of ["chart-1", "chart-2", "chart-3"] as const) {
      expect(contraste(pega(chave), pega("card"))).toBeGreaterThanOrEqual(3);
    }
  });

  it("as linhas auxiliares dos gráficos aparecem sobre o card", () => {
    // `chart-5` era #2e2e2e no escuro: sumia dentro do card novo
    for (const chave of ["chart-4", "chart-5"] as const) {
      expect(contraste(pega(chave), pega("card"))).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("o mapa muscular distingue principal, auxiliar e corpo", () => {
    expect(contraste(pega("mprim"), pega("mbody"))).toBeGreaterThanOrEqual(3);
    // 3:1 também para o auxiliar: é elemento gráfico, e no mapa anatômico do
    // marco Mídia ele é a única marca de "esse músculo ajuda" na figura
    expect(contraste(pega("msec"), pega("mbody"))).toBeGreaterThanOrEqual(3);
  });
});

/*
 * SPEC §22.3 item 4: a placa clara atrás das ilustrações de traço. No escuro
 * ela era `#e7e4e0` — 78 % de luminância, uma janela acesa de 328×208 px na
 * ficha do exercício. Acima de 60 % ela volta a ofuscar num treino à noite.
 */
describe("a placa das ilustrações (tema escuro)", () => {
  it("não passa de 60 % de luminância e mantém o traço legível", () => {
    const placa = ESCURO["ilustracao-fundo"];
    if (!placa) throw new Error("token --ilustracao-fundo não existe no .dark");
    expect(luminancia(placa)).toBeLessThanOrEqual(0.6);
    // o traço das ilustrações é preto puro sobre a placa
    expect(contraste(placa, { r: 0, g: 0, b: 0 })).toBeGreaterThanOrEqual(4.5);
  });
});

/*
 * SPEC §22.3 item 5: o que flutua (o FAB "Ajustar", o play do tutorial) tem de
 * ter contorno nos DOIS temas. `shadow-lg` é sombra preta: sobre `#0a0a0a` ela
 * não existe, então o escuro ganha um anel na cor de destaque.
 */
describe("a elevação do que flutua", () => {
  const bloco = (seletor: string): string => {
    const i = CSS.indexOf(`${seletor} {`);
    const j = CSS.indexOf("\n}", i);
    return CSS.slice(i, j);
  };

  it("os dois temas definem --sombra-flutuante e o utilitário existe", () => {
    expect(bloco(":root")).toContain("--sombra-flutuante:");
    expect(bloco(".dark")).toContain("--sombra-flutuante:");
    expect(CSS).toContain("box-shadow: var(--sombra-flutuante)");
  });

  it("no escuro o contorno é um anel de 1 px visível contra o fundo", () => {
    const escuro = bloco(".dark");
    const trecho = escuro.slice(escuro.indexOf("--sombra-flutuante:"));
    const anel = trecho.match(/0 0 0 1px rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/);
    if (!anel) throw new Error("o tema escuro não tem anel de 1 px na sombra flutuante");
    const [, r, g, b, alfa] = anel;
    const cor = { r: Number(r), g: Number(g), b: Number(b) };
    const sobreFundo = sobre(cor, ESCURO.background!, Number(alfa));
    const sobreCard = sobre(cor, ESCURO.card!, Number(alfa));
    expect(contraste(sobreFundo, ESCURO.background!)).toBeGreaterThanOrEqual(3);
    expect(contraste(sobreCard, ESCURO.card!)).toBeGreaterThanOrEqual(3);
  });
});

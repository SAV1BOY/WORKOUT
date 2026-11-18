import type { Page } from "@playwright/test";

/**
 * O contraste do texto contra o fundo efetivo (sobe pelos ancestrais até uma
 * cor opaca) — a mesma conta da varredura, aqui só para um elemento.
 */
export async function contrasteDe(page: Page, seletor: string): Promise<number> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return 0;
    const canal = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]: number[]) =>
      0.2126 * canal(r ?? 0) + 0.7152 * canal(g ?? 0) + 0.0722 * canal(b ?? 0);
    const rgba = (cor: string): number[] | null => {
      const m = cor.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = (m[1] ?? "").split(/[,/]/).map((x) => Number.parseFloat(x.trim()));
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, Number.isFinite(p[3]) ? (p[3] as number) : 1];
    };
    const sobrepor = (f: number[], fundo: number[]) => [
      (f[0] ?? 0) * (f[3] ?? 1) + (fundo[0] ?? 0) * (1 - (f[3] ?? 1)),
      (f[1] ?? 0) * (f[3] ?? 1) + (fundo[1] ?? 0) * (1 - (f[3] ?? 1)),
      (f[2] ?? 0) * (f[3] ?? 1) + (fundo[2] ?? 0) * (1 - (f[3] ?? 1)),
    ];
    const pilha: number[][] = [];
    let atual: Element | null = el;
    while (atual) {
      const c = rgba(getComputedStyle(atual).backgroundColor);
      if (c && (c[3] ?? 0) > 0) {
        pilha.push(c);
        if ((c[3] ?? 0) >= 0.999) break;
      }
      atual = atual.parentElement;
    }
    const raiz = rgba(getComputedStyle(document.documentElement).backgroundColor);
    let fundo = raiz && (raiz[3] ?? 0) > 0 ? [raiz[0] ?? 0, raiz[1] ?? 0, raiz[2] ?? 0] : [255, 255, 255];
    for (let i = pilha.length - 1; i >= 0; i--) fundo = sobrepor(pilha[i] ?? [], fundo);
    const cor = rgba(getComputedStyle(el).color) ?? [0, 0, 0, 1];
    const frente = sobrepor(cor, fundo);
    const a = lum(frente);
    const b = lum(fundo);
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  }, seletor);
}

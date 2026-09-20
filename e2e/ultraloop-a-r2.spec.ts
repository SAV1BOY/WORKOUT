/**
 * Ultraloop 20/09/2026 — faixa A, rodada 2, lote "fundação visual"
 * (SPEC §22.3). Aqui se guarda o que foi MEDIDO: o alvo de 44 px que virou
 * padrão do Button e do Input, o degrau entre card e fundo, a borda do campo
 * com os 3:1 da SC 1.4.11, a placa das ilustrações que parou de ofuscar no
 * escuro, a elevação do que flutua, o texto que não desce de 10 px, o anel de
 * foco em link de card e a aba acesa com forma além da cor.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

const TEMAS = ["dark", "light"] as const;
type Tema = (typeof TEMAS)[number];

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, QUARTA);
  await usuarioComPerfil();
  await entrarNoApp(page);
  await esperarAbaTreino(page);
});

async function abrir(page: Page, rota: string, tema: Tema): Promise<void> {
  await page.emulateMedia({ colorScheme: tema });
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
}

/** As contas de contraste da WCAG, do lado do navegador. */
const MEDIDAS = `
  const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const rgba = (cor) => {
    const m = String(cor).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,/]/).map((x) => Number.parseFloat(x.trim()));
    return [p[0] || 0, p[1] || 0, p[2] || 0, Number.isFinite(p[3]) ? p[3] : 1];
  };
  const sobrepor = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]), f[2] * f[3] + b[2] * (1 - f[3])];
  const fundoDe = (el) => {
    const pilha = [];
    let atual = el;
    while (atual) {
      const c = rgba(getComputedStyle(atual).backgroundColor);
      if (c && c[3] > 0) { pilha.push(c); if (c[3] >= 0.999) break; }
      atual = atual.parentElement;
    }
    let fundo = [255, 255, 255];
    for (let i = pilha.length - 1; i >= 0; i--) fundo = sobrepor(pilha[i], fundo);
    return fundo;
  };
`;

// =====================================================================
//  item 1 — 44 px por padrão no Button e no Input
// =====================================================================

test("os controles do projeto nascem com 44 px (Button e Input)", async ({ page }) => {
  for (const tema of TEMAS) {
    for (const rota of ["/", "/exercicios", "/mais/preferencias", "/mais/contas"]) {
      await abrir(page, rota, tema);
      const pequenos = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "main [data-slot=button], main [data-slot=input]",
          ),
        ]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              alvo: `${el.getAttribute("data-slot")} "${(el.textContent ?? "").trim().slice(0, 20)}"`,
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })
          .filter((a) => a.h > 0 && a.h < 44),
      );
      expect(pequenos, `${rota} (${tema}): controle abaixo de 44 px`).toEqual([]);
    }
  }
});

// =====================================================================
//  itens 2 e 3 — degrau entre superfícies e borda do campo
// =====================================================================

test("o card é um degrau acima do fundo e a borda do campo tem 3:1", async ({
  page,
}) => {
  for (const tema of TEMAS) {
    await abrir(page, "/", tema);
    const medido = await page.evaluate(`(() => {
      ${MEDIDAS}
      const raiz = rgba(getComputedStyle(document.documentElement).backgroundColor) || [0,0,0,1];
      const fundo = [raiz[0], raiz[1], raiz[2]];
      const estilo = getComputedStyle(document.documentElement);
      const hex = (nome) => estilo.getPropertyValue(nome).trim();
      // o CSS servido vem minificado: #ffffff vira #fff
      const paraRgb = (v) => {
        let n = v.trim().replace('#', '');
        if (n.length === 3) n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2];
        return [parseInt(n.slice(0,2),16), parseInt(n.slice(2,4),16), parseInt(n.slice(4,6),16)];
      };
      const card = paraRgb(hex('--card'));
      const borda = paraRgb(hex('--border'));
      const campo = paraRgb(hex('--input'));
      return {
        cardSobreFundo: razao(card, fundo),
        bordaSobreCard: razao(borda, card),
        campoSobreCard: razao(campo, card),
        campoSobreFundo: razao(campo, fundo),
      };
    })()`);
    const m = medido as Record<string, number>;
    expect(m.cardSobreFundo, `card/fundo (${tema})`).toBeGreaterThanOrEqual(1.3);
    expect(m.bordaSobreCard, `borda/card (${tema})`).toBeGreaterThanOrEqual(1.5);
    expect(m.campoSobreCard, `campo/card (${tema})`).toBeGreaterThanOrEqual(3);
    expect(m.campoSobreFundo, `campo/fundo (${tema})`).toBeGreaterThanOrEqual(3);
  }
});

test("todo <input> da tela desenha borda com 3:1 contra o que o cerca", async ({
  page,
}) => {
  for (const tema of TEMAS) {
    for (const rota of ["/corpo", "/mais/contas"]) {
      await abrir(page, rota, tema);
      const fracos = await page.evaluate(`(() => {
        ${MEDIDAS}
        return [...document.querySelectorAll('main input:not([type=range]):not(.sr-only)')]
          .map((el) => {
            const e = getComputedStyle(el);
            if (e.borderTopStyle === 'none' || Number.parseFloat(e.borderTopWidth) === 0) return null;
            const cor = rgba(e.borderTopColor);
            if (!cor) return null;
            const fundo = fundoDe(el.parentElement || el);
            const r = razao(sobrepor(cor, fundo), fundo);
            return r + 0.01 < 3 ? { alvo: el.getAttribute('aria-label') || el.type, r: Math.round(r * 100) / 100 } : null;
          })
          .filter(Boolean);
      })()`);
      expect(fracos, `${rota} (${tema}): borda de campo fraca`).toEqual([]);
    }
  }
});

// =====================================================================
//  item 4 — a placa das ilustrações não ofusca no escuro
// =====================================================================

test("no tema escuro nenhuma caixa de ilustração passa de 60 % de luz", async ({
  page,
}) => {
  for (const rota of ["/", "/exercicios/supino-reto-com-barra"]) {
    await abrir(page, rota, "dark");
    const claras = await page.evaluate(`(() => {
      ${MEDIDAS}
      return [...document.querySelectorAll('main *')]
        .filter((el) => {
          const f = getComputedStyle(el).backgroundColor;
          const c = rgba(f);
          const r = el.getBoundingClientRect();
          return c && c[3] > 0.5 && r.width >= 24 && r.height >= 24;
        })
        .map((el) => {
          const c = rgba(getComputedStyle(el).backgroundColor);
          return { alvo: el.className.toString().slice(0, 40), luz: Math.round(lum([c[0], c[1], c[2]]) * 100) };
        })
        .filter((x) => x.luz > 60);
    })()`);
    expect(claras, `${rota}: superfície ofuscante no escuro`).toEqual([]);
  }
});

// =====================================================================
//  item 5 — elevação do que flutua
// =====================================================================

test("o FAB Ajustar tem contorno visível nos dois temas", async ({ page }) => {
  for (const tema of TEMAS) {
    await abrir(page, "/", tema);
    const fab = page.getByRole("button", { name: "Ajustar" });
    await expect(fab).toBeVisible();
    const sombra = await fab.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(sombra, `sombra do FAB (${tema})`).not.toBe("none");
    expect(sombra.trim(), `sombra do FAB (${tema})`).not.toBe("");
    // a sombra não pode ser só transparência
    expect(sombra, `sombra do FAB (${tema})`).not.toMatch(/rgba\(0, 0, 0, 0\)/);
  }
});

// =====================================================================
//  item 6 — nada de texto abaixo de 10 px
// =====================================================================

test("nenhum texto visível fica abaixo de 10 px", async ({ page }) => {
  const problemas: string[] = [];
  for (const rota of ["/", "/calendario", "/relatorio", "/exercicios", "/mais"]) {
    await abrir(page, rota, "dark");
    const pequenos = await page.evaluate(() => {
      const ruins: { alvo: string; px: number }[] = [];
      const andarilho = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let no: Node | null;
      while ((no = andarilho.nextNode())) {
        if (!(no.textContent ?? "").trim()) continue;
        const el = no.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const px = Number.parseFloat(getComputedStyle(el).fontSize);
        if (px < 10) {
          ruins.push({ alvo: `${el.tagName} "${(no.textContent ?? "").trim().slice(0, 20)}"`, px });
        }
      }
      return ruins;
    });
    for (const p of pequenos) problemas.push(`${rota}: ${p.alvo} — ${p.px}px`);
  }
  expect(problemas, "texto abaixo de 10 px").toEqual([]);
});

// =====================================================================
//  item 7 — anel de foco em link de card e de lista
// =====================================================================

test("o link de um card e a aba de baixo desenham anel de foco", async ({ page }) => {
  for (const tema of TEMAS) {
    await abrir(page, "/exercicios", tema);
    const link = page.locator("main a[href^='/exercicios/']").first();
    /*
      Foco pelo TECLADO, não por `focus()`: `:focus-visible` depende da
      modalidade da última interação, e um foco programático pode não
      contar. O Shift+Tab sai e o Tab volta — agora é teclado de verdade.
    */
    await link.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const anel = await link.evaluate((el) => {
      const e = getComputedStyle(el);
      return {
        largura: Number.parseFloat(e.outlineWidth),
        estilo: e.outlineStyle,
        cor: e.outlineColor,
      };
    });
    expect(anel.estilo, `anel do card (${tema})`).not.toBe("none");
    expect(anel.largura, `anel do card (${tema})`).toBeGreaterThanOrEqual(2);

    const aba = page.getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link")
      .first();
    await aba.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const anelDaAba = await aba.evaluate((el) => {
      const e = getComputedStyle(el);
      return Number.parseFloat(e.outlineWidth) * (e.outlineStyle === "none" ? 0 : 1);
    });
    expect(anelDaAba, `anel da aba (${tema})`).toBeGreaterThanOrEqual(2);
  }
});

// =====================================================================
//  item 8 — a aba acesa tem forma, não só cor
// =====================================================================

test("a aba acesa mostra barra e rótulo em semibold", async ({ page }) => {
  await abrir(page, "/", "dark");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  const acesa = nav.locator("a[aria-current=page]");
  await expect(acesa).toHaveCount(1);
  await expect(acesa.locator("[data-aba-ativa=barra]")).toHaveCount(1);
  const peso = await acesa.evaluate((el) => getComputedStyle(el).fontWeight);
  expect(Number(peso)).toBeGreaterThanOrEqual(600);

  const apagada = nav.locator("a:not([aria-current=page])").first();
  await expect(apagada.locator("[data-aba-ativa=barra]")).toHaveCount(0);
});

// =====================================================================
//  item 9 — o estado vazio tem ícone, frase e saída
// =====================================================================

test("o catálogo sem resultado oferece limpar os filtros", async ({ page }) => {
  await abrir(page, "/exercicios", "dark");
  await page
    .getByRole("searchbox", { name: "Buscar exercício pelo nome" })
    .fill("zzzzzz");
  const vazio = page.locator("[data-slot=vazio]");
  await expect(vazio).toBeVisible();
  await expect(vazio).toContainText("Nenhum exercício com esses filtros");
  await vazio.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.locator("[data-slot=vazio]")).toHaveCount(0);
  await expect(page.locator("main a[href^='/exercicios/']").first()).toBeVisible();
});

// =====================================================================
//  itens 11 e 12 — texto cortado legível e o voltar de Mais
// =====================================================================

test("o texto cortado em duas linhas continua inteiro no title", async ({ page }) => {
  await abrir(page, "/exercicios", "dark");
  const link = page.locator("main a[href^='/exercicios/']").first();
  const titulo = (await link.getAttribute("title")) ?? "";
  const cortado = (await link.locator(".line-clamp-2").first().innerText()).trim();
  expect(titulo).toContain("·");
  // o que a tela corta cabe inteiro no title do próprio clicável
  for (const parte of cortado.split(" · ")) {
    expect(titulo).toContain(parte.trim());
  }

  // e os `title` que serviam só de tooltip saíram
  await abrir(page, "/calendario", "dark");
  const casas = page.locator("main [class*='text-rotulo']");
  expect(await casas.count()).toBeGreaterThan(0);
  const raios = page.locator("[data-raios]").first();
  if ((await raios.count()) > 0) {
    expect(await raios.getAttribute("title")).toBeNull();
  }
});

test("o voltar de Mais é um botão de 44 px", async ({ page }) => {
  await abrir(page, "/mais/preferencias", "dark");
  // dentro do cabeçalho: a barra de abas também tem um link "Mais"
  const voltar = page
    .locator("header")
    .getByRole("link", { name: "Mais", exact: true });
  await expect(voltar).toBeVisible();
  const caixa = await voltar.boundingBox();
  expect(Math.round(caixa?.height ?? 0)).toBeGreaterThanOrEqual(44);
});

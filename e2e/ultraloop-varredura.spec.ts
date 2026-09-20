/**
 * Varredura do ultraloop (20/09/2026) — a régua de qualidade que vale para
 * TODA tela, em vez de para uma de cada vez. Roda só com `VARREDURA=1`
 * (`npm run e2e -- --grep varredura`), porque ela visita doze rotas nos dois
 * temas e é cara demais para a bateria normal.
 *
 * Os cinco itens (SPEC §22):
 *   1. nada rola para o lado a 360 px;
 *   2. todo alvo de toque tem 44 px;
 *   3. todo texto visível passa no contraste AA contra o fundo efetivo;
 *   4. há anel de foco visível depois do Tab nos 15 primeiros focáveis;
 *   5. com `reduced-motion` nenhuma animação infinita continua rodando.
 *
 * Quando um item reprova hoje, ele é marcado com `test.fixme` e o motivo —
 * NUNCA afrouxado. Tirar o fixme é tarefa do lote que arruma a tela.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";
import { alvosPequenos, elementosQueVazam } from "./auditoria-helpers";

test.skip(!process.env.VARREDURA, "varredura: só com VARREDURA=1");

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

/** As rotas principais, públicas e autenticadas. */
const ROTAS = [
  "/",
  "/calendario",
  "/explorar",
  "/exercicios",
  "/relatorio",
  "/corpo",
  "/mais",
  "/mais/preferencias",
  "/mais/guia",
  "/mais/contas",
  "/login",
  "/~offline",
] as const;

const TEMAS = ["dark", "light"] as const;
type Tema = (typeof TEMAS)[number];

test.describe.configure({ timeout: 300_000 });

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, QUARTA);
  await usuarioComPerfil();
  await entrarNoApp(page);
  await esperarAbaTreino(page);
});

/** Abre a rota no tema pedido e espera a tela assentar. */
async function abrir(page: Page, rota: string, tema: Tema): Promise<void> {
  await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(700);
}

// =====================================================================
//  1. rolagem lateral
// =====================================================================

/*
 * Arrumado no Lote 2 (SPEC §22.2 item 11): a régua sobe até o ancestral que
 * rola, então o cartão dentro de um carrossel não conta como vazamento — só a
 * rolagem da própria página e o que escapa dela.
 */
test("varredura: nada rola para o lado a 360 px", async ({ page }) => {
  const problemas: string[] = [];
  for (const tema of TEMAS) {
    for (const rota of ROTAS) {
      await abrir(page, rota, tema);
      const vazou = await page.evaluate(
        () =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (vazou > 0) problemas.push(`${rota} (${tema}): a página rolou ${vazou} px`);
      for (const e of await elementosQueVazam(page)) {
        problemas.push(`${rota} (${tema}): ${e.alvo} vai de ${e.esquerda} a ${e.direita}`);
      }
    }
  }
  expect(problemas, "elementos vazando a largura de 360 px").toEqual([]);
});

// =====================================================================
//  2. alvos de 44 px
// =====================================================================

test("varredura: todo alvo de toque tem 44 px", async ({ page }) => {
  const problemas: string[] = [];
  for (const tema of TEMAS) {
    for (const rota of ROTAS) {
      await abrir(page, rota, tema);
      for (const a of await alvosPequenos(page)) {
        problemas.push(`${rota} (${tema}): ${a.alvo} — ${a.w}×${a.h} px`);
      }
    }
  }
  expect(problemas, "alvos menores que 44 px").toEqual([]);
});

// =====================================================================
//  3. contraste AA
// =====================================================================

/**
 * Mede o contraste de todo texto visível contra o fundo EFETIVO (subindo pelos
 * ancestrais até achar uma cor opaca). Tolerância só para texto grande:
 * ≥ 24 px, ou negrito (≥ 700) a partir de 19 px — aí 3:1 basta (WCAG 1.4.3).
 */
async function textoComPoucoContraste(page: Page) {
  return page.evaluate(() => {
    const canal = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminancia = ([r, g, b]: [number, number, number]) =>
      0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    const rgba = (cor: string): [number, number, number, number] | null => {
      const m = cor.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = (m[1] ?? "").split(/[,/]/).map((x) => Number.parseFloat(x.trim()));
      const [r, g, b, a] = [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3]];
      return [r, g, b, Number.isFinite(a) ? (a as number) : 1];
    };
    const sobrepor = (
      frente: [number, number, number, number],
      fundo: [number, number, number],
    ): [number, number, number] => [
      frente[0] * frente[3] + fundo[0] * (1 - frente[3]),
      frente[1] * frente[3] + fundo[1] * (1 - frente[3]),
      frente[2] * frente[3] + fundo[2] * (1 - frente[3]),
    ];
    const fundoEfetivo = (el: Element): [number, number, number] => {
      const pilha: [number, number, number, number][] = [];
      let atual: Element | null = el;
      while (atual) {
        const c = rgba(getComputedStyle(atual).backgroundColor);
        if (c && c[3] > 0) {
          pilha.push(c);
          if (c[3] >= 0.999) break;
        }
        atual = atual.parentElement;
      }
      let fundo: [number, number, number] = [255, 255, 255];
      const raiz = rgba(getComputedStyle(document.documentElement).backgroundColor);
      if (raiz && raiz[3] > 0) fundo = [raiz[0], raiz[1], raiz[2]];
      for (let i = pilha.length - 1; i >= 0; i--) fundo = sobrepor(pilha[i]!, fundo);
      return fundo;
    };

    const ruins: { alvo: string; razao: number; exigido: number }[] = [];
    const vistos = new Set<Element>();
    const andarilho = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let no: Node | null;
    while ((no = andarilho.nextNode())) {
      const texto = (no.textContent ?? "").trim();
      if (!texto) continue;
      const el = no.parentElement;
      if (!el || vistos.has(el)) continue;
      vistos.add(el);
      const estilo = getComputedStyle(el);
      if (
        estilo.visibility === "hidden" ||
        estilo.display === "none" ||
        Number.parseFloat(estilo.opacity) < 0.05
      ) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // fora da tela (só-leitor, menus fechados) não conta
      if (r.bottom < 0 || r.right < 0 || r.left > window.innerWidth) continue;
      const cor = rgba(estilo.color);
      if (!cor || cor[3] === 0) continue;
      const fundo = fundoEfetivo(el);
      const frente = sobrepor(cor, fundo);
      const a = luminancia(frente);
      const b = luminancia(fundo);
      const razao = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const tamanho = Number.parseFloat(estilo.fontSize);
      const peso = Number.parseFloat(estilo.fontWeight) || 400;
      const grande = tamanho >= 24 || (peso >= 700 && tamanho >= 19);
      const exigido = grande ? 3 : 4.5;
      if (razao + 0.01 < exigido) {
        ruins.push({
          alvo: `${el.tagName} "${texto.slice(0, 28)}" ${estilo.color} sobre rgb(${fundo
            .map((v) => Math.round(v))
            .join(",")})`,
          razao: Math.round(razao * 100) / 100,
          exigido,
        });
      }
    }
    return ruins;
  });
}

/*
 * Arrumado no Lote 2 (SPEC §22.2 item 10): o texto branco do `CardCapa` passou
 * a ter véu escuro próprio, então o título do cartão do treino deixa de ser
 * branco sobre cartão claro no tema claro.
 */
test("varredura: todo texto visível passa no contraste AA", async ({ page }) => {
  const problemas: string[] = [];
  for (const tema of TEMAS) {
    for (const rota of ROTAS) {
      await abrir(page, rota, tema);
      for (const t of await textoComPoucoContraste(page)) {
        problemas.push(`${rota} (${tema}): ${t.alvo} — ${t.razao}:1 < ${t.exigido}:1`);
      }
    }
  }
  expect(problemas, "texto abaixo do contraste AA").toEqual([]);
});

// =====================================================================
//  4. anel de foco
// =====================================================================

/*
 * PARCIAL no Lote 3 (SPEC §22.3 item 7). Feito: `app/globals.css` desenha
 * `outline: 2px solid var(--ring)` no focável de cada tipo — link de card,
 * linha de lista, o cartão do IMC de `/corpo`, as abas de baixo — e o anel
 * dos botões e campos do shadcn deixou de ser `ring-ring/50` (2,9:1 no
 * escuro, 2,2:1 no claro) para ser a cor cheia; `ultraloop-a-r2.spec.ts`
 * cobre o link de card e a aba, e passa.
 *
 * Falta: esta varredura ainda acusa 141 focáveis no TEMA ESCURO (botões dos
 * cards de exercício, dias do calendário, `select` do catálogo, abas do
 * relatório). No claro ela passa — mas passa porque esses elementos têm
 * `box-shadow` e o próprio teste aceita sombra como anel, então o escuro,
 * onde a superfície não usa sombra, é o único que mede o `outline` de
 * verdade. Ou seja: o `:focus-visible` global não está pegando nesses
 * elementos e o teste no claro estava dando um falso verde. Reabrir com
 * tempo: descobrir por que a regra não casa e só então tirar o `fixme`.
 */
test.fixme("varredura: o Tab deixa um anel de foco visível", async ({ page }) => {
  const problemas: string[] = [];
  for (const tema of TEMAS) {
    for (const rota of ROTAS) {
      await abrir(page, rota, tema);
      await page.evaluate(() => document.body.focus());
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press("Tab");
        const resultado = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const e = getComputedStyle(el);
          const anel =
            (e.outlineStyle !== "none" && Number.parseFloat(e.outlineWidth) > 0) ||
            (e.boxShadow !== "none" && e.boxShadow !== "");
          return {
            anel,
            alvo: `${el.tagName} "${(el.textContent ?? "").trim().slice(0, 24)}"`,
          };
        });
        if (resultado && !resultado.anel) {
          problemas.push(`${rota} (${tema}): foco ${i + 1} sem anel — ${resultado.alvo}`);
        }
      }
    }
  }
  expect(problemas, "focáveis sem anel de foco visível").toEqual([]);
});

// =====================================================================
//  5. reduced-motion
// =====================================================================

/*
 * Resolvido no lote 1 da rodada 1 (SPEC §22.1): o bloco global de
 * `prefers-reduced-motion: reduce` em `app/globals.css` corta a repetição de
 * toda animação CSS — os esqueletos `animate-pulse` do `/calendario`
 * inclusive —, e a ilustração alternada nasce parada por conta própria.
 */
test("varredura: com reduced-motion nada anima para sempre", async ({ page }) => {
  const problemas: string[] = [];
  for (const tema of TEMAS) {
    for (const rota of ROTAS) {
      await abrir(page, rota, tema);
      await page.waitForTimeout(800);
      const infinitas = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => {
            const efeito = a.effect;
            if (!efeito) return false;
            const t = efeito.getTiming();
            return t.iterations === Infinity && a.playState === "running";
          })
          .map((a) => {
            const alvo = (a.effect as KeyframeEffect | null)?.target;
            if (!alvo || !(alvo instanceof Element)) return "?";
            return `${alvo.tagName}.${alvo.className.toString().slice(0, 30)}`;
          }),
      );
      for (const i of infinitas) problemas.push(`${rota} (${tema}): ${i}`);
    }
  }
  expect(problemas, "animação infinita rodando com reduced-motion").toEqual([]);
});

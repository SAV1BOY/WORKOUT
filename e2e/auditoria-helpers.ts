/**
 * Medidas de celular compartilhadas pelas auditorias (e2e/auditoria-m6.spec.ts
 * e e2e/ultraloop-varredura.spec.ts). Ficam fora de um `.spec.ts` para que a
 * varredura do ultraloop reaproveite a MESMA régua, sem copiar a lógica.
 */
import { expect, type Page } from "@playwright/test";

/**
 * O `body` esconde a rolagem lateral (`overflow-x: hidden` em globals.css),
 * então medir `scrollWidth` não prova nada: aqui se pergunta a cada elemento
 * visível onde ele termina.
 */
export async function nadaVazaALargura(page: Page): Promise<void> {
  const vazando = await elementosQueVazam(page);
  expect(vazando, "elemento vazando a largura de 360 px").toEqual([]);
}

export async function elementosQueVazam(page: Page) {
  return page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    /** Quem rola sozinho (tabela, gráfico, carrossel) pode ser mais largo. */
    const rolaSozinho = (el: Element) => {
      const e = getComputedStyle(el);
      return e.overflowX === "auto" || e.overflowX === "scroll";
    };
    /*
     * SPEC §22.2 item 11: o cartão dentro de um carrossel (faixa com
     * `overflow-x: auto`) passa dos 360 px de propósito — a rolagem é da faixa,
     * não da página. Antes a régua olhava só o `overflow-x` do PRÓPRIO elemento
     * e contava os 96 cartões de `/` e `/explorar` como vazamento. Agora ela
     * sobe até `main`: quem tem um ancestral que rola está dentro da rolagem
     * intencional. A rolagem da PÁGINA continua tendo de ser zero (quem chama
     * mede `document.documentElement.scrollWidth`).
     */
    const dentroDeQuemRola = (el: Element) => {
      let atual: Element | null = el.parentElement;
      while (atual && atual !== document.documentElement) {
        if (rolaSozinho(atual)) return true;
        atual = atual.parentElement;
      }
      return false;
    };
    return [...document.querySelectorAll("main *")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const estilo = getComputedStyle(el);
        return {
          alvo: `${el.tagName}.${el.className.toString().slice(0, 40)}`,
          direita: Math.round(r.right),
          esquerda: Math.round(r.left),
          visivel:
            r.width > 0 &&
            r.height > 0 &&
            estilo.visibility !== "hidden" &&
            estilo.display !== "none" &&
            !rolaSozinho(el) &&
            !dentroDeQuemRola(el),
        };
      })
      .filter((e) => e.visivel && (e.direita > largura + 1 || e.esquerda < -1));
  });
}

/** Todo controle da tela, inclusive os interruptores, tem 44 px. */
export async function alvosDe44px(page: Page): Promise<void> {
  const pequenos = await alvosPequenos(page);
  expect(pequenos, "alvos menores que 44 px").toEqual([]);
}

export async function alvosPequenos(page: Page) {
  return page.evaluate(() => {
    const alvos = [
      ...document.querySelectorAll(
        "main .alvo, main button, main a, main select, main [role=switch], main input:not([type=range]):not(.sr-only)",
      ),
    ];
    return alvos
      .map((el) => {
        const r = el.getBoundingClientRect();
        // o interruptor é um pill pequeno com a área de toque no ::after
        const depois = getComputedStyle(el, "::after");
        const cresceY =
          depois.content !== "none"
            ? Math.abs(Number.parseFloat(depois.top || "0")) +
              Math.abs(Number.parseFloat(depois.bottom || "0"))
            : 0;
        const cresceX =
          depois.content !== "none"
            ? Math.abs(Number.parseFloat(depois.left || "0")) +
              Math.abs(Number.parseFloat(depois.right || "0"))
            : 0;
        return {
          alvo: `${el.tagName} ${(el.textContent ?? "").trim().slice(0, 24)}`,
          h: Math.round(r.height + (Number.isFinite(cresceY) ? cresceY : 0)),
          w: Math.round(r.width + (Number.isFinite(cresceX) ? cresceX : 0)),
          bruto: Math.round(r.height),
        };
      })
      .filter((a) => a.bruto > 0 && (a.h < 44 || a.w < 44));
  });
}

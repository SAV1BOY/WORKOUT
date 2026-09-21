/**
 * Ultraloop 20/09/2026 — faixa A, rodada 1, lote "player, offline e rótulos"
 * (SPEC §22.1). O que estes testes guardam é o que se VÊ: os controles do
 * player colados no rodapé, a `/~offline` com identidade e saída, e o
 * `prefers-reduced-motion` respeitado de verdade.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026: primeiro dia do programa, Treino A (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

/** Tem ilustração das duas posições (Everkinetic) e é do Treino A. */
const SUPINO = "supino-reto-com-barra";

const TEMAS = ["dark", "light"] as const;

test.beforeEach(async () => {
  await resetarMock();
});

/**
 * Quanto sobra de tela embaixo do ancestral fixo de um elemento, e se o toque
 * chega mesmo nele (nada por cima).
 */
async function rodapeDe(page: Page, rotulo: string) {
  return page.evaluate((nome) => {
    const alvo = [...document.querySelectorAll("button")].find(
      (b) =>
        b.getAttribute("aria-label") === nome ||
        (b.textContent ?? "").trim() === nome,
    );
    if (!alvo) return null;
    let fixo: HTMLElement | null = alvo as HTMLElement;
    while (fixo && getComputedStyle(fixo).position !== "fixed") {
      fixo = fixo.parentElement;
    }
    if (!fixo) return null;
    const caixa = fixo.getBoundingClientRect();
    const botao = alvo.getBoundingClientRect();
    const emCima = document.elementFromPoint(
      botao.left + botao.width / 2,
      botao.top + botao.height / 2,
    );
    return {
      sobraAbaixo: Math.round(window.innerHeight - caixa.bottom),
      alturaDoBotao: Math.round(botao.height),
      tocaNoBotao: emCima === alvo || alvo.contains(emCima),
    };
  }, rotulo);
}

test.describe("o player usa a tela inteira (SPEC §22.1)", () => {
  for (const tema of TEMAS) {
    test(`os controles ficam colados no rodapé, sem faixa morta (${tema})`, async ({
      page,
    }) => {
      await usuarioComPerfil();
      await page.emulateMedia({ colorScheme: tema });
      await fixarData(page, SEGUNDA);
      await entrarNoApp(page);
      await comecarOTreinoDoDia(page);
      await comecarNoPlayer(page);
      await expect(
        page.getByRole("button", { name: "Concluir série" }),
      ).toBeVisible();

      /*
       * A barra de abas devolve `null` no player: os 56 px que os controles
       * reservavam para ela eram faixa morta — e o ✓ ficava 56 px acima do
       * polegar, na tela onde isso mais custa.
       */
      const controles = await rodapeDe(page, "Concluir série");
      expect(controles, "não achei os controles do player").not.toBeNull();
      expect(controles?.sobraAbaixo, "faixa morta sob os controles").toBe(0);
      expect(controles?.alturaDoBotao ?? 0).toBeGreaterThanOrEqual(44);
      expect(controles?.tocaNoBotao, "o ✓ está coberto por algo").toBe(true);

      // a barra de abas não existe aqui: ninguém disputa o rodapé
      await expect(
        page.getByRole("navigation", { name: "Navegação principal" }),
      ).toHaveCount(0);
      await semRolagemHorizontal(page);

      // e a visão geral também vai até o fim da tela
      await page.getByRole("button", { name: "Visão geral do treino" }).click();
      await expect(
        page.getByRole("heading", { name: "Treino A", level: 1 }),
      ).toBeVisible();
      const geral = await rodapeDe(page, "Concluir");
      expect(geral, "não achei o rodapé da visão geral").not.toBeNull();
      expect(geral?.sobraAbaixo, "faixa morta sob a visão geral").toBe(0);
    });
  }

  test("no descanso, o 'Pular' fica acima da área segura do aparelho", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await page.getByRole("button", { name: "Concluir série" }).click();
    await expect(page.getByRole("timer", { name: "Descanso" })).toBeVisible();

    const pular = page.getByRole("button", { name: "Pular descanso" });
    const caixa = await pular.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    /* a tela de descanso reserva 2rem + a área segura embaixo do último botão */
    const sobra = 740 - ((caixa?.y ?? 0) + (caixa?.height ?? 0));
    expect(sobra, "o 'Pular' encostou no fim da tela").toBeGreaterThanOrEqual(24);
  });
});

test.describe("a página de offline (SPEC §22.1)", () => {
  for (const tema of TEMAS) {
    test(`diz o que houve e dá saída (${tema})`, async ({ page }) => {
      await usuarioComPerfil();
      await page.emulateMedia({ colorScheme: tema });
      await page.goto("/~offline");

      await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
      await expect(page.getByText(/sobe sozinho quando a rede voltar/)).toBeVisible();
      for (const nome of ["Tentar de novo", "Ir para o Treino"]) {
        const alvo = page.getByRole(nome === "Tentar de novo" ? "button" : "link", {
          name: nome,
        });
        await expect(alvo).toBeVisible();
        const caixa = await alvo.boundingBox();
        expect(caixa?.height ?? 0, `${nome} menor que 44 px`).toBeGreaterThanOrEqual(44);
      }
      await semRolagemHorizontal(page);

      // a saída funciona: com rede, "Ir para o Treino" volta para o app
      await entrarNoApp(page);
      await page.goto("/~offline");
      await page.getByRole("link", { name: "Ir para o Treino" }).click();
      await esperarAbaTreino(page);
    });
  }
});

test.describe("menos movimento (SPEC §22.1)", () => {
  test("a ilustração nasce parada com reduced-motion, e o toque manda", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.goto(`/exercicios/${SUPINO}`);

    const ilustracao = page.locator("[data-ilustracao]").first();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "pausada");
    const parada = await ilustracao.getAttribute("data-posicao");
    await page.waitForTimeout(2_000);
    expect(await ilustracao.getAttribute("data-posicao")).toBe(parada);

    // quem quiser ver o movimento continua podendo pedir
    await ilustracao.click();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "alternando");
    await expect
      .poll(async () => ilustracao.getAttribute("data-posicao"), { timeout: 5_000 })
      .not.toBe(parada);
  });

  test("nenhuma animação infinita continua rodando no player e nos esqueletos", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    for (const rota of ["/", "/calendario", "/relatorio"]) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);
      const infinitas = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => {
            const efeito = a.effect;
            return (
              !!efeito &&
              efeito.getTiming().iterations === Infinity &&
              a.playState === "running"
            );
          })
          .map((a) => {
            const alvo = (a.effect as KeyframeEffect | null)?.target;
            return alvo instanceof Element ? alvo.className.toString() : "?";
          }),
      );
      expect(infinitas, `animação infinita em ${rota}`).toEqual([]);
    }

    // e a contagem do player, que é JavaScript, continua andando
    await page.goto("/");
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await expect(page.getByRole("timer", { name: "Preparação" })).toBeVisible();
  });
});

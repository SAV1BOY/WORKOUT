/**
 * Auditoria do marco 6: o que os outros testes não provavam.
 *
 *  - a aba Treino **recarregada** sem rede (não só uma rota nova) e a navegação
 *    inferior andando offline, com a figura do treino vindo do cache (§8);
 *  - as cinco telas de `/mais` a 360 px medindo **elemento por elemento**
 *    (o `body` tem `overflow-x: hidden`, então o scrollWidth da página não
 *    denuncia quem vaza) e com os interruptores entrando na conta dos 44 px;
 *  - o limiar exato da Fase 2 (§5.1): o texto tem que contar as semanas do
 *    mesmo jeito que a regra que libera o botão;
 *  - um backup de versão futura recusado sem gravar nada (§9).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  inserirNoMock,
  irNaAba,
  lerDoMock,
  resetarMock,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Segunda, 14/09/2026 — o primeiro dia do programa (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, SEGUNDA);
});

/* ------------------------------------------------------------- offline */

test.describe("offline de verdade (SPEC §8)", () => {
  test("a aba Treino recarrega sem rede, a nav anda e a figura vem do cache", async ({
    page,
    context,
  }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await esperarServiceWorker(page);

    // o app precisa ter visto as telas uma vez (é o que a §8 promete)
    await page.goto("/treinar");
    await expect(page.getByRole("heading", { name: "Treinar" })).toBeVisible();
    await irNaAba(page, "Explorar");
    await expect(page.getByRole("heading", { name: "Explorar" })).toBeVisible();
    await irNaAba(page, "Mais");
    await expect(page.getByRole("heading", { name: "Mais" })).toBeVisible();
    await irNaAba(page, "Treino");
    await esperarAbaTreino(page);
    // tempo para o aquecimento das figuras da fase (lib/precache-do-programa)
    await page.waitForTimeout(2_000);

    await context.setOffline(true);
    try {
      await page.reload();
      await esperarAbaTreino(page);
      // e a prévia do treino continua lá, com a carga da última sincronização
      await expect(page.getByText(/kg/).first()).toBeVisible();

      await irNaAba(page, "Mais");
      await expect(page.getByRole("heading", { name: "Mais" })).toBeVisible();
      await irNaAba(page, "Explorar");
      await expect(page.getByRole("heading", { name: "Explorar" })).toBeVisible();

      // a figura do primeiro exercício da fase abre sem rede
      const daFase = "/figuras/agachamento-livre.svg";
      const veio = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return r.ok && (await r.text()).includes("<svg");
      }, daFase);
      expect(veio, "a figura do programa não estava no cache").toBe(true);
    } finally {
      await context.setOffline(false);
    }
  });
});

/* --------------------------------------------------------- 360 px */

const ROTAS_MAIS = [
  "/mais",
  "/mais/perfil",
  "/mais/equipamento",
  "/mais/preferencias",
  "/mais/backup",
];

/**
 * O `body` esconde a rolagem lateral (`overflow-x: hidden` em globals.css),
 * então medir `scrollWidth` não prova nada: aqui se pergunta a cada elemento
 * visível onde ele termina.
 */
async function nadaVazaALargura(page: Page): Promise<void> {
  const vazando = await page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
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
            // quem rola sozinho (tabela, gráfico) pode ser mais largo
            estilo.overflowX !== "auto" &&
            estilo.overflowX !== "scroll",
        };
      })
      .filter((e) => e.visivel && (e.direita > largura + 1 || e.esquerda < -1));
  });
  expect(vazando, "elemento vazando a largura de 360 px").toEqual([]);
}

/** Todo controle da tela, inclusive os interruptores, tem 44 px. */
async function alvosDe44px(page: Page): Promise<void> {
  const pequenos = await page.evaluate(() => {
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
  expect(pequenos, "alvos menores que 44 px").toEqual([]);
}

test.describe("celular — as telas de /mais a 360 px", () => {
  for (const rota of ROTAS_MAIS) {
    test(`${rota}: nada vaza para o lado e todo alvo tem 44 px`, async ({
      page,
    }) => {
      await usuarioComPerfil();
      await entrarNoApp(page);
      await page.goto(rota);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(600);

      await nadaVazaALargura(page);
      await alvosDe44px(page);
    });
  }

  test("o interruptor do descanso liga pelo polegar, não só pelo pill", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/preferencias");

    const som = page.getByRole("switch", { name: "Som no fim do descanso" });
    await expect(som).toBeChecked();

    // um toque 20 px acima do centro: dentro dos 44 px, fora do pill de 18 px
    // (a tela cresceu com os ajustes do player, §14.4: rolar até ele primeiro)
    await som.scrollIntoViewIfNeeded();
    const caixa = await som.boundingBox();
    expect(caixa).not.toBeNull();
    await page.mouse.click(
      caixa!.x + caixa!.width / 2,
      caixa!.y + caixa!.height / 2 - 20,
    );
    await expect(som).not.toBeChecked();
  });
});

/* ---------------------------------------------------- Fase 2 (§5.1) */

test.describe("Fase 2 — o limiar contado do mesmo jeito (SPEC §5.1)", () => {
  /** 30 sessões concluídas, o segundo gatilho. */
  async function com30Sessoes(sessao: SessaoMock): Promise<void> {
    await inserirNoMock(
      sessao,
      "sessions",
      Array.from({ length: 30 }, (_, i) => ({
        id: `77777777-7777-4777-8777-${String(i).padStart(12, "0")}`,
        data: "2026-07-01",
        workout_id: i % 2 === 0 ? "A1" : "B1",
        fase: "fase1",
        status: "concluida",
        concluida_em: "2026-07-01T13:00:00.000Z",
      })),
    );
  }

  test("com 11 semanas o texto diz 11 — e não oferece a Fase 2", async ({
    page,
  }) => {
    // 29/06 → 14/09 são 11 semanas cheias de Fase 1
    const sessao = await usuarioComPerfil({ fase_desde: "2026-06-29" });
    await com30Sessoes(sessao);
    await entrarNoApp(page);
    await page.goto("/mais/perfil");

    await expect(
      page.getByRole("button", { name: "Passar para a Fase 2" }),
    ).toHaveCount(0);
    await expect(page.getByText(/você tem 11 e 30/)).toBeVisible();
  });

  test("com 12 semanas cheias a Fase 2 é oferecida", async ({ page }) => {
    // 22/06 → 14/09 são 12 semanas cheias
    const sessao = await usuarioComPerfil({ fase_desde: "2026-06-22" });
    await com30Sessoes(sessao);
    await entrarNoApp(page);
    await page.goto("/mais/perfil");

    await expect(page.getByText(/12 semanas de Fase 1 e 30 treinos/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Passar para a Fase 2" }),
    ).toBeVisible();
  });
});

/* -------------------------------------------------------- backup (§9) */

test.describe("/mais/backup — o caso de erro", () => {
  test("um backup de versão futura é recusado e nada é gravado", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/backup");

    await page.setInputFiles("#arquivo-backup", {
      name: "treino-terraco-2027-01-01.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          app: "treino-terraco",
          versao: 99,
          exportado_em: "2027-01-01T10:00:00.000Z",
          user_id: null,
          tabelas: {
            body_weights: [
              {
                id: "88888888-8888-4888-8888-000000000001",
                data: "2027-01-01",
                peso_kg: 80,
              },
            ],
          },
        }),
      ),
    });

    await expect(page.getByText(/versão 99/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar tudo" })).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(await lerDoMock(sessao, "body_weights")).toHaveLength(0);
  });
});

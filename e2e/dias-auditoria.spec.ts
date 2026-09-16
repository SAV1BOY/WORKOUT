/**
 * Auditoria do marco Dias (SPEC §17): os casos que a `dias.spec.ts` não cobre —
 * uma combinação de dias que não é a do programa, a Fase 2 (seis dias e quatro
 * dias fora dos dias do programa), a escolha que sobrevive a um recarregamento,
 * a escolha feita sem rede (que sobe pela fila do §8) e a alternância da Fase 1
 * ancorada em `ultimo_treino` sobre os dias escolhidos.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarRelogio,
  inserirNoMock,
  irNaAba,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Segunda-feira 14/09/2026 — semana 1 da Fase 1 (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
/** Quinta-feira 17/09/2026 — depois de treinar numa quarta que ninguém escolheu. */
const QUINTA = "2026-09-17T08:00:00-03:00";

const DIAS_DA_SEMANA = [
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
];

const CAPTURAS =
  "/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/capturas/auditoria-dias";

function chip(page: Page, dia: string) {
  return page.locator(`[data-dia-chip="${dia}"]`);
}

/** As siglas da faixa da semana da aba Treino, de segunda a domingo. */
async function siglasDaFaixa(page: Page): Promise<string[]> {
  const siglas: string[] = [];
  for (const data of DIAS_DA_SEMANA) {
    const casa = page.locator(`[data-dia="${data}"]`).first();
    await expect(casa).toBeVisible();
    siglas.push(((await casa.innerText()) ?? "").split("\n").pop()?.trim() ?? "");
  }
  return siglas;
}

/** Os rótulos da grade do calendário, um por dia da semana. */
async function rotulosDoCalendario(page: Page): Promise<string[]> {
  const itens = page.getByRole("list", { name: "Semana" }).getByRole("listitem");
  await expect(itens).toHaveCount(7);
  return (await itens.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
}

async function abrirPreferencias(page: Page): Promise<void> {
  await irNaAba(page, "Mais");
  await page.getByRole("link", { name: "Preferências" }).click();
  await expect(page.getByRole("group", { name: "Dias de treino" })).toBeVisible({
    timeout: 15_000,
  });
}

async function diasGravados(sessao: SessaoMock): Promise<unknown> {
  const linhas = await lerDoMock<{ prefs?: { dias_de_treino?: unknown } }>(
    sessao,
    "profiles",
    "select=prefs",
  );
  return linhas[0]?.prefs?.dias_de_treino;
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("dias fora do programa (SPEC §17.2 item 1)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`seg, ter, qui, sex e sáb: força seg/qui/sáb e cardio ter/sex — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioComPerfil({
        prefs: { dias_de_treino: ["seg", "ter", "qui", "sex", "sab"] },
      });
      await page.emulateMedia({ colorScheme: tema });
      await fixarRelogio(page, SEGUNDA);
      await entrarNoApp(page);
      await esperarAbaTreino(page);

      /*
       * Sem a quarta, a folga da Fase 1 (48 h, §17.2 item 1) só cabe em
       * seg/qui/sáb — e o cardio fica na terça e na sexta, nesta ordem
       * ("corrida" e depois "corrida ou corda", §17.2 item 3).
       */
      expect(await siglasDaFaixa(page)).toEqual([
        "A",
        "Corr.",
        "Desc.",
        "B",
        "Corr.",
        "A",
        "Desc.",
      ]);
      await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
        "aria-valuemax",
        "5",
      );
      await semRolagemHorizontal(page);

      await page.goto("/calendario");
      const rotulos = await rotulosDoCalendario(page);
      expect(rotulos[0]).toContain("Treino A");
      expect(rotulos[1]).toContain("Corrida");
      // a quarta não foi escolhida: descanso seco, sem a nota da barra fixa
      expect(rotulos[2]).toContain("Descanso");
      expect(rotulos[2]).not.toContain("barra fixa");
      expect(rotulos[3]).toContain("Treino B");
      expect(rotulos[4]).toContain("Corrida");
      expect(rotulos[5]).toContain("Treino A");
      expect(rotulos[6]).toContain("Descanso");
      await semRolagemHorizontal(page);

      await page.screenshot({
        path: `${CAPTURAS}/01-calendario-seg-ter-qui-sex-sab${tema === "light" ? "-claro" : ""}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("Fase 2 (SPEC §17.4 item 6)", () => {
  test("seis dias: SA, IA, SB, IB e as duas corridas", async ({ page }) => {
    await usuarioComPerfil({
      fase_atual: "fase2",
      ultimo_treino: null,
      prefs: { dias_de_treino: ["seg", "ter", "qua", "qui", "sex", "sab"] },
    });
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    expect(await siglasDaFaixa(page)).toEqual([
      "SA",
      "IA",
      "Corr.",
      "SB",
      "IB",
      "Longa",
      "Desc.",
    ]);
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuemax",
      "6",
    );
    await semRolagemHorizontal(page);
  });

  test("quinta a domingo: os quatro treinos na ordem, sem cardio, meta 4", async ({
    page,
  }) => {
    await usuarioComPerfil({
      fase_atual: "fase2",
      ultimo_treino: null,
      prefs: { dias_de_treino: ["qui", "sex", "sab", "dom"] },
    });
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    expect(await siglasDaFaixa(page)).toEqual([
      "Desc.",
      "Desc.",
      "Desc.",
      "SA",
      "IA",
      "SB",
      "IB",
    ]);
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuemax",
      "4",
    );

    await page.goto("/calendario");
    const rotulos = await rotulosDoCalendario(page);
    expect(rotulos[3]).toContain("Superior A");
    expect(rotulos[6]).toContain("Inferior B");
    expect(rotulos.join(" ")).not.toContain("Corrida");
    await semRolagemHorizontal(page);

    await page.screenshot({ path: `${CAPTURAS}/02-fase2-qui-a-dom.png`, fullPage: true });
  });
});

test.describe("a escolha dura (SPEC §17.1)", () => {
  test("recarregar a página mantém os chips e o resumo", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await abrirPreferencias(page);

    await chip(page, "dom").click();
    await expect(chip(page, "dom")).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => diasGravados(sessao), { timeout: 15_000 })
      .toEqual(["seg", "ter", "qua", "sex", "sab", "dom"]);

    await page.reload();
    await expect(page.getByRole("group", { name: "Dias de treino" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(chip(page, "dom")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "qui")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-resumo-dias]")).toContainText("1 livre");
  });

  test("sem rede a escolha vai para a fila e sobe depois (SPEC §8)", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await abrirPreferencias(page);

    // a gravação do perfil é cortada antes do Supabase: o app continua de pé
    await page.route("**/rest/v1/profiles**", (rota) => rota.abort());
    await chip(page, "qui").click();
    await expect(chip(page, "qui")).toHaveAttribute("aria-pressed", "true");

    await page.goto("/mais");
    const linha = page.getByLabel("Sincronização");
    await expect(linha.getByText(/item esperando|itens esperando/)).toBeVisible({
      timeout: 15_000,
    });

    await page.unroute("**/rest/v1/profiles**");
    const botao = linha.getByRole("button", { name: "Tentar agora" });
    if (await botao.isVisible()) await botao.click();
    await expect(linha.getByText("Tudo sincronizado")).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => diasGravados(sessao), { timeout: 15_000 })
      .toEqual(["seg", "ter", "qua", "qui", "sex", "sab"]);
  });
});

test.describe("o próximo treino sobre os dias escolhidos (SPEC §17.3)", () => {
  test("a alternância continua ancorada em ultimo_treino", async ({ page }) => {
    await usuarioComPerfil({
      ultimo_treino: "A1",
      prefs: { dias_de_treino: ["seg", "ter", "qui", "sex", "sab"] },
    });
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    const hoje = page.getByRole("region", { name: "Hoje" });
    await expect(hoje.getByRole("heading", { name: "Treino B" })).toBeVisible();
    // a segunda é dia de força escolhido: dá para começar dali mesmo
    await expect(page.getByRole("button", { name: "Começar treino" })).toBeVisible();
    expect(await siglasDaFaixa(page)).toEqual([
      "B",
      "Corr.",
      "Desc.",
      "A",
      "Corr.",
      "B",
      "Desc.",
    ]);
  });

  test("treinar num dia não escolhido conta como o próximo da alternância", async ({
    page,
  }) => {
    /*
     * Quarta-feira não está nos dias escolhidos, mas ele treinou o A1 lá
     * (SPEC §5.3, "Treinar mesmo assim"): a quinta, que é dia de força, passa
     * a ser o Treino B, o sábado volta ao A e a sessão entra na meta da semana.
     */
    const sessao = await usuarioComPerfil({
      ultimo_treino: "A1",
      prefs: { dias_de_treino: ["seg", "ter", "qui", "sex", "sab"] },
    });
    await inserirNoMock(sessao, "sessions", [
      {
        data: "2026-09-16",
        workout_id: "A1",
        fase: "fase1",
        status: "concluida",
        concluida_em: "2026-09-16T11:00:00-03:00",
      },
    ]);
    await fixarRelogio(page, QUINTA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    const hoje = page.getByRole("region", { name: "Hoje" });
    await expect(hoje.getByRole("heading", { name: "Treino B" })).toBeVisible();
    // a quinta, dia de força escolhido, é o Treino B; a sexta volta ao A
    const siglas = await siglasDaFaixa(page);
    expect(siglas[3]).toBe("B");
    expect(siglas[5]).toBe("A");
    /*
     * SPEC §16.2 item 7: a quarta não era dia escolhido, mas ele treinou lá —
     * a faixa mostra "A" e a marca de feito, não "Desc." sem marca nenhuma.
     */
    expect(siglas[2]).toBe("A");
    await expect(page.locator('[data-dia="2026-09-16"]').first()).toHaveAttribute(
      "data-marca",
      "feito",
    );
    // e a sessão da quarta conta na meta da semana personalizada (§17.3)
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuemax",
      "5",
    );
    await semRolagemHorizontal(page);

    await page.screenshot({ path: `${CAPTURAS}/03-quinta-treino-b.png`, fullPage: true });
  });
});

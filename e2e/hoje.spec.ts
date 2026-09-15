import { expect, test, type Page } from "@playwright/test";
import {
  fixarData,
  fixarRelogio,
  inserirNoMock,
  lerDoMock,
  entrarNoApp,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** 14/09/2026 é a segunda-feira que abre o programa (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
const TERCA = "2026-09-15T08:00:00-03:00";
const QUINTA = "2026-09-17T08:00:00-03:00";

async function abrirHoje(page: Page, quando: string) {
  await fixarRelogio(page, quando);
  await entrarNoApp(page);
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("Hoje — dia de força (SPEC §3.1 e §10.2)", () => {
  test("a segunda mostra o Treino A com as cargas iniciais", async ({ page }) => {
    await usuarioComPerfil();
    await abrirHoje(page, SEGUNDA);

    await expect(page.getByText("Treino A · 6 exercícios · 44 min")).toBeVisible();
    await expect(page.getByText("agachamento no centro")).toBeVisible();

    // SPEC §10.2: 7,5 kg na barra, 1,5 kg por halter
    await expect(page.getByText("Hoje: 7,5 kg na barra").first()).toBeVisible();
    await expect(page.getByText("Hoje: 1,5 kg por halter")).toBeVisible();
    // peso corporal não vira "0 kg na mochila"
    await expect(page.getByText("Hoje: peso do corpo")).toBeVisible();

    const comecar = page.getByRole("link", { name: "Começar treino" });
    await expect(comecar).toBeVisible();
    expect((await comecar.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await semRolagemHorizontal(page);
  });

  test("os seis exercícios do treino aparecem na ordem do programa", async ({ page }) => {
    await usuarioComPerfil();
    await abrirHoje(page, SEGUNDA);

    const itens = page.getByRole("list", { name: "Exercícios de hoje" }).getByRole("listitem");
    await expect(itens).toHaveCount(6);
    await expect(itens.first()).toContainText("1. Agachamento livre");
  });

  test("o Treino B vem quando o último treino foi o A", async ({ page }) => {
    await usuarioComPerfil({ ultimo_treino: "A1" });
    await abrirHoje(page, SEGUNDA);

    await expect(page.getByText("Treino B · 6 exercícios · 45 min")).toBeVisible();
    // 4 kg no pino da polia (SPEC §10.2)
    await expect(page.getByText("Hoje: 4 kg no pino").first()).toBeVisible();
  });

  test("a carga de hoje vem do estado e o evento explica por quê (§6.6)", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "exercise_state", [
      { exercise_id: "supino-reto-com-barra", carga_atual_kg: 9.5 },
    ]);
    await inserirNoMock(sessao, "progression_events", [
      {
        exercise_id: "supino-reto-com-barra",
        data: "2026-09-12",
        motivo: "subiu",
        de: { carga_kg: 7.5 },
        para: { carga_kg: 9.5 },
      },
    ]);

    await abrirHoje(page, SEGUNDA);
    await expect(
      page.getByText("Hoje: 9,5 kg na barra (subiu +2 kg no treino de 12/09)"),
    ).toBeVisible();
  });
});

test.describe("Hoje — dia de cardio (SPEC §3.1)", () => {
  test("a terça mostra a corrida da semana 1 e a alternativa da corda", async ({ page }) => {
    await usuarioComPerfil();
    await abrirHoje(page, TERCA);

    await expect(
      page.getByText("Corrida · semana 1 · 8 × (1 min corrida / 2 min caminhada) · 34 min"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Começar" })).toBeVisible();

    // pt-BR: vírgula decimal no detalhe da corrida (3,6 km, nunca "3.6")
    await expect(page.getByText("3,6 km no total · ritmo alvo 7:49/km")).toBeVisible();

    await page.getByRole("button", { name: "Fazer corda em vez de corrida" }).click();
    await expect(
      page.getByText("Corda · semana 1 · 6 × 30 s de corda (60 s de descanso) · 13 min"),
    ).toBeVisible();
    // milhar com ponto, do jeito pt-BR (≈ 300 saltos na semana 1)
    await expect(page.getByText("≈ 300 saltos")).toBeVisible();

    await semRolagemHorizontal(page);
  });

  test("dá para treinar mesmo assim, com o aviso de corrida e perna (§5.3)", async ({ page }) => {
    await usuarioComPerfil();
    await abrirHoje(page, TERCA);

    await expect(
      page.getByRole("link", { name: "Treinar mesmo assim (Treino A)" }),
    ).toBeVisible();
    await expect(page.getByRole("note")).toContainText("6 h");
  });
});

test.describe("Hoje — descanso e reps soltas (SPEC §3.1)", () => {
  test("a quinta é descanso, e o +1 grava a repetição solta", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrirHoje(page, QUINTA);

    await expect(page.getByText("Descanso", { exact: true })).toBeVisible();
    await expect(page.getByText("grease the groove")).toBeVisible();

    const mais = page.getByRole("button", {
      name: "Somar uma repetição solta de barra fixa",
    });
    expect((await mais.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await mais.click();
    await mais.click();
    await expect(page.getByText("Soltas de hoje").locator("..")).toContainText("2");

    await expect
      .poll(async () => (await lerDoMock(sessao, "pullup_singles")).length, {
        timeout: 10_000,
      })
      .toBe(2);
  });
});

test.describe("Hoje — faixa de status e treino aberto (SPEC §3.1)", () => {
  test("sem pesagem, a faixa pede para pesar e leva ao Corpo", async ({ page }) => {
    await usuarioComPerfil();
    await abrirHoje(page, SEGUNDA);

    await expect(page.getByText("Fase 1 · semana 1")).toBeVisible();
    await expect(page.getByText("Ainda não tem peso registrado.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pesar" })).toHaveAttribute(
      "href",
      "/corpo",
    );
  });

  test("com peso recente, mostra o peso e há quantos dias", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "body_weights", [
      { data: "2026-09-12", peso_kg: 82.4 },
    ]);

    await abrirHoje(page, SEGUNDA);
    await expect(page.getByText("82,4 kg")).toBeVisible();
    await expect(page.getByText("há 2 dias")).toBeVisible();
  });

  test("um treino em andamento vira banner com Continuar e Descartar", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "sessions", [
      {
        id: "11111111-1111-4111-8111-111111111111",
        data: "2026-09-12",
        workout_id: "A1",
        fase: "fase1",
        status: "em_andamento",
      },
    ]);

    await abrirHoje(page, SEGUNDA);

    const banner = page.getByRole("region", { name: "Treino aberto" });
    await expect(banner).toContainText("Você tem um treino aberto de 12/09");
    await expect(banner.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      "/treinar/11111111-1111-4111-8111-111111111111",
    );

    await banner.getByRole("button", { name: "Descartar" }).click();
    await expect(banner).toBeHidden();

    await expect
      .poll(
        async () => {
          const linhas = await lerDoMock<{ status: string }>(
            sessao,
            "sessions",
            "select=status",
          );
          return linhas[0]?.status;
        },
        { timeout: 10_000 },
      )
      .toBe("abandonada");
  });
});

test.describe("Hoje — cache persistido (SPEC §8)", () => {
  test("a leitura é guardada no IndexedDB para a próxima abertura", async ({ page }) => {
    /*
     * `fixarData` (page.clock.setFixedTime) e não `fixarRelogio`: o cache é
     * salvo por um setTimeout, que o `page.clock.install` congela. Sem fixar a
     * data, o teste só passa quando o dia real é de força.
     */
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await expect(page.getByText(/^Fase 1 · semana/)).toBeVisible();

    const guardado = async () =>
      page.evaluate(
        () =>
          new Promise<string | null>((resolver) => {
            const pedido = indexedDB.open("treino-terraco");
            pedido.onerror = () => resolver(null);
            pedido.onsuccess = () => {
              const banco = pedido.result;
              if (!banco.objectStoreNames.contains("cache")) return resolver(null);
              const busca = banco
                .transaction("cache", "readonly")
                .objectStore("cache")
                .get("react-query-v1");
              busca.onerror = () => resolver(null);
              busca.onsuccess = () =>
                resolver(busca.result ? JSON.stringify(busca.result) : null);
            };
          }),
      );

    await expect.poll(guardado, { timeout: 10_000 }).not.toBeNull();
    expect(await guardado()).toContain("perfil");
  });
});

test.describe("Hoje — auditoria do marco 2", () => {
  test("recarregar sem rede ainda mostra a Hoje com os dados da última sincronização", async ({
    page,
    context,
  }) => {
    /*
     * `fixarData` (page.clock.setFixedTime) e não `fixarRelogio`: o cache é
     * salvo por um setTimeout, que o `page.clock.install` congela. Sem fixar a
     * data, o teste só passa quando o dia real é de força.
     */
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await expect(page.getByText("Começar treino")).toBeVisible();
    // o persistidor guarda no máximo 1× por segundo
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<boolean>((resolver) => {
                const pedido = indexedDB.open("treino-terraco");
                pedido.onerror = () => resolver(false);
                pedido.onsuccess = () => {
                  const banco = pedido.result;
                  if (!banco.objectStoreNames.contains("cache")) return resolver(false);
                  const busca = banco
                    .transaction("cache", "readonly")
                    .objectStore("cache")
                    .get("react-query-v1");
                  busca.onerror = () => resolver(false);
                  busca.onsuccess = () => resolver(Boolean(busca.result));
                };
              }),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);

    await context.setOffline(true);
    try {
      await page.reload();
      // o conteúdo vem do cache do IndexedDB, não da rede (SPEC §8)
      await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
      await expect(page.getByText(/^Fase 1 · semana/)).toBeVisible();
      await expect(page.getByText(/exercícios · \d+ min/)).toBeVisible();
      await expect(page.getByRole("list", { name: "Exercícios de hoje" })).toBeVisible();
      await semRolagemHorizontal(page);
    } finally {
      await context.setOffline(false);
    }
  });

  test("a prévia não aparece com carga inventada quando o exercício não tem estado", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    // uma linha com carga_atual_kg nula: o motor cai na carga_inicial do JSON (§6.1)
    await inserirNoMock(sessao, "exercise_state", [
      { exercise_id: "agachamento-livre", carga_atual_kg: null },
    ]);
    await abrirHoje(page, SEGUNDA);

    const primeiro = page
      .getByRole("list", { name: "Exercícios de hoje" })
      .getByRole("listitem")
      .first();
    await expect(primeiro).toContainText("1. Agachamento livre");
    await expect(primeiro).toContainText("Hoje: 7,5 kg na barra");
  });
});

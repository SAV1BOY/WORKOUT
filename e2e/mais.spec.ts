import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  fixarData,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Segunda, 14/09/2026 — o primeiro dia do programa (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, SEGUNDA);
});

/** Espera a fila de saída esvaziar (a escrita vai pelo IndexedDB, §8). */
async function esperarFila(page: Page) {
  await page.waitForTimeout(600);
}

test.describe("/mais — o índice", () => {
  test("os quatro ajustes e o sair, com alvos de 44 px", async ({ page }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais");

    await expect(page.getByRole("heading", { name: "Mais" })).toBeVisible();
    for (const nome of ["Perfil", "Equipamento", "Preferências", "Backup"]) {
      await expect(page.getByRole("link", { name: new RegExp(nome) })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

    const links = page.locator("nav[aria-label='Ajustes'] a");
    for (let i = 0; i < (await links.count()); i++) {
      const caixa = await links.nth(i).boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await semRolagemHorizontal(page);
  });
});

test.describe("/mais/perfil", () => {
  test("nome, altura e data de início vão para o banco", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/perfil");

    await page.getByLabel("Nome").fill("Miguel S.");
    await page.getByLabel("Altura (cm)").fill("191,5");
    await page.getByLabel("Comecei em").fill("2026-09-07");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Perfil salvo.")).toBeVisible();
    await esperarFila(page);

    const [perfil] = await lerDoMock<{
      nome: string;
      altura_cm: number;
      data_inicio: string;
    }>(sessao, "profiles");
    expect(perfil?.nome).toBe("Miguel S.");
    expect(Number(perfil?.altura_cm)).toBe(191.5);
    expect(perfil?.data_inicio).toBe("2026-09-07");
  });

  test("avançar e repetir a semana do plano (SPEC §5.5)", async ({ page }) => {
    const sessao = await usuarioComPerfil({ semana_corrida: 3 });
    await entrarNoApp(page);
    await page.goto("/mais/perfil");

    await expect(page.getByText("Semana 3 de 12")).toBeVisible();
    await page.getByRole("button", { name: "Avançar semana de corrida" }).click();
    await expect(page.getByText("Semana 4 de 12")).toBeVisible();
    await page.getByRole("button", { name: "Repetir semana de corrida" }).click();
    await expect(page.getByText("Semana 3 de 12")).toBeVisible();
    await esperarFila(page);

    const [perfil] = await lerDoMock<{ semana_corrida: number }>(sessao, "profiles");
    expect(perfil?.semana_corrida).toBe(3);
  });
});

test.describe("Fase 2 (SPEC §5.1)", () => {
  /** 12 semanas de Fase 1 e 30 sessões concluídas: os dois gatilhos. */
  async function semearFase2Pronta(): Promise<SessaoMock> {
    const sessao = await usuarioComPerfil({
      data_inicio: "2026-06-15",
      fase_desde: "2026-06-15",
    });
    const sessoes = Array.from({ length: 30 }, (_, i) => ({
      id: `33333333-3333-4333-8333-${String(i).padStart(12, "0")}`,
      data: "2026-07-01",
      workout_id: i % 2 === 0 ? "A1" : "B1",
      fase: "fase1",
      status: "concluida",
      concluida_em: "2026-07-01T13:00:00.000Z",
    }));
    await inserirNoMock(sessao, "sessions", sessoes);
    return sessao;
  }

  test("sem os dois gatilhos a sugestão não aparece", async ({ page }) => {
    await usuarioComPerfil({ fase_desde: "2026-06-15" });
    await entrarNoApp(page);
    await page.goto("/mais/perfil");

    await expect(
      page.getByRole("button", { name: "Passar para a Fase 2" }),
    ).toHaveCount(0);
    await expect(page.getByText(/A Fase 2 é sugerida com 12 semanas/)).toBeVisible();
  });

  test("com 12 semanas e 30 treinos, adiar silencia por 2 semanas", async ({
    page,
  }) => {
    const sessao = await semearFase2Pronta();
    await entrarNoApp(page);
    await page.goto("/mais/perfil");

    await expect(page.getByText(/30 treinos concluídos/).first()).toBeVisible();
    await page.getByRole("button", { name: "Adiar 2 semanas" }).click();
    await expect(page.getByText(/pergunto de novo em 2 semanas/)).toBeVisible();
    await esperarFila(page);

    const [perfil] = await lerDoMock<{
      prefs: { fase2_adiada_ate?: string };
      fase_atual: string;
    }>(sessao, "profiles");
    expect(perfil?.prefs.fase2_adiada_ate).toBe("2026-09-28");
    expect(perfil?.fase_atual).toBe("fase1");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Passar para a Fase 2" }),
    ).toHaveCount(0);
  });

  test("aceitar troca a fase e registra o evento trocou_fase", async ({ page }) => {
    const sessao = await semearFase2Pronta();
    await entrarNoApp(page);
    await page.goto("/mais/perfil");

    await page.getByRole("button", { name: "Passar para a Fase 2" }).click();
    await expect(page.getByText("Fase 2 começando hoje.")).toBeVisible();
    await esperarFila(page);

    const [perfil] = await lerDoMock<{ fase_atual: string; fase_desde: string }>(
      sessao,
      "profiles",
    );
    expect(perfil?.fase_atual).toBe("fase2");
    expect(perfil?.fase_desde).toBe("2026-09-14");

    const eventos = await lerDoMock<{
      motivo: string;
      exercise_id: string | null;
      de: { fase?: string };
      para: { fase?: string };
    }>(sessao, "progression_events");
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.motivo).toBe("trocou_fase");
    expect(eventos[0]?.exercise_id).toBeNull();
    expect(eventos[0]?.para.fase).toBe("fase2");

    // a Hoje já mostra o treino da fase nova (SPEC §5.2 item 3)
    await page.goto("/");
    await expect(page.getByText(/Superior A/)).toBeVisible();
  });
});

test.describe("/mais/equipamento", () => {
  test("os 10 itens com foto de verdade e as barras a pesar", async ({ page }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/equipamento");

    const fotos = page.locator("ul li img");
    await expect(fotos).toHaveCount(10);
    for (let i = 0; i < 10; i++) {
      await expect(fotos.nth(i)).toHaveJSProperty("complete", true);
      const largura = await fotos.nth(i).evaluate(
        (el) => (el as HTMLImageElement).naturalWidth,
      );
      expect(largura, `foto ${i} não carregou`).toBeGreaterThan(0);
    }

    await expect(page.getByText("a pesar")).toHaveCount(2);
    await expect(page.getByText("Vale hoje: 7,5 kg").first()).toBeVisible();
    await semRolagemHorizontal(page);
  });

  /**
   * O ponto do marco (SPEC §3.9 com §6.4): o peso medido entra em
   * `prefs.pesos_barras` e a montagem passa a usá-lo — a carga de hoje muda.
   */
  test("pesar o halter muda a carga que a Hoje pede", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await entrarNoApp(page);

    await expect(page.getByText("Hoje: 1,5 kg por halter")).toBeVisible();

    await page.goto("/mais/equipamento");
    await page.getByLabel("Peso na balança (kg)").nth(3).fill("1,4");
    await page
      .getByRole("button", { name: /^Salvar peso: 2 barras de halter/ })
      .click();
    await expect(page.getByText(/1,4 kg/).first()).toBeVisible();
    await esperarFila(page);

    const [perfil] = await lerDoMock<{
      prefs: { pesos_barras?: Record<string, number> };
    }>(sessao, "profiles");
    expect(perfil?.prefs.pesos_barras?.halteres).toBe(1.4);

    await page.goto("/");
    await expect(page.getByText("Hoje: 1,4 kg por halter")).toBeVisible();
  });
});

test.describe("/mais/preferencias", () => {
  test("o tema muda a classe do html e fica guardado no perfil", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/preferencias");

    await page.getByRole("button", { name: "Escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await esperarFila(page);

    const [perfil] = await lerDoMock<{ prefs: { tema?: string } }>(
      sessao,
      "profiles",
    );
    expect(perfil?.prefs.tema).toBe("escuro");

    await page.getByRole("button", { name: "Claro" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // e volta assim depois de recarregar: o perfil manda no tema
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("desligar o som do descanso grava em prefs", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/preferencias");

    const som = page.getByRole("switch", { name: "Som no fim do descanso" });
    await expect(som).toBeChecked();
    await som.click();
    await expect(som).not.toBeChecked();
    await esperarFila(page);

    const [perfil] = await lerDoMock<{ prefs: { descanso_som?: boolean } }>(
      sessao,
      "profiles",
    );
    expect(perfil?.prefs.descanso_som).toBe(false);
  });

  test("o incremento do agachamento vira override em exercise_state", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/preferencias");

    await expect(page.getByText("programa 4 kg · usando 4 kg").first()).toBeVisible();

    await page.getByLabel("Agachamento livre", { exact: true }).fill("6");
    await page
      .getByRole("button", { name: "Salvar incremento: Agachamento livre" })
      .click();
    await expect(page.getByText(/6 kg por subida/)).toBeVisible();
    await esperarFila(page);

    const estados = await lerDoMock<{
      exercise_id: string;
      incremento_kg: number;
    }>(sessao, "exercise_state");
    expect(estados).toHaveLength(1);
    expect(estados[0]?.exercise_id).toBe("agachamento-livre");
    expect(Number(estados[0]?.incremento_kg)).toBe(6);

    await page.reload();
    await expect(page.getByText("programa 4 kg · usando 6 kg").first()).toBeVisible();
  });
});

test.describe("/mais/backup (SPEC §9)", () => {
  test("o que foi exportado, importado num mock zerado, reproduz o estado", async ({
    page,
  }) => {
    /* ---------------------------------------- 1) um estado para exportar */
    const antes = await usuarioComPerfil({ semana_corrida: 4, ultimo_treino: "A1" });
    await inserirNoMock(antes, "sessions", [
      {
        id: "44444444-4444-4444-8444-000000000001",
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "concluida",
        concluida_em: "2026-09-14T13:00:00.000Z",
      },
    ]);
    await inserirNoMock(antes, "session_sets", [
      {
        id: "55555555-5555-4555-8555-000000000001",
        session_id: "44444444-4444-4444-8444-000000000001",
        exercise_id: "agachamento-livre",
        ordem_ex: 1,
        set_index: 1,
        tipo: "trabalho",
        reps: 8,
        carga_kg: 9.5,
        concluida: true,
      },
    ]);
    await inserirNoMock(antes, "exercise_state", [
      { exercise_id: "agachamento-livre", carga_atual_kg: 11.5, falhas_seguidas: 1 },
    ]);
    await inserirNoMock(antes, "body_weights", [
      { id: "66666666-6666-4666-8666-000000000001", data: "2026-09-13", peso_kg: 82.4 },
    ]);

    await entrarNoApp(page);
    await page.goto("/mais/backup");

    const baixando = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar backup" }).click();
    const arquivo = await baixando;
    expect(arquivo.suggestedFilename()).toMatch(
      /^treino-terraco-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const caminho = await arquivo.path();
    const conteudo = JSON.parse(readFileSync(caminho, "utf8")) as {
      app: string;
      tabelas: Record<string, unknown[]>;
    };
    expect(conteudo.app).toBe("treino-terraco");
    expect(conteudo.tabelas.sessions).toHaveLength(1);
    expect(conteudo.tabelas.session_sets).toHaveLength(1);
    expect(conteudo.tabelas.body_weights).toHaveLength(1);

    /* ------------------------------- 2) mock zerado, usuário novo, import */
    await resetarMock();
    const depois = await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/backup");

    await page.setInputFiles("#arquivo-backup", caminho);
    await expect(page.getByText(/linhas novas/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "treinos" })).toBeVisible();
    await page.getByRole("button", { name: "Importar tudo" }).click();
    await expect(page.getByText(/linhas importadas/)).toBeVisible();
    await esperarFila(page);

    /* -------------------------------------------- 3) o estado voltou igual */
    const sessoes = await lerDoMock<{ id: string; workout_id: string; user_id: string }>(
      depois,
      "sessions",
    );
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.id).toBe("44444444-4444-4444-8444-000000000001");
    // a RLS só aceita linha do dono: o backup foi recarimbado (§9)
    expect(sessoes[0]?.user_id).toBe(depois.userId);

    const series = await lerDoMock<{ carga_kg: number; reps: number }>(
      depois,
      "session_sets",
    );
    expect(series).toHaveLength(1);
    expect(Number(series[0]?.carga_kg)).toBe(9.5);

    const estados = await lerDoMock<{ carga_atual_kg: number }>(
      depois,
      "exercise_state",
    );
    expect(Number(estados[0]?.carga_atual_kg)).toBe(11.5);

    const pesos = await lerDoMock<{ peso_kg: number }>(depois, "body_weights");
    expect(Number(pesos[0]?.peso_kg)).toBe(82.4);

    const [perfil] = await lerDoMock<{ semana_corrida: number; ultimo_treino: string }>(
      depois,
      "profiles",
    );
    expect(perfil?.semana_corrida).toBe(4);
    expect(perfil?.ultimo_treino).toBe("A1");

    /* ------------------------------ 4) importar de novo não duplica nada */
    await page.setInputFiles("#arquivo-backup", caminho);
    await expect(page.getByText(/linhas novas/)).toBeVisible();
    await page.getByRole("button", { name: "Importar tudo" }).click();
    await esperarFila(page);

    expect(await lerDoMock(depois, "sessions")).toHaveLength(1);
    expect(await lerDoMock(depois, "session_sets")).toHaveLength(1);
    expect(await lerDoMock(depois, "body_weights")).toHaveLength(1);
  });

  test("um arquivo que não é backup avisa e não grava nada", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/mais/backup");

    await page.setInputFiles("#arquivo-backup", {
      name: "qualquer.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"oi":1}'),
    });
    await expect(page.getByText(/não parece um backup/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar tudo" })).toHaveCount(0);
    await esperarFila(page);
    expect(await lerDoMock(sessao, "sessions")).toHaveLength(0);
  });
});

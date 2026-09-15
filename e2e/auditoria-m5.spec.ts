import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

/**
 * Auditoria do marco 5 (SPEC §10.7 e §10.8): as 81 fichas, os gráficos com 1 e
 * com 30 pontos, a redução da foto e os alvos de 44 px das telas novas.
 *
 * Estes testes não repetem o que `catalogo.spec.ts`, `progresso.spec.ts` e
 * `corpo.spec.ts` já cobrem: eles varrem o que só uma varredura pega.
 */

interface ExercicioJson {
  grupo: string;
  implemento: string;
  id: string;
  nome: string;
  figura: string | null;
  fotos: string[];
  passos: string[];
  musculos_primarios: string[];
  musculos_secundarios: string[];
}

const CATALOGO = JSON.parse(
  readFileSync(resolve(__dirname, "../data/exercicios.json"), "utf8"),
) as ExercicioJson[];

const QUARTA = "2026-09-16T08:00:00-03:00";

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("§10.8 — as 81 fichas", () => {
  test("todas abrem com imagem, músculos, passos e histórico, sem 404", async ({
    page,
  }) => {
    test.setTimeout(20 * 60_000);
    await usuarioComPerfil();
    await entrarNoApp(page);

    const quebrados: string[] = [];
    page.on("response", (r) => {
      const url = r.url();
      if (r.status() >= 400 && /\/(figuras|fotos|itens|mapa-muscular)\//.test(url)) {
        quebrados.push(`${r.status()} ${url}`);
      }
    });

    const problemas: string[] = [];
    for (const exercicio of CATALOGO) {
      const resposta = await page.goto(`/exercicios/${exercicio.id}`);
      if (resposta?.status() !== 200) {
        problemas.push(`${exercicio.id}: HTTP ${resposta?.status()}`);
        continue;
      }
      const visto = await page.evaluate(() => {
        const imagens = [...document.querySelectorAll("main img")].map((i) => {
          const img = i as HTMLImageElement;
          return { src: img.currentSrc || img.src, ok: img.naturalWidth > 0 };
        });
        const figura = document.querySelector("main figure svg use") !== null;
        const mapa = document.querySelector("main figure[class*='p-']") !== null;
        const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
        const passos = document.querySelectorAll("main ol > li").length;
        return { imagens, figura, mapa, h1, passos };
      });

      if (visto.h1 !== exercicio.nome) {
        problemas.push(`${exercicio.id}: h1 "${visto.h1}" ≠ "${exercicio.nome}"`);
      }
      // figura animada (SVG <img>) ou, nos 14 sem figura, as duas fotos
      const carregadas = visto.imagens.filter((i) => i.ok).length;
      const esperadas = exercicio.fotos.length + (exercicio.figura ? 1 : 0);
      if (carregadas < esperadas) {
        problemas.push(
          `${exercicio.id}: ${carregadas} de ${esperadas} imagens carregaram (${visto.imagens
            .filter((i) => !i.ok)
            .map((i) => i.src)
            .join(", ")})`,
        );
      }
      if (!visto.mapa) problemas.push(`${exercicio.id}: sem o mapa muscular`);
      if (visto.passos < exercicio.passos.length) {
        problemas.push(
          `${exercicio.id}: ${visto.passos} passos na tela, ${exercicio.passos.length} no JSON`,
        );
      }
    }

    expect(problemas, "fichas com problema").toEqual([]);
    expect(quebrados, "assets com erro HTTP").toEqual([]);
  });

  test("os 14 sem figura caem nas fotos e o mapa usa as classes p-/s-", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);

    const semFigura = CATALOGO.filter((e) => !e.figura);
    expect(semFigura.length).toBe(14);

    for (const e of semFigura.slice(0, 3)) {
      await page.goto(`/exercicios/${e.id}`);
      const fotos = page.locator("main img");
      await expect(fotos).toHaveCount(e.fotos.length);
      await expect(fotos.first()).toBeVisible();
    }

    // o boneco: as classes p-<musculo> / s-<musculo> e o sprite <use href="#bf">
    const alvo = CATALOGO.find((e) => e.id === "supino-reto-com-barra");
    await page.goto(`/exercicios/${alvo?.id}`);
    const mapa = page.locator("main figure").filter({ has: page.locator("svg use") });
    const classe = await mapa.first().getAttribute("class");
    for (const m of alvo?.musculos_primarios ?? []) expect(classe).toContain(`p-${m}`);
    for (const m of alvo?.musculos_secundarios ?? []) expect(classe).toContain(`s-${m}`);
    // o sprite é injetado uma vez no layout e pintado de verdade
    const pintado = await page.evaluate(() => {
      const uso = document.querySelector("main figure svg use");
      if (!uso) return null;
      const id = uso.getAttribute("href") ?? "";
      const simbolo = document.querySelector(id);
      return simbolo ? simbolo.tagName : null;
    });
    expect(pintado).not.toBeNull();
  });
});

test.describe("§10.7 — gráficos com 1 e com 30 pontos", () => {
  async function semearPesos(sessao: SessaoMock, quantos: number) {
    const linhas = Array.from({ length: quantos }, (_, i) => {
      const dia = new Date(Date.UTC(2026, 7, 18 + i));
      return {
        id: `66666666-6666-4666-8666-${String(i + 1).padStart(12, "0")}`,
        data: dia.toISOString().slice(0, 10),
        peso_kg: 82 + (i % 5) * 0.2,
      };
    });
    await inserirNoMock(sessao, "body_weights", linhas);
  }

  test("o gráfico do peso desenha com 1 ponto e com 30", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await semearPesos(sessao, 1);
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/corpo");

    const grafico = page.getByLabel("Peso por data, com a média de 7 dias");
    await expect(grafico).toBeVisible();
    expect(await grafico.locator("svg .recharts-dot").count()).toBeGreaterThan(0);
    await semRolagemHorizontal(page);

    await resetarMock();
    const outra = await usuarioComPerfil();
    await semearPesos(outra, 30);
    await entrarNoApp(page);
    await page.goto("/corpo");
    await expect(grafico).toBeVisible();
    // 30 pontos: a linha do peso e a da média, e o eixo x ralo (≤ 8 rótulos)
    expect(await grafico.locator("svg .recharts-line").count()).toBe(2);
    const rotulos = await grafico
      .locator("svg .recharts-xAxis .recharts-cartesian-axis-tick")
      .count();
    expect(rotulos).toBeGreaterThan(1);
    expect(rotulos).toBeLessThanOrEqual(8);
    await semRolagemHorizontal(page);
  });
});

test.describe("§3.8 — a foto grande é reduzida a 1600 px", () => {
  test("uma imagem de 2400 px sobe com ≤ 1600 px e no caminho da policy", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/corpo");
    await page.getByRole("tab", { name: "Fotos" }).click();

    // um PNG 2400 × 1200 gerado no próprio navegador
    const grande = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sem canvas");
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(0, 0, 2400, 1200);
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
      const buffer = new Uint8Array(await blob!.arrayBuffer());
      return [...buffer];
    });

    await page.setInputFiles('input[aria-label="Foto de frente"]', {
      name: "grande.png",
      mimeType: "image/png",
      buffer: Buffer.from(grande),
    });
    await expect(page.getByText("Foto de frente guardada.")).toBeVisible();

    const caminho = `${sessao.userId}/2026-09-16-frente.jpg`;
    await expect
      .poll(async () => {
        const linhas = await lerDoMock(sessao, "progress_photos", "select=storage_path");
        return linhas.map((l) => l.storage_path);
      }, { timeout: 15_000 })
      .toContain(caminho);

    // o arquivo chegou ao bucket: baixa e mede
    const { tamanho, tipo } = await medirNoBucket(page, sessao, caminho);
    expect(tipo, "o bucket guardou um JPEG").toContain("image/jpeg");
    expect(tamanho.largura, "maior lado ≤ 1600 px").toBeLessThanOrEqual(1600);
    expect(tamanho.altura).toBeLessThanOrEqual(1600);
    expect(tamanho.largura).toBe(1600);
    expect(tamanho.altura).toBe(800);
  });
});

/** Baixa o arquivo do bucket do mock pelo navegador e mede a imagem. */
async function medirNoBucket(
  page: Page,
  sessao: SessaoMock,
  caminho: string,
): Promise<{ tamanho: { largura: number; altura: number }; tipo: string }> {
  return page.evaluate(
    async ({ token, caminho }) => {
      const url = `http://127.0.0.1:54321/storage/v1/object/authenticated/progresso/${caminho}`;
      const resposta = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, apikey: "mock-anon" },
      });
      const tipo = resposta.headers.get("content-type") ?? "";
      const blob = await resposta.blob();
      const bitmap = await createImageBitmap(blob);
      return {
        tamanho: { largura: bitmap.width, altura: bitmap.height },
        tipo,
      };
    },
    { token: sessao.token, caminho },
  );
}

test.describe("§4 — o rótulo da carga por implemento", () => {
  /** Um exercício de cada implemento com carga; a §4 exige o rótulo certo. */
  const CASOS = [
    { id: "supino-reto-com-barra", texto: "7,5 kg na barra" },
    { id: "supino-reto-com-halteres", texto: "1,5 kg por halter" },
    { id: "crossover-na-polia", texto: "4 kg no pino" },
    { id: "abdominal-com-anilha", texto: "5 kg na anilha" },
    { id: "rosca-com-barra-w", texto: "2 kg na barra" },
    { id: "flexao-declinada", texto: "peso do corpo" },
  ];

  test("cada ficha mostra a carga inicial com o rótulo do implemento", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    for (const caso of CASOS) {
      await page.goto(`/exercicios/${caso.id}`);
      const secao = page.locator("section").filter({ hasText: "Carga inicial" });
      await expect(secao.first(), caso.id).toContainText(caso.texto);
    }
  });
});

test.describe("§3.7 — a conta bate com a mão", () => {
  /**
   * Sexta, 18/09/2026. A semana planejada (lib/calendario) é
   * seg A1 · ter cardio · qua B1 · qui DESCANSO · sex A1 · sáb cardio · dom
   * descanso. Até hoje (sexta) são 4 dias planejados — o descanso de quinta não
   * conta e o sábado ainda não chegou.
   *
   * Feitos: a força de segunda e a de quarta. Nada de cardio, nada na sexta.
   * Aderência = 2 ÷ 4 = 50 %.
   *
   * Volume da semana (só séries de trabalho concluídas):
   *   14/09  20 × 5 + 20 × 5 + 20 × 4          = 280
   *   16/09  unilateral 10 kg, 8 + 8 reps      = 160
   *   16/09  flexão (0 kg) e a série não feita =   0
   *   16/09  aquecimento 20 × 5                =   0
   *                                             ----
   *                                             440 kg
   */
  const SEXTA = "2026-09-18T09:00:00-03:00";
  const S1 = "aaaaaaaa-1111-4111-8111-000000000001";
  const S2 = "aaaaaaaa-1111-4111-8111-000000000002";

  test("aderência 50 % e volume 440 kg com sessões semeadas à mão", async ({ page }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
    await inserirNoMock(sessao, "sessions", [
      { id: S1, data: "2026-09-14", workout_id: "A1", fase: "fase1", status: "concluida" },
      { id: S2, data: "2026-09-16", workout_id: "B1", fase: "fase1", status: "concluida" },
    ]);
    const serie = (n: number, extra: Record<string, unknown>) => ({
      id: `bbbbbbbb-2222-4222-8222-${String(n).padStart(12, "0")}`,
      ordem_ex: 1,
      set_index: n,
      tipo: "trabalho",
      concluida: true,
      ...extra,
    });
    await inserirNoMock(sessao, "session_sets", [
      serie(1, { session_id: S1, exercise_id: "agachamento-livre", carga_kg: 20, reps: 5, registrada_em: "2026-09-14T12:00:00.000Z" }),
      serie(2, { session_id: S1, exercise_id: "agachamento-livre", carga_kg: 20, reps: 5, registrada_em: "2026-09-14T12:05:00.000Z" }),
      serie(3, { session_id: S1, exercise_id: "agachamento-livre", carga_kg: 20, reps: 4, registrada_em: "2026-09-14T12:10:00.000Z" }),
      serie(4, { session_id: S2, exercise_id: "remada-unilateral-serrote", carga_kg: 10, reps: 8, reps_lado2: 8, registrada_em: "2026-09-16T12:00:00.000Z" }),
      serie(5, { session_id: S2, exercise_id: "flexao-de-braco", carga_kg: 0, reps: 12, registrada_em: "2026-09-16T12:05:00.000Z" }),
      serie(6, { session_id: S2, exercise_id: "agachamento-livre", carga_kg: 20, reps: 5, concluida: false, registrada_em: "2026-09-16T12:10:00.000Z" }),
      serie(7, { session_id: S2, exercise_id: "agachamento-livre", carga_kg: 20, reps: 5, tipo: "aquecimento", registrada_em: "2026-09-16T12:15:00.000Z" }),
    ]);

    await fixarData(page, SEXTA);
    await entrarNoApp(page);
    await page.goto("/progresso");
    await expect(page.getByRole("heading", { name: "Progresso" })).toBeVisible();

    const card = (rotulo: string) =>
      page.locator("div", { hasText: new RegExp(`^${rotulo}`) }).last();

    await expect(card("Treinos na semana")).toContainText("2");
    await expect(card("Treinos na semana")).toContainText("2 no mês · 2 no total");
    await expect(card("Aderência \\(4 semanas\\)")).toContainText("50 %");
    await expect(card("Aderência \\(4 semanas\\)")).toContainText("2 de 4 dias");
    await expect(card("Volume da semana")).toContainText("440 kg");

    // três recordes nasceram na janela: 20 kg, 10 kg e 12 reps
    await expect(card("Recordes \\(30 dias\\)")).toContainText("3");
    await expect(page.getByText("12 reps")).toBeVisible();
    await semRolagemHorizontal(page);
  });
});

test.describe("§3.8 — a meta de peso nos dois sentidos", () => {
  /**
   * O objetivo do perfil (`data/perfil.json`) é ganhar músculo: a meta fica
   * ACIMA do peso de hoje tanto quanto abaixo. O card tem de dizer quanto
   * falta nos dois casos.
   */
  test("meta acima e meta abaixo do peso dizem quanto falta", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/corpo");

    await page.getByLabel("Peso (kg)").fill("82,0");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText(/82 kg em 16\/09/)).toBeVisible();

    await page.getByLabel("Meta (kg)").fill("90,0");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Faltam 8 kg para a meta de 90 kg.")).toBeVisible();

    await page.getByLabel("Meta (kg)").fill("78,5");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Faltam 3,5 kg para a meta de 78,5 kg.")).toBeVisible();
  });

  test("um peso que não é número não grava nada e avisa", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/corpo");

    await page.getByLabel("Peso (kg)").fill("oitenta");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Digite o peso, por exemplo 82,4.")).toBeVisible();

    await page.waitForTimeout(500);
    const linhas = await lerDoMock(sessao, "body_weights", "select=data");
    expect(linhas).toEqual([]);
  });
});

test.describe("§3.6 — busca sem acento e filtros", () => {
  test("a busca casa sem acento e os filtros se somam", async ({ page }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await page.goto("/exercicios");

    const contagem = page.getByText(/exercícios$/);
    await expect(contagem).toHaveText("81 exercícios");

    const busca = page.getByLabel("Buscar exercício pelo nome");
    await busca.fill("triceps");
    await expect(page.getByRole("link", { name: /Tríceps/ }).first()).toBeVisible();
    const comTriceps = CATALOGO.filter((e) =>
      e.nome
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes("triceps"),
    ).length;
    await expect(contagem).toHaveText(`${comTriceps} de 81 exercícios`);

    // duas palavras: todas têm de aparecer no nome
    await busca.fill("supino reto");
    const supinoReto = CATALOGO.filter((e) => {
      const nome = e.nome
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return nome.includes("supino") && nome.includes("reto");
    }).length;
    expect(supinoReto).toBeGreaterThan(0);
    await expect(contagem).toHaveText(`${supinoReto} de 81 exercícios`);
    await expect(page.getByRole("link", { name: /Supino reto com barra/ })).toBeVisible();

    // filtro somado: grupo Peito + a busca vazia
    await page.getByRole("button", { name: "Limpar", exact: true }).click();
    await expect(contagem).toHaveText("81 exercícios");
    await page.getByLabel("Grupo").selectOption("Peito");
    const doPeito = CATALOGO.filter((e) => e.grupo === "Peito").length;
    await expect(contagem).toHaveText(`${doPeito} de 81 exercícios`);

    // + implemento: os dois filtros juntos
    await page.getByLabel("Implemento").selectOption("halteres");
    const peitoHalteres = CATALOGO.filter(
      (e) => e.grupo === "Peito" && e.implemento === "halteres",
    ).length;
    await expect(contagem).toHaveText(`${peitoHalteres} de 81 exercícios`);

    // nada casa: a tela diz isso, não some em silêncio
    await busca.fill("zzz");
    await expect(page.getByText("Nenhum exercício com esses filtros.")).toBeVisible();
    await semRolagemHorizontal(page);
  });
});

test.describe("celular — as telas do marco 5 a 360 px", () => {
  for (const rota of ["/exercicios", "/progresso", "/corpo"]) {
    test(`${rota}: nada rola para o lado e todo alvo tem 44 px`, async ({ page }) => {
      await usuarioComPerfil();
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await page.goto(rota);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(500);

      await semRolagemHorizontal(page);

      // os controles: o que o app marca como alvo (`.alvo`, min 44 px em
      // globals.css) mais todo botão, campo, seletor e aba da tela
      const pequenos = await page.evaluate(() => {
        const alvos = [
          ...document.querySelectorAll(
            "main .alvo, main button, main select, main input:not([type=range]), main [role=tab]",
          ),
        ];
        return alvos
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              texto: (el.textContent ?? "").trim().slice(0, 30),
              h: Math.round(r.height),
              w: Math.round(r.width),
            };
          })
          .filter((a) => a.w > 0 && a.h > 0 && (a.h < 44 || a.w < 44));
      });
      expect(pequenos, "alvos menores que 44 px").toEqual([]);
    });
  }

  test("/corpo: as três abas abrem sem rolagem lateral", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/corpo");
    for (const aba of ["Peso", "Medidas", "Fotos"]) {
      await page.getByRole("tab", { name: aba }).click();
      await expect(page.getByRole("tab", { name: aba })).toHaveAttribute(
        "data-state",
        "active",
      );
      await semRolagemHorizontal(page);
    }
  });
});

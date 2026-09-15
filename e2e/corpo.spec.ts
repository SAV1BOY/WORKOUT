import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  estadoDoMock,
  fixarData,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Quarta, 16/09/2026. */
const QUARTA = "2026-09-16T08:00:00-03:00";

/** Um PNG 16 × 16 de verdade (o app o decodifica no canvas antes de subir). */
const PNG_16 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4YSNHEmIY1TCqYfhqAADXFCIQU/5f4AAAAABJRU5ErkJggg==",
  "base64",
);

async function abrirCorpo(page: Page, aba: "Peso" | "Medidas" | "Fotos" = "Peso") {
  await fixarData(page, QUARTA);
  await entrarNoApp(page);
  await page.getByRole("link", { name: "Corpo" }).click();
  await expect(page.getByRole("heading", { name: "Corpo" })).toBeVisible();
  if (aba !== "Peso") await page.getByRole("tab", { name: aba }).click();
}

async function enviarFoto(page: Page, angulo: string) {
  await page.getByLabel(`Foto de ${angulo}`).setInputFiles({
    name: `${angulo}.png`,
    mimeType: "image/png",
    buffer: PNG_16,
  });
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("Corpo — peso (SPEC §3.8)", () => {
  test("o peso registrado aparece no gráfico e chega ao banco", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrirCorpo(page);

    await page.getByLabel("Peso (kg)").fill("82,4");
    await page.getByRole("button", { name: "Registrar" }).click();

    // o card do topo e o gráfico com média móvel
    await expect(page.getByText("82,4 kg em 16/09")).toBeVisible();
    await expect(
      page.getByLabel("Peso por data, com a média de 7 dias"),
    ).toBeVisible();
    await expect(page.getByText("Média de 7 dias")).toBeVisible();

    // e a linha em body_weights (upsert por (user_id, data))
    await expect
      .poll(async () => (await lerDoMock(sessao, "body_weights")).length, {
        timeout: 10_000,
      })
      .toBe(1);
    const [linha] = await lerDoMock<{ data: string; peso_kg: number }>(
      sessao,
      "body_weights",
    );
    expect(linha?.data).toBe("2026-09-16");
    expect(Number(linha?.peso_kg)).toBe(82.4);

    // pesar de novo no mesmo dia troca a linha, não cria outra
    await page.getByLabel("Peso (kg)").fill("82");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("82 kg em 16/09")).toBeVisible();
    await expect
      .poll(async () => {
        const linhas = await lerDoMock<{ peso_kg: number }>(sessao, "body_weights");
        return `${linhas.length}|${Number(linhas[0]?.peso_kg)}`;
      })
      .toBe("1|82");

    await semRolagemHorizontal(page);
  });

  test("a meta fica no perfil e a variação por semana aparece", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrirCorpo(page);

    await page.getByLabel("Meta (kg)").fill("78,5");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect
      .poll(async () => {
        const [perfil] = await lerDoMock<{ prefs: { meta_peso?: number } }>(
          sessao,
          "profiles",
        );
        return perfil?.prefs?.meta_peso;
      })
      .toBe(78.5);

    await page.getByLabel("Peso (kg)").fill("82,4");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText(/Faltam 3,9 kg para a meta/)).toBeVisible();
  });
});

test.describe("Corpo — medidas (SPEC §3.8)", () => {
  test("as medidas entram na tabela, no gráfico e no banco", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrirCorpo(page, "Medidas");

    await page.getByLabel("Cintura (cm)").fill("91,5");
    await page.getByLabel("Peito (cm)").fill("104");
    await page.getByRole("button", { name: "Salvar medidas" }).click();

    await expect(page.getByRole("table", { name: "Medidas registradas" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "91,5" })).toBeVisible();
    await expect(page.getByLabel("Medida por data")).toBeVisible();

    await expect
      .poll(async () => {
        const [linha] = await lerDoMock<{ cintura_cm: number; peito_cm: number }>(
          sessao,
          "body_measurements",
        );
        return linha ? `${Number(linha.cintura_cm)}|${Number(linha.peito_cm)}` : null;
      })
      .toBe("91.5|104");

    await semRolagemHorizontal(page);
  });
});

test.describe("Corpo — fotos (SPEC §3.8)", () => {
  test("a foto sobe para o bucket e aparece na galeria", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrirCorpo(page, "Fotos");

    await enviarFoto(page, "frente");

    // a galeria mostra a foto na hora (o blob ainda está no aparelho)
    const naGaleria = page.getByRole("img", { name: "Frente em 16/09" });
    await expect(naGaleria).toBeVisible();

    // e ela chega ao bucket no caminho da policy: <user_id>/<data>-<angulo>.jpg
    const caminho = `${sessao.userId}/2026-09-16-frente.jpg`;
    await expect
      .poll(
        async () => {
          const estado = await estadoDoMock();
          return (estado.arquivos as string[]) ?? [];
        },
        { timeout: 15_000 },
      )
      .toContain(`progresso/${caminho}`);

    const [linha] = await lerDoMock<{ storage_path: string; angulo: string }>(
      sessao,
      "progress_photos",
    );
    expect(linha?.storage_path).toBe(caminho);
    expect(linha?.angulo).toBe("frente");

    // depois de subir, a galeria passa a usar a URL assinada do bucket
    await page.reload();
    await page.getByRole("tab", { name: "Fotos" }).click();
    const depois = page.getByRole("img", { name: "Frente em 16/09" });
    await expect(depois).toBeVisible();
    await expect(depois).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/progresso\//);
    await expect
      .poll(async () => depois.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);

    await semRolagemHorizontal(page);
  });

  test("duas datas abrem a comparação com o slider", async ({ page }) => {
    await usuarioComPerfil();
    await abrirCorpo(page, "Fotos");

    await expect(
      page.getByText("A comparação precisa de fotos de dois dias diferentes."),
    ).toBeVisible();

    await enviarFoto(page, "frente");
    await expect(page.getByRole("img", { name: "Frente em 16/09" })).toBeVisible();

    await page.getByLabel("Data").fill("2026-08-16");
    await enviarFoto(page, "frente");
    await expect(page.getByRole("img", { name: "Frente em 16/08" })).toBeVisible();

    // a comparação abre na mais antiga × a mais nova
    const slider = page.getByLabel("Quanto mostrar da foto mais antiga");
    await expect(slider).toBeVisible();
    await expect(page.getByRole("img", { name: "Antes — 16/08" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Depois — 16/09" })).toBeVisible();

    await slider.fill("80");
    await expect(page.getByRole("img", { name: "Antes — 16/08" })).toHaveAttribute(
      "style",
      /inset\(0px 20% 0px 0px\)/,
    );

    await semRolagemHorizontal(page);
  });
});

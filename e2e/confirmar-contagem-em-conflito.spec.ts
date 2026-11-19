import { expect, test } from "@playwright/test";
import { abrirConflitosDoBackup } from "./contagens-em-conflito";
import { atualizarNoMock, lerDoMock, naFila } from "./fixtures";

declare global {
  interface Window {
    provaDaContagem: {
      serie: string;
      modo: "normal" | "reter antes" | "perder resposta";
      estado: "inicial" | "retida" | "resposta perdida";
      liberar: () => void;
    };
  }
}

test("uma edição entre a escolha e o envio exige reler a série e perder a confirmação não duplica a correção", async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const buscar = window.fetch.bind(window);
    let liberar!: () => void;
    const espera = new Promise<void>(resolve => { liberar = resolve; });
    window.provaDaContagem = { serie: "", modo: "normal", estado: "inicial", liberar };
    window.fetch = async (entrada, opcoes) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada), location.href);
      const metodo = opcoes?.method ?? (entrada instanceof Request ? entrada.method : "GET");
      const prova = window.provaDaContagem;
      const alvo = metodo === "PATCH" && url.pathname === "/rest/v1/session_sets" && url.searchParams.get("id") === "eq." + prova.serie;
      if (alvo && prova.modo === "reter antes") {
        prova.estado = "retida";
        prova.modo = "normal";
        await espera;
      }
      const resposta = await buscar(entrada, opcoes);
      if (alvo && prova.modo === "perder resposta" && resposta.ok) {
        prova.estado = "resposta perdida";
        prova.modo = "normal";
        throw new TypeError("Failed to fetch");
      }
      return resposta;
    };
  });
  const { conta, id, series, dialogo, primeira, segunda } = await abrirConflitosDoBackup(page);
  await page.evaluate(serie => {
    window.provaDaContagem.serie = serie;
    window.provaDaContagem.modo = "reter antes";
  }, series[0].id);
  const usar = primeira.getByRole("button", { name: "Usar a contagem do aparelho", exact: true });
  await usar.click();
  await expect.poll(() => page.evaluate(() => window.provaDaContagem.estado)).toBe("retida");
  await atualizarNoMock(conta, "session_sets", "id=eq." + series[0].id, { reps: 17, carga_kg: 41.5 });
  await page.evaluate(() => window.provaDaContagem.liberar());
  await primeira.getByRole("button", { name: "Rever valores", exact: true }).click();
  await expect(primeira).toContainText("17");
  const remota = () => lerDoMock(conta, "session_sets", "id=eq." + series[0].id);
  expect(await remota()).toMatchObject([{ reps: 17, carga_kg: 41.5 }]);

  await page.evaluate(() => { window.provaDaContagem.modo = "perder resposta"; });
  await usar.click();
  await expect.poll(() => page.evaluate(() => window.provaDaContagem.estado)).toBe("resposta perdida");
  expect(await remota()).toMatchObject([{ reps: 10, carga_kg: 41.5 }]);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(primeira).toHaveCount(0);
  await segunda.getByRole("button", { name: "Manter a série do histórico", exact: true }).click();
  await expect(segunda).toHaveCount(0);
  await expect(dialogo).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(0);
  const fim = await lerDoMock(conta, "session_sets", "session_id=eq." + id + "&order=set_index.asc");
  expect(fim).toMatchObject([
    { id: series[0].id, reps: 10, carga_kg: 41.5 },
    { id: series[1].id, reps: 18, exercise_id: "flexao-de-braco" },
  ]);
});

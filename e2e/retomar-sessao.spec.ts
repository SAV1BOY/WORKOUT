import { expect, test } from "@playwright/test";
import {
  atualizarNoMock, comecarNoPlayer, entrarNoApp, fixarData, HOJE_FIXO, inserirNoMock,
  lerDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";

test.use({ serviceWorkers: "block" });

test("um treino encerrado em outro aparelho não desvia o clique de começar em /treinar", async ({ page }) => {
  await resetarMock();
  const conta = await usuarioComPerfil();
  const antigo = "f4fc775e-597b-4b10-abc9-872cb50e0a82";
  await inserirNoMock(conta, "sessions", [{
    id: antigo, workout_id: "A1", fase: "fase1", data: "2026-09-11",
    status: "em_andamento", iniciada_em: "2026-09-11T10:00:00.000Z",
  }]);
  await fixarData(page, HOJE_FIXO);
  await entrarNoApp(page);

  // O aparelho viu e guardou a sessão aberta antes de ela ser encerrada no outro.
  await expect.poll(() => page.evaluate(id => new Promise<boolean>(resolve => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => resolve(false);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const ler = banco.transaction("cache").objectStore("cache").get("react-query-v1");
      ler.onsuccess = () => {
        banco.close();
        const consultas = ler.result?.valor?.estado.queries ?? [];
        resolve(consultas.some((q: { queryKey: string[]; state: { data: { id: string }[] } }) =>
          q.queryKey[0] === "sessoes-abertas" && q.state.data.some(s => s.id === id)));
      };
      ler.onerror = () => { banco.close(); resolve(false); };
    };
  }), antigo)).toBe(true);
  await atualizarNoMock(conta, "sessions", `id=eq.${antigo}`, {
    status: "concluida", concluida_em: "2026-09-11T10:30:00.000Z",
  });

  let liberar!: () => void;
  const liberada = new Promise<void>(resolver => { liberar = resolver; });
  const listaDeAbertas = (url: URL) =>
    url.pathname === "/rest/v1/sessions" && url.searchParams.get("status") === "eq.em_andamento";
  const consulta = page.waitForRequest(req => listaDeAbertas(new URL(req.url())));
  await page.route(listaDeAbertas, async rota => { await liberada; await rota.continue(); });
  try {
    await page.goto("/treinar", { waitUntil: "domcontentloaded" });
    await consulta;
    await page.getByRole("button", { name: "Começar o Treino A" }).click();
    await expect(page).toHaveURL(url => /^\/treinar\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(antigo));
  } finally {
    liberar();
  }
  await comecarNoPlayer(page);
  await expect(page).not.toHaveURL(new RegExp(antigo));
  const novo = page.url().split("/").pop();
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${novo}`)).toMatchObject([{
    workout_id: "A1", status: "em_andamento", data: "2026-09-14",
  }]);
});

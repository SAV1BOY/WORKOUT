import { performance } from "node:perf_hooks";
import { expect, test } from "@playwright/test";
import {
  entrarNoApp, fixarData, inserirNoMock, requisicoesDoMock,
  resetarMock, usuarioComPerfil,
} from "./fixtures";

// Medição manual de seis minutos. A suíte normal não depende da velocidade do host.
if (process.env.E2E_MEDIR_SESSAO === "1") {
  test("mede seis aberturas frias e o tráfego de autenticação por seis minutos", async ({
    page, browser, baseURL,
  }) => {
    test.setTimeout(10 * 60_000);
    await resetarMock();
    const sessao = await usuarioComPerfil();
    await fixarData(page);
    await entrarNoApp(page);
    const { cookies } = await page.context().storageState();
    const id = "ac38d414-fe6c-4782-8dc8-0b4d13dfb2b3";
    await inserirNoMock(sessao, "sessions", [{
      id, data: "2026-09-14", workout_id: "A1", fase: "fase1",
      status: "em_andamento", iniciada_em: "2026-09-14T12:00:00.000Z",
    }]);
    const novoContexto = () => browser.newContext({
      baseURL, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true,
      locale: "pt-BR", timezoneId: "America/Sao_Paulo",
      storageState: { cookies, origins: [] },
    });
    const aberturasMs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const contexto = await novoContexto();
      const aba = await contexto.newPage();
      await fixarData(aba);
      const cdp = await contexto.newCDPSession(aba);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 80, downloadThroughput: 1_125_000, uploadThroughput: 187_500,
      });
      const inicio = performance.now();
      await aba.goto(`/treinar/${id}`, { waitUntil: "commit" });
      await aba.getByRole("button", { name: /Começar agora|Concluir série/i }).first()
        .waitFor({ state: "visible", timeout: 35_000 });
      aberturasMs.push(Math.round(performance.now() - inicio));
      await contexto.close();
    }
    const contarAutenticacao = async () => (await requisicoesDoMock()).filter((r) =>
      r.metodo === "GET" && r.caminho.startsWith("/auth/v1/user"),
    ).length;
    const contextos = await Promise.all([novoContexto(), novoContexto()]);
    const abas = await Promise.all(contextos.map((contexto) => contexto.newPage()));
    const antes = await contarAutenticacao();
    const inicio = performance.now();
    const rotas = ["/", "/corpo", "/calendario", "/mais"];
    for (let i = 0; i < 24; i++) {
      const rota = rotas[i % rotas.length]!;
      await Promise.all(abas.map(async (aba) => {
        await aba.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(aba.locator("main")).toBeVisible();
      }));
      const proxima = inicio + (i + 1) * 15_000;
      await new Promise((pronto) => setTimeout(pronto, Math.max(0, proxima - performance.now())));
    }
    const consultasDeAutenticacao = await contarAutenticacao() - antes;
    console.log(JSON.stringify({ aberturasMs, consultasDeAutenticacao }));
    await Promise.all(contextos.map((contexto) => contexto.close()));
  });
}

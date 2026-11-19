import { expect, test } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  abrirSecaoDoRelatorio, entrarNoApp, esperarServiceWorker, fixarData, inserirNoMock,
  resetarMock, usuarioComPerfil,
} from "./fixtures";
import { semRedeNoWorker, workerDoApp } from "./rede-do-worker";

test("o relatório reabre suas séries offline depois que o documento da versão anterior perde um chunk", async ({ page, context }) => {
  test.slow(); // Instala o worker e abre um segundo documento no mesmo aparelho.
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil();
  const titulo = "Supino de segunda";
  const sessao = crypto.randomUUID();
  const exercicio = "supino-reto-com-barra";
  await inserirNoMock(conta, "sessions", [{
    id: sessao, data: "2026-09-14", workout_id: "livre", fase: "fase1", status: "concluida",
    iniciada_em: "2026-09-14T09:00:00Z", concluida_em: "2026-09-14T09:30:00Z", duracao_s: 1800,
    plano: planoDaSessao(itensDeIds([exercicio]), { titulo }),
  }]);
  await inserirNoMock(conta, "session_sets", [{
    id: crypto.randomUUID(), session_id: sessao, exercise_id: exercicio, ordem_ex: 1, set_index: 1,
    tipo: "trabalho", reps: 8, carga_kg: 22.5, concluida: true, registrada_em: "2026-09-14T09:10:00Z",
  }]);

  // Começamos a instalação depois de preparar a mesma Cache Storage deixada pelo build anterior.
  await page.addInitScript(() => {
    const registrar = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = async (...args) => {
      if (!sessionStorage.getItem("instalar-worker-do-teste")) {
        await new Promise<void>(resolve => window.addEventListener("instalar-worker-do-teste", () => resolve(), { once: true }));
      }
      return registrar(...args);
    };
  });
  await entrarNoApp(page);
  const documento = await page.goto("/relatorio");
  expect(documento?.fromServiceWorker()).toBe(false);
  await abrirSecaoDoRelatorio(page, "historico");
  const registro = page.getByRole("list", { name: "Registros", exact: true }).getByRole("listitem").filter({ hasText: titulo });
  await expect(registro.getByText("30 min · 1 série", { exact: true })).toBeVisible();

  const dependencia = await page.evaluate(async (html) => {
    const scripts = [...new DOMParser().parseFromString(html, "text/html").querySelectorAll("script[src]")]
      .map(s => decodeURIComponent(new URL(s.getAttribute("src")!, location.origin).pathname));
    const pagina = scripts.find(s => /\/relatorio\/page-[\da-f]+\.js$/.test(s));
    if (!pagina) throw new Error("O documento do Relatório precisa carregar o chunk da sua página.");
    const anterior = pagina.replace(/page-[\da-f]+\.js$/, "page-0000000000000047.js");
    // O webpack e o main-app continuam disponíveis. Só a dependência específica da rota
    // pertence ao build que saiu do aparelho, como na atualização observada entre duas versões.
    const arquivo = pagina.slice(pagina.lastIndexOf("/") + 1);
    const arquivoAnterior = anterior.slice(anterior.lastIndexOf("/") + 1);
    const antigo = html.replaceAll(arquivo, arquivoAnterior);
    if (antigo === html) throw new Error("A cópia legada precisa referenciar o chunk ausente.");
    const paginas = await caches.open("paginas");
    await paginas.put("/relatorio", new Response(antigo, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
    return { anterior, arquivoAnterior, bootstrap: scripts.filter(s => /\/(webpack|main-app)-[\da-f]+\.js$/.test(s)) };
  }, await documento!.text());
  expect(dependencia.bootstrap).toHaveLength(2);
  await page.evaluate(() => {
    sessionStorage.setItem("instalar-worker-do-teste", "1");
    window.dispatchEvent(new Event("instalar-worker-do-teste"));
  });
  await esperarServiceWorker(page);
  const cache = await page.evaluate(async ({ anterior, bootstrap }) => ({
    antiga: !!await caches.match(anterior, { ignoreSearch: true }),
    bootstrap: await Promise.all(bootstrap.map(async s => !!await caches.match(s, { ignoreSearch: true }))),
  }), dependencia);
  expect(cache).toEqual({ antiga: false, bootstrap: [true, true] });
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);

  const reaberta = await context.newPage();
  const servida = await reaberta.goto("/relatorio", { waitUntil: "domcontentloaded" });
  expect(servida?.fromServiceWorker()).toBe(true);
  expect((await servida!.text()).includes(dependencia.arquivoAnterior),
    "o documento entregue ao navegador precisa abrir com os arquivos que continuam no aparelho").toBe(false);
  await abrirSecaoDoRelatorio(reaberta, "historico");
  await reaberta.getByRole("listitem").filter({ hasText: titulo }).getByRole("button", { name: /^Ver séries/ }).click();
  const detalhe = reaberta.getByRole("dialog", { name: "Séries do treino", exact: true });
  await expect(detalhe.getByRole("region", { name: /Supino reto com barra/ })).toContainText("8 repetições · 22,5 kg na barra");
});

test("uma aba já aberta consegue pedir um módulo da versão anterior pela primeira vez sem rede", async ({ page, context }) => {
  const chunk = "/_next/static/chunks/2162.a1b2c3d4e5f67890.js";
  const privados = [
    { url: "/relatorio?aba=antiga", tipo: "text/html" },
    { url: "/relatorio?_rsc=antigo", tipo: "text/x-component" },
    { url: "/rest/v1/session_sets?select=id", tipo: "application/json" },
    { url: "/_next/static/chunks/2167-abcdef9876543210.js", tipo: "text/html" },
  ];

  // A versão antiga depositou o módulo no precache na instalação. A aba que vai
  // usá-lo ainda não existe e o navegador não tem uma cópia no cache HTTP.
  const instalacaoAnterior = await context.newPage();
  await instalacaoAnterior.route("**/__instalacao-anterior", rota => rota.fulfill({ contentType: "text/html; charset=utf-8", body: "<title>Instalação</title>" }));
  await instalacaoAnterior.route("**" + chunk, rota => rota.fulfill({
    contentType: "application/javascript; charset=utf-8", body: 'document.querySelector("output").textContent = "Histórico aberto";',
  }));
  await instalacaoAnterior.goto("/__instalacao-anterior");
  await instalacaoAnterior.evaluate(async ({ chunk, privados }) => {
    const precache = await caches.open("serwist-precache-v2-" + location.origin + "/");
    await precache.put(chunk, await fetch(chunk, { cache: "no-store" }));
    for (const { url, tipo } of privados) {
      await precache.put(url, new Response("registro de teste", { headers: { "Content-Type": tipo } }));
    }
  }, { chunk, privados });
  await instalacaoAnterior.close();

  // Como o import de Histórico na aba antiga, este documento pede o JS só ao toque.
  await page.route("**/__aba-da-versao-anterior", rota => rota.fulfill({
    contentType: "text/html; charset=utf-8",
    body: `<button type="button">Histórico</button><output></output>
      <script>document.querySelector("button").onclick = () => {
        const script = document.createElement("script");
        script.src = "${chunk}";
        script.onerror = () => { document.querySelector("output").textContent = "Módulo indisponível"; };
        document.head.append(script);
      };</script>`,
  }));
  let pedidosDoModulo = 0;
  const respostasDoModulo: boolean[] = [];
  page.on("request", pedido => {
    if (new URL(pedido.url()).pathname === chunk) pedidosDoModulo++;
  });
  page.on("response", resposta => {
    if (new URL(resposta.url()).pathname === chunk) respostasDoModulo.push(resposta.fromServiceWorker());
  });
  await page.goto("/__aba-da-versao-anterior");
  await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); });
  await esperarServiceWorker(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  expect(pedidosDoModulo).toBe(0);
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.locator("output")).toHaveText("Histórico aberto");
  expect(pedidosDoModulo).toBe(1);
  expect(respostasDoModulo).toEqual([true]);

  const copiasPrivadas = await page.evaluate(async entradas => {
    const guardadas = [];
    for (const { url } of entradas) if (await caches.match(url, { ignoreVary: true })) guardadas.push(url);
    return guardadas;
  }, privados);
  expect(copiasPrivadas).toEqual([]);
});

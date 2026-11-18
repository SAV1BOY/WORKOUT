import { expect, test, type Page } from "@playwright/test";
import { CACHE_DE_MIDIA, CACHE_DO_CATALOGO } from "../lib/caches-do-worker";
import { LIMITE_CATALOGO } from "../lib/midia-no-aparelho";
import { entrarNoApp, esperarServiceWorker, fixarData, irNaAba, lerDoMock, resetarMock, usuarioComPerfil } from "./fixtures";

const ABAS = ["Treino", "Explorar", "Relatório", "Corpo", "Mais"] as const;

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, "2026-09-14T09:00:00-03:00");
});

for (const tema of ["claro", "escuro"] as const) {
  test(`as cinco abas hidratam com o tema escolhido e sinalizam a perda e a volta da rede — ${tema}`, async ({ page, context }) => {
    test.slow(); // Cinco navegações e dez mudanças de conectividade.
    const erros: string[] = [];
    const hidratacao = /hydrat|react\.dev\/errors\/418|react error #418/i;
    page.on("pageerror", erro => erros.push(erro.message));
    page.on("console", msg => {
      if (msg.type() === "error" && hidratacao.test(msg.text())) erros.push(msg.text());
    });
    await page.emulateMedia({ colorScheme: tema === "claro" ? "dark" : "light" });
    await usuarioComPerfil({ prefs: { tema } });
    await entrarNoApp(page);
    // O horário só existe depois da primeira gravação de dados neste aparelho.
    await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolver) => {
      const abertura = indexedDB.open("treino-terraco");
      abertura.onerror = () => resolver(false);
      abertura.onsuccess = () => {
        const banco = abertura.result;
        if (!banco.objectStoreNames.contains("cache")) {
          banco.close();
          resolver(false);
          return;
        }
        const registro = banco.transaction("cache").objectStore("cache").get("react-query-v1");
        registro.onsuccess = () => { banco.close(); resolver(Boolean(registro.result?.valor?.sincronizadoEm)); };
        registro.onerror = () => { banco.close(); resolver(false); };
      };
    })), { message: "a primeira leitura da rede tem de estar no aparelho" }).toBe(true);
    for (const aba of ABAS) {
      await irNaAba(page, aba);
      await expect(page.getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: aba, exact: true })).toHaveAttribute("aria-current", "page");
      const cor = tema === "claro" ? "#e0e0dd" : "#0a0a0a";
      await expect.poll(async () => page.locator('meta[name="theme-color"]').evaluateAll(
        (metas, esperada) => metas.length > 0 && metas.every(el => el.getAttribute("content") === esperada),
        cor,
      )).toBe(true);
      await context.setOffline(true);
      const aviso = page.getByRole("status").filter({ hasText: /Sem rede · mostrando/ });
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(/às \d{2}:\d{2}/);
      await context.setOffline(false);
      await expect(aviso).toHaveCount(0);
    }
    expect(erros).toEqual([]);
  });
}

test("a navegação mantém as cinco abas ao alcance a 200% de zoom", async ({ page }) => {
  test.slow(); // Exercita o clique e a navegação em cada uma das cinco abas.
  await usuarioComPerfil();
  await entrarNoApp(page);
  await page.setViewportSize({ width: 180, height: 740 });
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  for (const aba of ABAS) {
    const link = nav.getByRole("link", { name: aba, exact: true });
    await link.scrollIntoViewIfNeeded();
    const posicao = await link.boundingBox();
    expect(posicao?.x).toBeGreaterThanOrEqual(0);
    expect((posicao?.x ?? 0) + (posicao?.width ?? 0)).toBeLessThanOrEqual(181);
    expect(posicao?.width).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
  }
});

test("sem rede o backup explica a espera e desativa importação e exportação", async ({ page, context }) => {
  await usuarioComPerfil();
  await entrarNoApp(page);
  await page.goto("/mais/backup");
  const exportar = page.getByRole("button", { name: "Exportar backup" });
  const importar = page.locator('input[type="file"]');
  await expect(exportar).toBeEnabled();
  await context.setOffline(true);
  await expect(exportar).toBeDisabled();
  await expect(importar).toBeDisabled();
  await expect(page.getByText(/precisa de rede para ler/i)).toBeVisible();
  await context.setOffline(false);
  await expect(exportar).toBeEnabled();
  await expect(importar).toBeEnabled();
});

test("o peso salvo sem rede aparece na fila e a sincronização atualiza o mesmo aviso", async ({ page, context }) => {
  const sessao = await usuarioComPerfil();
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.goto("/mais");
  await expect(page.getByText("Tudo sincronizado", { exact: true })).toBeVisible();
  await irNaAba(page, "Corpo");
  const peso = page.getByLabel("Peso (kg)", { exact: true });
  await expect(peso).toBeVisible();
  await context.setOffline(true);
  await peso.fill("82,4");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByText(/registrado no celular.*rede voltar/i)).toBeVisible();
  const mais = page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: /mais.*esperando a rede/i });
  await expect(mais).toBeVisible();
  await mais.click();
  const sync = page.locator("#sincronizacao");
  await expect(sync.getByRole("button", { name: "Sem rede" })).toBeDisabled();
  const aviso = sync.getByRole("status");
  await expect(aviso).toContainText(/1 item esperando/i);
  await aviso.evaluate(el => el.setAttribute("data-prova-do-no", "mesmo"));
  expect(await lerDoMock(sessao, "body_weights")).toHaveLength(0);
  await context.setOffline(false);
  await expect(aviso).toContainText("Tudo sincronizado");
  await expect(aviso).toHaveAttribute("data-prova-do-no", "mesmo");
  await expect(page.getByText("1 registro subiu.", { exact: true })).toHaveCount(1);
  await expect(mais).toHaveCount(0);
  expect(await lerDoMock(sessao, "body_weights")).toHaveLength(1);
});

test("o convite de instalação recebido em outra aba é oferecido em Mais", async ({ page, request }) => {
  const manifesto = await (await request.get("/manifest.webmanifest")).json();
  expect(manifesto).toMatchObject({ start_url: "/", display: "standalone", lang: "pt-BR" });
  await usuarioComPerfil();
  await entrarNoApp(page);
  await page.evaluate(() => {
    const evento = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => { document.body.dataset.conviteAcionado = "sim"; },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(evento);
  });
  await irNaAba(page, "Mais");
  const instalar = page.getByRole("button", { name: "Instalar o aplicativo" });
  await instalar.click();
  await expect(page.locator("body")).toHaveAttribute("data-convite-acionado", "sim");
  await expect(instalar).toHaveCount(0);
});

for (const instalado of [false, true]) {
  test(`orientação de instalação no iPhone, instalado=${instalado}`, async ({ page }) => {
    await page.addInitScript((jaInstalado: boolean) => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, value: "iPhone" });
      Object.defineProperty(navigator, "standalone", { configurable: true, value: jaInstalado });
    }, instalado);
    await usuarioComPerfil();
    await entrarNoApp(page);
    await irNaAba(page, "Mais");
    const secao = page.getByRole("region", { name: "Uso no celular" });
    await expect(secao).toBeVisible();
    await expect(secao.getByText(/Compartilhar no Safari/)).toHaveCount(instalado ? 0 : 1);
    await expect(secao.getByRole("button", { name: "Instalar o aplicativo" })).toHaveCount(0);
  });
}

async function temArquivo(page: Page, nome: string, chave: string): Promise<boolean> {
  return page.evaluate(async ({ nome, chave }) => {
    if (!await caches.has(nome)) return false;
    return Boolean(await (await caches.open(nome)).match(chave));
  }, { nome, chave });
}

test("o limite do catálogo e a limpeza preservam a figura do treino offline", async ({ page, context }) => {
  await usuarioComPerfil();
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  const figura = "/figuras/agachamento-livre.svg";
  const antiga = "/fotos/prova-do-teto.jpg";
  const recente = "/fotos/supino-inclinado-com-halteres-1.jpg?prova=limite";
  await page.evaluate(async ({ figura, antiga, recente, limite, nome }) => {
    await (await fetch(figura)).arrayBuffer();
    const cache = await caches.open(nome);
    await cache.put(antiga, new Response(new Uint8Array(limite + 1), { headers: { "Content-Type": "image/jpeg" } }));
    await (await fetch(recente)).arrayBuffer();
  }, { figura, antiga, recente, limite: LIMITE_CATALOGO, nome: CACHE_DO_CATALOGO });
  await expect.poll(() => temArquivo(page, CACHE_DO_CATALOGO, recente)).toBe(true);
  await expect.poll(() => temArquivo(page, CACHE_DO_CATALOGO, antiga)).toBe(false);
  await expect.poll(() => temArquivo(page, CACHE_DE_MIDIA, figura)).toBe(true);
  await irNaAba(page, "Mais");
  const uso = page.getByRole("region", { name: "Uso no celular" });
  await expect(uso.getByText(/Mídia baixada/)).toBeVisible();
  await uso.getByRole("button", { name: "Liberar espaço do catálogo" }).click();
  await expect(uso.getByRole("status")).toContainText("Espaço do catálogo liberado.");
  expect(await temArquivo(page, CACHE_DO_CATALOGO, recente)).toBe(false);
  await context.setOffline(true);
  expect(await page.evaluate(async caminho => (await fetch(caminho)).ok, figura)).toBe(true);
});

test("Mais alinha os ícones, recua os divisores e só carrega as subpáginas ao abrir", async ({ page }) => {
  test.slow(); // Percorre Mais e três telas de ajustes, com o prefetch desabilitado.
  await usuarioComPerfil();
  await entrarNoApp(page);
  await page.goto("/mais");
  const ajustes = page.getByRole("navigation", { name: "Ajustes" });
  await expect(ajustes.getByRole("link").first()).toBeVisible();
  const linhas = await ajustes.getByRole("link").evaluateAll(links => links.map(link => {
    const icone = link.querySelector("svg")!.getBoundingClientRect();
    const titulo = link.querySelector("span span")!.getBoundingClientRect();
    const divisao = getComputedStyle(link.parentElement!, "::after");
    return {
      desvio: Math.abs(icone.top + icone.height / 2 - titulo.top - titulo.height / 2),
      inicio: parseFloat(divisao.left),
      texto: titulo.left - link.getBoundingClientRect().left,
      altura: link.getBoundingClientRect().height,
    };
  }));
  for (const [i, linha] of linhas.entries()) {
    expect(linha.desvio).toBeLessThanOrEqual(4);
    expect(linha.altura).toBeGreaterThanOrEqual(64);
    if (i + 1 < linhas.length) expect(Math.abs(linha.inicio - linha.texto)).toBeLessThanOrEqual(1);
  }
  await expect(page.getByRole("link", { name: /Trocar senha/ })).not.toContainText("temporária");
  // O prefetch é disparado quando as linhas entram no viewport e o navegador fica ocioso.
  await page.waitForTimeout(2_000);
  const antecipadas = await page.evaluate(() => performance.getEntriesByType("resource")
    .map(e => new URL(e.name))
    .filter(u => u.pathname.startsWith("/mais/") && u.searchParams.has("_rsc"))
    .map(u => u.pathname));
  expect(antecipadas).toEqual([]);
  await ajustes.getByRole("link", { name: /Preferências/ }).click();
  await expect(page.getByLabel("Preparação (segundos)")).toBeVisible();
  await expect(page.getByLabel("Descanso padrão (segundos)")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/SPEC|\b(?:player|timer|card)s?\b|\s=\s|\(s\)/i);
  await page.getByRole("link", { name: "Ver os créditos" }).click();
  await expect(page.getByRole("heading", { name: "Créditos", exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("SPEC");
  await page.goto("/mais/equipamento");
  await expect(page.getByRole("heading", { name: "Equipamento", exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/upgrade|ver 'anilhas'/i);
});

import { describe, expect, it, vi } from "vitest";
import { PEDIR_CONTROLE_DO_WORKER, pedirControleDaPagina } from "@/lib/controle-do-worker";

const origem = "https://treino.example";

function criarWorker(scriptURL = origem + "/sw.js", state: ServiceWorkerState = "activated") {
  const postMessage = vi.fn();
  return { ativo: { scriptURL, state, postMessage } as unknown as ServiceWorker, postMessage };
}

function registro(active: ServiceWorker | null, scope = origem + "/") {
  return { active, scope } as ServiceWorkerRegistration;
}

describe("controle da página aberta durante a ativação", () => {
  it.each(["activating", "activated"] as const)("solicita uma vez ao worker %s do app", async (estado) => {
    const { ativo, postMessage } = criarWorker(undefined, estado);
    const ready = Promise.resolve(registro(ativo));
    pedirControleDaPagina({ controller: null, ready }, origem);
    await ready;
    expect(postMessage.mock.calls).toEqual([[PEDIR_CONTROLE_DO_WORKER]]);
  });

  it.each([
    { caso: "escopo em outro site", scope: "https://outra.example/" },
    { caso: "escopo em outra rota", scope: origem + "/outro/" },
    { caso: "script em outro site", script: "https://outra.example/sw.js" },
    { caso: "outro script na mesma origem", script: origem + "/antigo.js" },
    { caso: "worker substituído", estado: "redundant" as const },
  ])("ignora $caso", async ({ scope, script, estado }) => {
    const { ativo, postMessage } = criarWorker(script, estado);
    const ready = Promise.resolve(registro(ativo, scope));
    pedirControleDaPagina({ controller: null, ready }, origem);
    await ready;
    expect(postMessage).not.toHaveBeenCalled();
  });

  it.each(["desmontagem", "controle adquirido"] as const)("ignora um registro tardio após %s", async (evento) => {
    const { ativo, postMessage } = criarWorker();
    const { promise, resolve } = Promise.withResolvers<ServiceWorkerRegistration>();
    const container = { controller: null as ServiceWorker | null, ready: promise };
    const cancelar = pedirControleDaPagina(container, origem);
    if (evento === "desmontagem") cancelar();
    else container.controller = ativo;
    resolve(registro(ativo));
    await promise;
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("preserva o controle que a página já possui", async () => {
    const { ativo, postMessage } = criarWorker();
    const ready = Promise.resolve(registro(ativo));
    pedirControleDaPagina({ controller: ativo, ready }, origem);
    await ready;
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("permite desmontar sem service worker, sem worker ativo ou quando o registro falha", async () => {
    pedirControleDaPagina(undefined, origem)();
    const ready = Promise.resolve(registro(null));
    const semAtivo = pedirControleDaPagina({ controller: null, ready }, origem);
    await ready;
    semAtivo();

    const falha = Promise.reject<ServiceWorkerRegistration>(new Error("Registro indisponível"));
    const aoFalhar = pedirControleDaPagina({ controller: null, ready: falha }, origem);
    await falha.catch(() => {});
    aoFalhar();
  });
});

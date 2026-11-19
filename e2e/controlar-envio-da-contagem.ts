import type { Page } from "@playwright/test";

declare global {
  interface Window {
    envioDaContagem: {
      id: string;
      modo: "normal" | "reter antes" | "perder resposta";
      estado: "inicial" | "retida" | "resposta perdida";
      liberar: () => void;
    };
  }
}

export async function controlarEnvioDaContagem(page: Page, tabela: "session_sets" | "cardio_sessions") {
  await page.addInitScript(tabela => {
    const buscar = window.fetch.bind(window);
    let liberar!: () => void;
    const espera = new Promise<void>(resolve => { liberar = resolve; });
    window.envioDaContagem = { id: "", modo: "normal", estado: "inicial", liberar };
    window.fetch = async (entrada, opcoes) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada), location.href);
      const metodo = opcoes?.method ?? (entrada instanceof Request ? entrada.method : "GET");
      const prova = window.envioDaContagem;
      const alvo = metodo === "PATCH" && url.pathname === "/rest/v1/" + tabela && url.searchParams.get("id") === "eq." + prova.id;
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
  }, tabela);
}

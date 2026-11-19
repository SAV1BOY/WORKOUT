import { describe, expect, it, vi } from "vitest";
import { navegacaoGuardadaServe } from "@/lib/sw-documento-guardado";
import { CABECALHO_DO_BUILD, type PedidoDeNavegacao } from "@/lib/sw-navegacao";

const build = "2026-11-19T10:00:00.000Z";
function pedido(caminho: string, rsc = false): PedidoDeNavegacao {
  return { destino: rsc ? "" : "document", modo: rsc ? "cors" : "navigate", rsc: rsc ? "1" : null, url: `https://exemplo.com${caminho}` };
}
function copia(tipo: string, versao?: string, corpo = "") {
  const headers = new Headers({ "Content-Type": `${tipo}; charset=utf-8` });
  if (versao) headers.set(CABECALHO_DO_BUILD, versao);
  return new Response(corpo, { headers });
}

describe("navegação que restou no aparelho durante uma troca de build", () => {
  it.each(["/", "/relatorio", "/calendario", "/calendario?dia=2026-08-18", "/treinar/44a8ded3-55c2-43c6-9cf6-68b0cf77cc87",
    "/cardio/corda?sessao=44a8ded3-55c2-43c6-9cf6-68b0cf77cc87"])(
    "deixa o shell atual remontar %s se o HTML é antigo, inclusive sem o cabeçalho", async caminho => {
      const temAsset = vi.fn(async () => true);
      for (const versao of [undefined, "anterior"]) {
        expect(await navegacaoGuardadaServe(pedido(caminho), copia("text/html", versao), build, temAsset)).toBe(false);
      }
      expect(temAsset).not.toHaveBeenCalled();
      expect(await navegacaoGuardadaServe(pedido(caminho), copia("text/html", build), build, temAsset)).toBe(true);
    },
  );

  it("aceita só o payload RSC do próprio build na navegação suave", async () => {
    const temAsset = vi.fn(async () => true);
    const suave = pedido("/mais?_rsc=a", true);
    for (const versao of [undefined, "anterior"]) {
      expect(await navegacaoGuardadaServe(suave, copia("text/x-component", versao), build, temAsset)).toBe(false);
    }
    expect(await navegacaoGuardadaServe(suave, copia("text/x-component", build), build, temAsset)).toBe(true);
    expect(await navegacaoGuardadaServe(suave, copia("text/html", build), build, temAsset)).toBe(false);
    expect(await navegacaoGuardadaServe(pedido("/mais"), copia("text/x-component", build), build, temAsset)).toBe(false);
  });

  it("preserva as outras páginas inteiras e reconhece quando falta o último dos quarenta pedaços", async () => {
    const scripts = Array.from({ length: 39 }, (_, i) => `<script src="/_next/static/${i}.js"></script>`).join("");
    const corpo = scripts + '<link rel="stylesheet" href="/_next/static/layout.css">';
    const rota = pedido("/exercicios/flexao");
    for (const versao of [undefined, "anterior", build]) {
      const html = copia("text/html", versao, corpo);
      expect(await navegacaoGuardadaServe(rota, html, build, async () => true)).toBe(true);
      expect(await navegacaoGuardadaServe(rota, html, build, async url => !url.endsWith("layout.css"))).toBe(false);
      expect(html.bodyUsed).toBe(false);
    }
  });
});

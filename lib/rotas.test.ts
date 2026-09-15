import { describe, expect, it } from "vitest";
import { destinoInterno } from "@/lib/rotas";

/**
 * O `?next=` do `/auth/callback` vem de fora. Estes casos são os jeitos
 * conhecidos de fazer uma origem + um pedaço de texto virarem OUTRO site.
 */
describe("destinoInterno", () => {
  it("deixa passar caminho interno", () => {
    expect(destinoInterno("/")).toBe("/");
    expect(destinoInterno("/progresso")).toBe("/progresso");
    expect(destinoInterno("/cardio/corrida?semana=3")).toBe(
      "/cardio/corrida?semana=3",
    );
  });

  it("sem pedido nenhum volta para a Hoje", () => {
    expect(destinoInterno(null)).toBe("/");
    expect(destinoInterno(undefined)).toBe("/");
    expect(destinoInterno("")).toBe("/");
    expect(destinoInterno("   ")).toBe("/");
  });

  it("recusa o que sai do site", () => {
    // o clássico: "https://treino.app" + "@site.ruim" tem host site.ruim
    expect(destinoInterno("@site.ruim")).toBe("/");
    expect(destinoInterno("//site.ruim")).toBe("/");
    expect(destinoInterno("/\\site.ruim")).toBe("/");
    expect(destinoInterno("https://site.ruim")).toBe("/");
    expect(destinoInterno("javascript:alert(1)")).toBe("/");
    expect(destinoInterno("site.ruim")).toBe("/");
  });

  it("recusa quebra de linha (injeção no cabeçalho Location)", () => {
    expect(destinoInterno("/ok\r\nSet-Cookie: a=b")).toBe("/");
    expect(destinoInterno("/ok\nX: y")).toBe("/");
  });

  it("o que volta sempre cola na origem sem trocar de host", () => {
    const origem = "https://treino.exemplo.app";
    const pedidos = [
      "@site.ruim",
      "//site.ruim",
      "/\\site.ruim",
      "https://site.ruim",
      "/progresso",
      "/",
    ];
    for (const pedido of pedidos) {
      const destino = new URL(destinoInterno(pedido), origem);
      expect(destino.host, `pedido ${pedido}`).toBe("treino.exemplo.app");
    }
  });
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  /*
   * O tsconfig tem `"jsx": "preserve"` (quem compila o JSX é o Next). Os testes
   * que desenham um componente no servidor (`renderToStaticMarkup`) precisam do
   * JSX transformado: runtime automático do React, só aqui.
   */
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
    /*
     * O app é de um usuário só, em Nova Lima/MG: datas, semanas e o "hoje" do
     * motor são sempre de relógio local (SPEC §5). Sem fixar o fuso, o mesmo
     * teste passa na máquina do dono (UTC−3) e falha no CI (UTC) — ou pior,
     * passa nos dois escondendo um defeito de fuso. O Playwright já roda com
     * `timezoneId: "America/Sao_Paulo"`; aqui é o mesmo fuso.
     */
    env: { TZ: "America/Sao_Paulo" },
  },
});

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // gerado pelo Serwist no build
      "public/**",
      /*
       * Rastros e capturas que o Playwright deixa quando um e2e falha. Não é
       * código nosso — e o JS que vai dentro do trace (bundles de terceiros)
       * fazia `npm run lint` FALHAR depois de uma suíte com falha, o que
       * transformava o portão numa loteria.
       */
      "test-results/**",
      "playwright-report/**",
    ],
  },
];

export default eslintConfig;

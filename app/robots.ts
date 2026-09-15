import type { MetadataRoute } from "next";

/**
 * Um app pessoal atrás de login não tem nada a indexar — e sem este arquivo o
 * Next devolve o HTML da aplicação em `/robots.txt`, o que o Lighthouse marca
 * como robots.txt inválido.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

import type { MetadataRoute } from "next";

/**
 * O manifest da instalação (SPEC §8).
 *
 * §22.4 item 5: ganhou os **atalhos** do toque longo no ícone (as três telas
 * que o Miguel abre direto: o treino de hoje, o Relatório e o Corpo) e o
 * ícone maskable de 192 — sem ele o Android reescalava o de 512 e o atalho da
 * tela inicial saía borrado.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Treino do Terraço",
    short_name: "Treino",
    description:
      "Treino de força, cardio e corpo — o que fazer hoje e o registro de cada série.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icone-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Treino de hoje",
        short_name: "Treino",
        url: "/",
        icons: [{ src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Relatório",
        short_name: "Relatório",
        url: "/relatorio",
        icons: [{ src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Corpo",
        short_name: "Corpo",
        url: "/corpo",
        icons: [{ src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}

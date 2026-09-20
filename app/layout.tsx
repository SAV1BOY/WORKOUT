import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import { scriptDoVigia } from "@/lib/vigia";
import "./globals.css";

/**
 * As telas de abertura do iPhone (SPEC §22.4 item 9). Sem elas o app
 * instalado abre numa tela preta vazia até o shell pintar. Cada arquivo é
 * gerado por `npm run icones` no tamanho exato de um aparelho — o iOS não
 * reescala: ou bate, ou não mostra nada.
 */
const ABERTURAS_IOS: Array<[largura: number, altura: number, escala: number]> = [
  [1170, 2532, 3], // iPhone 12/13/14 · 390×844
  [1284, 2778, 3], // iPhone 12/13/14 Pro Max · 428×926
  [1179, 2556, 3], // iPhone 14/15/16 Pro · 393×852
  [1290, 2796, 3], // iPhone 14/15/16 Pro Max · 430×932
  [828, 1792, 2], // iPhone XR/11 · 414×896
  [750, 1334, 2], // iPhone SE/8 · 375×667
];

const startupImage = ABERTURAS_IOS.map(([largura, altura, escala]) => ({
  url: `/icons/abertura-${largura}x${altura}.png`,
  media: `(device-width: ${largura / escala}px) and (device-height: ${altura / escala}px) and (-webkit-device-pixel-ratio: ${escala}) and (orientation: portrait)`,
}));

export const metadata: Metadata = {
  title: "Treino do Terraço",
  description:
    "Treino de força e cardio: o que fazer hoje, registro por série e progressão de carga.",
  applicationName: "Treino do Terraço",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Treino",
    statusBarStyle: "black-translucent",
    startupImage,
  },
  formatDetection: { telephone: false },
  icons: {
    /*
     * SPEC §22.4 item 6: `/favicon.ico` vem de `app/favicon.ico` (gerado por
     * `npm run icones`) — antes a aba do navegador pedia esse caminho e recebia
     * 11 kB do HTML de 404. Quem declara esse arquivo é o próprio App Router,
     * e declará-lo **também** aqui (em `icon` e em `shortcut`) punha três
     * `<link>` para o mesmo ícone no `<head>` (auditoria do lote 4). Ficam só
     * os PNG, que o App Router não conhece.
     */
    icon: [
      { url: "/icons/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /*
   * A barra do sistema segue o `prefers-color-scheme` do aparelho, e o HTML
   * já sai com a cor certa. Quem escolheu "claro" no aparelho escuro (ou o
   * contrário) fica com a barra do aparelho: seguir o tema escolhido pedia
   * mexer na meta pelo cliente, e isso voltou atrás neste mesmo lote — ficou
   * para outro (SPEC §22.4 item 5 e PROGRESSO.md).
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        {/* a saída de uma tela que nunca hidratou (lib/vigia.ts) */}
        <script dangerouslySetInnerHTML={{ __html: scriptDoVigia() }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

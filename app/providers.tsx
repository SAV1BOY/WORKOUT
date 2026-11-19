"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { observarInstalacao } from "@/lib/instalar-app";
import { useTheme, ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { iniciarOutbox } from "@/lib/outbox";
import { persistirQueryClient } from "@/lib/persistencia-query";
import { marcarAppVivo } from "@/lib/vigia";
import { pedirControleDaPagina } from "@/lib/controle-do-worker";

function CorDoTema() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const cor = resolvedTheme === "dark" ? "#0a0a0a" : "#e0e0dd";
    function atualizar() {
      for (const meta of document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
        if (meta.content !== cor) meta.content = cor;
      }
    }
    // O Next pode repor as metas depois de a nova rota já estar na tela.
    // A barra do navegador acompanha também essa escrita tardia do <head>.
    const mudancas = new MutationObserver(atualizar);
    mudancas.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["name", "content"],
    });
    atualizar();
    return () => mudancas.disconnect();
  }, [resolvedTheme]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    // o React hidratou: o vigia da tela morta pode descansar (lib/vigia.ts)
    marcarAppVivo();
    iniciarOutbox((n) => toast.success(n === 1 ? "1 registro subiu." : `${n} registros subiram.`));
    const pararPedidoDeControle = pedirControleDaPagina(navigator.serviceWorker, location.origin);
    // SPEC §8: a tela abre com os dados da última sincronização
    const pararInstalacao = observarInstalacao();
    const pararCache = persistirQueryClient(cliente);
    return () => { pararPedidoDeControle(); pararInstalacao(); pararCache(); };
  }, [cliente]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <CorDoTema />
      <QueryClientProvider client={cliente}>
        {children}
        <Toaster position="bottom-center" offset={88} mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }} richColors />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

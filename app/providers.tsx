"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { iniciarOutbox } from "@/lib/outbox";
import { persistirQueryClient } from "@/lib/persistencia-query";

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
    iniciarOutbox();
    // SPEC §8: a tela abre com os dados da última sincronização
    return persistirQueryClient(cliente);
  }, [cliente]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={cliente}>
        {children}
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

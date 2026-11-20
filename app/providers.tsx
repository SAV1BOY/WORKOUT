"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { observarInstalacao } from "@/lib/instalar-app";
import { useTheme, ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LinhaPerfil } from "@/lib/types";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { observarConciliacoesDoCardio } from "@/lib/espelhos-dos-saltos";
import { observarConciliacoesDeSeries } from "@/lib/espelhos-da-contagem";
import { iniciarOutbox } from "@/lib/outbox";
import { persistirQueryClient } from "@/lib/persistencia-query";
import { marcarAppVivo } from "@/lib/vigia";
import { pedirControleDaPagina } from "@/lib/controle-do-worker";
import { EVENTO_DE_LOGIN_CONFIRMADO } from "@/lib/vinculo-do-player";

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

// Uma falha de transporte pode deixar a conta aberta após a limpeza. Um novo
// cliente volta a ler essa conta e o botão oferece repetir a saída.
const SaidaDaConta = createContext({ falhou: false, recuperar: () => {} });
export const useSaidaDaConta = () => useContext(SaidaDaConta);

type PropsDaConta = { conta: string; perfilInicial?: { valor: LinhaPerfil; atualizadoEm: number }; children: ReactNode };

export function ConsultasDaConta(props: PropsDaConta) {
  const [tentativa, renovar] = useState(0);
  return (
    <SaidaDaConta.Provider value={{ falhou: tentativa > 0, recuperar: () => renovar(n => n + 1) }}>
      <ClienteDaConta key={`${props.conta}:${tentativa}`} {...props} />
    </SaidaDaConta.Provider>
  );
}

function ClienteDaConta({ conta, perfilInicial, children }: PropsDaConta) {
  const caminho = usePathname();
  const [cliente] = useState(() => {
    const novo = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false } } });
    if (perfilInicial) novo.setQueryData(["perfil"], perfilInicial.valor, { updatedAt: perfilInicial.atualizadoEm });
    return novo;
  });
  useEffect(() => {
    if (perfilInicial && perfilInicial.atualizadoEm > (cliente.getQueryState(["perfil"])?.dataUpdatedAt ?? 0)) {
      cliente.setQueryData(["perfil"], perfilInicial.valor, { updatedAt: perfilInicial.atualizadoEm });
    }
  }, [cliente, perfilInicial]);
  useEffect(() => {
    if (caminho !== "/" || perfilInicial) return;
    const controle = new AbortController();
    const recuperar = () => {
      void import("@/lib/player-sem-rede")
        .then(({ recuperarPerfilNoTreino }) => recuperarPerfilNoTreino(cliente, conta, controle.signal))
        .catch(() => { /* Sem cópia confirmada, a consulta normal continua. */ });
    };
    window.addEventListener(EVENTO_DE_LOGIN_CONFIRMADO, recuperar);
    recuperar();
    return () => {
      controle.abort();
      window.removeEventListener(EVENTO_DE_LOGIN_CONFIRMADO, recuperar);
    };
  }, [caminho, cliente, conta, perfilInicial]);
  useEffect(() => {
    const pararCache = persistirQueryClient(cliente, conta);
    const pararCardio = observarConciliacoesDoCardio(cliente);
    const pararConciliacoes = observarConciliacoesDeSeries(cliente);
    // Uma página aberta sem rede recebe o primeiro evento online sem ter visto a desconexão anterior.
    const relerCardio = () => {
      for (const grupo of ["cardio", "cardio-desde", "cardio-sessao"]) {
        void cliente.invalidateQueries({ queryKey: [grupo] });
      }
    };
    window.addEventListener("online", relerCardio);
    return () => {
      window.removeEventListener("online", relerCardio);
      pararCache();
      pararConciliacoes();
      pararCardio();
    };
  }, [cliente, conta]);
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    marcarAppVivo();
    iniciarOutbox((n) => toast.success(n === 1 ? "1 registro subiu." : `${n} registros subiram.`));
    const pararPedidoDeControle = pedirControleDaPagina(navigator.serviceWorker, location.origin);
    const pararInstalacao = observarInstalacao();
    return () => { pararPedidoDeControle(); pararInstalacao(); };
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <CorDoTema />
      {children}
      <Toaster position="bottom-center" offset={88} mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }} richColors />
    </ThemeProvider>
  );
}

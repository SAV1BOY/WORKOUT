"use client";

import { useEffect } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { registrarEnviador } from "@/lib/outbox-supabase";
import { clienteNavegador, definirConfigSupabase } from "@/lib/supabase/client";
import { impressaoDoLogin } from "@/lib/vinculo-do-player";

/**
 * Entrega ao navegador a URL e a chave anon que o servidor leu em tempo de
 * execução (as `NEXT_PUBLIC_*` são embutidas no build, e o build acontece sem
 * elas) e liga a fila de saída. Não desenha nada.
 *
 * A configuração é escrita **durante o render**, antes dos filhos: as telas
 * chamam o cliente do Supabase já no primeiro render.
 */
export function ConfigurarSupabase({ url, chave, conta, impressao }: {
  url: string; chave: string; conta: string; impressao: string;
}) {
  definirConfigSupabase(url, chave);

  useEffect(() => {
    definirConfigSupabase(url, chave);
    registrarEnviador();
    const vinculo = { url, chave, conta, impressao };
    let ativo = true;
    const guardar = async (confirmada: string) => {
      const { guardarVinculoDoPlayer } = await import("@/lib/player-sem-rede");
      if (ativo) await guardarVinculoDoPlayer({ ...vinculo, impressao: confirmada });
    };
    void guardar(impressao).catch(() => {});
    const { data: { subscription } } = clienteNavegador().auth.onAuthStateChange((evento: AuthChangeEvent, sessao: Session | null) => {
      if (evento === "TOKEN_REFRESHED" && sessao?.user.id === conta) {
        void impressaoDoLogin(conta, url, chave, sessao.access_token).then(guardar).catch(() => {});
      }
    });
    return () => { ativo = false; subscription.unsubscribe(); };
  }, [url, chave, conta, impressao]);

  return null;
}

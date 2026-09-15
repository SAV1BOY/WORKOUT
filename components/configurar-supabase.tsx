"use client";

import { useEffect } from "react";
import { registrarEnviador } from "@/lib/outbox-supabase";
import { iniciarOutbox } from "@/lib/outbox";
import { definirConfigSupabase } from "@/lib/supabase/client";

/**
 * Entrega ao navegador a URL e a chave anon que o servidor leu em tempo de
 * execução (as `NEXT_PUBLIC_*` são embutidas no build, e o build acontece sem
 * elas) e liga a fila de saída. Não desenha nada.
 *
 * A configuração é escrita **durante o render**, antes dos filhos: as telas
 * chamam o cliente do Supabase já no primeiro render.
 */
export function ConfigurarSupabase({ url, chave }: { url: string; chave: string }) {
  definirConfigSupabase(url, chave);

  useEffect(() => {
    definirConfigSupabase(url, chave);
    registrarEnviador();
    iniciarOutbox();
  }, [url, chave]);

  return null;
}

"use client";

import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { temaDasPrefs, temaDoNextThemes } from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";

/** O que a barra do sistema mostra se o CSS ainda não respondeu. */
const RESERVA = { dark: "#0a0a0a", light: "#fafafa" } as const;

/**
 * A cor da barra do sistema segue o tema **escolhido**, não o do aparelho.
 *
 * `app/layout.tsx` declara duas `theme-color` por `prefers-color-scheme` — é o
 * que o HTML já pode dizer antes de qualquer JavaScript. Mas quem usa o app
 * claro num celular no escuro (ou o contrário) ficava com a barra de cima de
 * uma cor e a tela de outra (SPEC §22.4 item 5). Aqui as duas metas passam a
 * dizer a mesma coisa: o `--background` que está valendo de verdade.
 */
function pintarBarraDoSistema(escuro: boolean) {
  const raiz = document.documentElement;
  const token = getComputedStyle(raiz).getPropertyValue("--background").trim();
  const cor = token || (escuro ? RESERVA.dark : RESERVA.light);
  const metas = document.head.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = cor;
    document.head.append(meta);
    return;
  }
  // as duas continuam com o próprio `media`: seja qual for a que casar, a cor
  // é a mesma — e o HTML do servidor segue valendo para a primeira pintura
  for (const meta of metas) {
    if (meta.content !== cor) meta.content = cor;
  }
}

/**
 * O tema escolhido em `/mais/preferencias` mora em `profiles.prefs.tema`
 * (SPEC §3.9), mas quem pinta a tela é o `next-themes` (localStorage). Este
 * componente aplica a preferência do perfil **uma vez** por carregamento —
 * assim o tema atravessa aparelhos e a reinstalação do app — e mantém a cor
 * da barra do sistema colada no tema que está valendo.
 */
export function TemaDoPerfil() {
  const perfilQ = usePerfil();
  const caminho = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const aplicado = useRef(false);

  useEffect(() => {
    const perfil = perfilQ.data;
    if (aplicado.current || !perfil) return;
    aplicado.current = true;
    setTheme(temaDoNextThemes(temaDasPrefs(perfil.prefs)));
  }, [perfilQ.data, setTheme]);

  useEffect(() => {
    if (!resolvedTheme) return;
    const escuro = resolvedTheme === "dark";
    pintarBarraDoSistema(escuro);
    /*
     * A cada navegação o Next reescreve o `<head>` com o `viewport` do layout
     * e devolve as duas cores por `prefers-color-scheme` — a correção durava
     * até a primeira troca de aba. O observador repõe a cor certa quando isso
     * acontece; ele só escreve quando o valor está diferente, então não entra
     * em laço com a própria mudança.
     */
    const olho = new MutationObserver(() => pintarBarraDoSistema(escuro));
    olho.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content"],
    });
    return () => olho.disconnect();
  }, [resolvedTheme, caminho]);

  return null;
}

"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { temaDasPrefs, temaDoNextThemes } from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";

/**
 * O tema escolhido em `/mais/preferencias` mora em `profiles.prefs.tema`
 * (SPEC §3.9), mas quem pinta a tela é o `next-themes` (localStorage). Este
 * componente aplica a preferência do perfil **uma vez** por carregamento —
 * assim o tema atravessa aparelhos e a reinstalação do app.
 */
export function TemaDoPerfil() {
  const perfilQ = usePerfil();
  const { setTheme } = useTheme();
  const aplicado = useRef(false);

  useEffect(() => {
    const perfil = perfilQ.data;
    if (aplicado.current || !perfil) return;
    aplicado.current = true;
    setTheme(temaDoNextThemes(temaDasPrefs(perfil.prefs)));
  }, [perfilQ.data, setTheme]);

  return null;
}

"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function AlternarTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const escuro = resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      className="alvo h-12 w-full justify-start gap-2 text-base"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label="Alternar tema"
    >
      {montado && escuro ? (
        <Sun className="size-5" />
      ) : (
        <Moon className="size-5" />
      )}
      {montado ? (escuro ? "Tema claro" : "Tema escuro") : "Tema"}
    </Button>
  );
}

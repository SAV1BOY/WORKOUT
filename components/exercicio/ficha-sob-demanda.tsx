"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";
import type { FichaEmFolha as FichaCompleta } from "@/components/exercicio/ficha-folha";

const Folha = dynamic(() =>
  import("@/components/exercicio/ficha-folha").then((modulo) => modulo.FichaEmFolha),
);

export function FichaEmFolha(props: ComponentProps<typeof FichaCompleta>) {
  const [jaAbriu, setJaAbriu] = useState(false);
  useEffect(() => {
    if (props.aberto) setJaAbriu(true);
  }, [props.aberto]);
  // Depois do primeiro toque, a folha pode terminar a animação e devolver o foco.
  return props.aberto || jaAbriu ? <Folha {...props} /> : null;
}

import { Suspense } from "react";
import { EsqueletoCard } from "@/components/carregando";
import { TelaGuia } from "@/components/mais/guia";

export const metadata = { title: "Como usar o app — Treino do Terraço" };

/** `/mais/guia` (SPEC §20): o guia de uso, dentro do layout do app. */
export default function Guia() {
  return (
    <Suspense fallback={<EsqueletoCard linhas={5} />}>
      <TelaGuia />
    </Suspense>
  );
}

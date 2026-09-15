import { Compass } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Explorar — Treino do Terraço" };

/**
 * `/explorar` (SPEC §13.4). O marco V1 entrega a aba e a rota; a vitrine de
 * coleções derivadas dos JSON é o marco V2 — até lá esta tela diz exatamente
 * isso, em vez de fingir conteúdo.
 */
export default function Explorar() {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Explorar</h1>
        <p className="text-muted-foreground text-sm">
          Coleções, aparelhos, circuitos e planos.
        </p>
      </header>

      <div className="cartao border-border bg-card flex flex-col items-center gap-3 border border-dashed px-4 py-10 text-center">
        <Compass aria-hidden="true" className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm text-balance">
          Em construção — marco V2. Aqui vão entrar as coleções derivadas dos
          dados: parte do corpo em foco, aparelhos, circuitos e os planos de
          corrida, corda e barra fixa. Por enquanto, o catálogo inteiro está em{" "}
          <Link className="text-primary underline underline-offset-4" href="/exercicios">
            Exercícios
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

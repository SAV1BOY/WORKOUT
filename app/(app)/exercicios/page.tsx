import { ListaExercicios } from "@/components/exercicios/lista-exercicios";
import { exercicios } from "@/lib/dados";

export const metadata = { title: "Exercícios — Treino do Terraço" };

/** `/exercicios` (SPEC §3.6): o catálogo inteiro, que vem dos JSON. */
export default function Exercicios() {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Exercícios</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Os {exercicios.length} exercícios do guia, com figura, passos e histórico.
        </p>
      </header>
      <ListaExercicios />
    </section>
  );
}

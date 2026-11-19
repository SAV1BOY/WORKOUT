import type { Exercicio } from "@/lib/schemas";

export function PassosDoExercicio({ passos }: Pick<Exercicio, "passos">) {
  return (
    <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
      {passos.map(passo => <li key={passo}>{passo}</li>)}
    </ol>
  );
}

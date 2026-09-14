import { EmConstrucao } from "@/components/em-construcao";
import { exercicioPorId } from "@/lib/dados";

export default async function FichaExercicio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercicio = exercicioPorId.get(id);

  return (
    <EmConstrucao
      titulo={exercicio?.nome ?? "Exercício"}
      descricao={
        exercicio
          ? `${exercicio.grupo} · ${exercicio.equipamento_texto}`
          : "Exercício não encontrado no catálogo."
      }
      marco={5}
    />
  );
}

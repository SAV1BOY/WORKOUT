import { EmConstrucao } from "@/components/em-construcao";
import { exercicios } from "@/lib/dados";

export const metadata = { title: "Exercícios — Treino do Terraço" };

export default function Exercicios() {
  return (
    <EmConstrucao
      titulo="Exercícios"
      descricao={`Catálogo com ${exercicios.length} exercícios, busca e filtros.`}
      marco={5}
    />
  );
}

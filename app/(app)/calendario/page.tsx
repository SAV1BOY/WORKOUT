import { EmConstrucao } from "@/components/em-construcao";

export const metadata = { title: "Calendário — Treino do Terraço" };

export default function Calendario() {
  return (
    <EmConstrucao
      titulo="Calendário"
      descricao="A semana de segunda a domingo, o que foi feito e o que falta."
      marco={2}
    />
  );
}

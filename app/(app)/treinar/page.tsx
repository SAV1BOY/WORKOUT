import { EmConstrucao } from "@/components/em-construcao";

export const metadata = { title: "Treinar — Treino do Terraço" };

export default function Treinar() {
  return (
    <EmConstrucao
      titulo="Treinar"
      descricao="Começar o treino do dia ou continuar uma sessão aberta."
      marco={3}
    />
  );
}

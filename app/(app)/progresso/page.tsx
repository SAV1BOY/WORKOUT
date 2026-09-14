import { EmConstrucao } from "@/components/em-construcao";

export const metadata = { title: "Progresso — Treino do Terraço" };

export default function Progresso() {
  return (
    <EmConstrucao
      titulo="Progresso"
      descricao="Treinos concluídos, volume semanal, recordes e os gráficos de carga."
      marco={5}
    />
  );
}

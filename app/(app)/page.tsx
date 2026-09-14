import { EmConstrucao } from "@/components/em-construcao";
import { acharFase, programa } from "@/lib/dados";
import { formatarDataLonga } from "@/lib/formato";

export const metadata = { title: "Hoje — Treino do Terraço" };

export default function Hoje() {
  const fase = acharFase(programa.fase_inicial);

  return (
    <EmConstrucao
      titulo="Hoje"
      descricao={`${fase.nome} · começa em ${formatarDataLonga(programa.inicio)}.`}
      marco={2}
    >
      <p className="text-muted-foreground text-xs">
        O que fazer hoje sai do calendário do programa e das cargas do motor de
        progressão.
      </p>
    </EmConstrucao>
  );
}

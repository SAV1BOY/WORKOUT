import { AlternarTema } from "@/components/alternar-tema";
import { BotaoSair } from "@/components/botao-sair";
import { EmConstrucao } from "@/components/em-construcao";

export const metadata = { title: "Mais — Treino do Terraço" };

export default function Mais() {
  return (
    <EmConstrucao
      titulo="Mais"
      descricao="Perfil, equipamento, preferências e backup."
      marco={6}
    >
      <div className="flex flex-col gap-2">
        <AlternarTema />
        <BotaoSair />
      </div>
    </EmConstrucao>
  );
}

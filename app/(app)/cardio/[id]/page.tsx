import { EmConstrucao } from "@/components/em-construcao";

export const metadata = { title: "Cardio — Treino do Terraço" };

export default async function SessaoCardio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EmConstrucao
      titulo="Cardio"
      descricao={`Timer de blocos da sessão ${id} (corrida, corda ou caminhada).`}
      marco={4}
    />
  );
}

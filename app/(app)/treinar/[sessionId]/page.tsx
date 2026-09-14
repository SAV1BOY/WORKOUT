import { EmConstrucao } from "@/components/em-construcao";

export const metadata = { title: "Sessão — Treino do Terraço" };

export default async function Sessao({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <EmConstrucao
      titulo="Sessão de força"
      descricao={`Registro série a série da sessão ${sessionId}.`}
      marco={3}
    />
  );
}

import { notFound, redirect } from "next/navigation";
import { TelaCardio } from "@/components/cardio/tela-cardio";
import { ehTipoDeCardio } from "@/lib/cardio";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Cardio — Treino do Terraço" };
export const dynamic = "force-dynamic";

/**
 * `/cardio/[id]` (SPEC §3.3), com `id` = corrida | corda | caminhada | outro.
 * `?semana=` abre uma semana específica do plano e `?sessao=` mostra uma
 * sessão já registrada (o calendário abre um dia que já passou, §3.5).
 */
export default async function SessaoCardio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");

  const { id } = await params;
  if (!ehTipoDeCardio(id)) notFound();

  const busca = await searchParams;
  const semanaCrua = Array.isArray(busca.semana) ? busca.semana[0] : busca.semana;
  const semana = Number(semanaCrua);
  const sessaoCrua = Array.isArray(busca.sessao) ? busca.sessao[0] : busca.sessao;

  return (
    <TelaCardio
      userId={userId}
      tipo={id}
      semanaPedida={Number.isFinite(semana) && semana > 0 ? Math.round(semana) : null}
      sessaoId={sessaoCrua ?? null}
    />
  );
}

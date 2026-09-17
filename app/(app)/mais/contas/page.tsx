import { redirect } from "next/navigation";
import { CabecalhoMais } from "@/components/mais/cabecalho";
import { TelaContas } from "@/components/mais/tela-contas";
import { ehDono } from "@/lib/env";
import { emailDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Contas — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Contas() {
  const email = await emailDoUsuario();
  if (!email) redirect("/login");

  /*
   * SPEC §21.3: a rota existe para todo mundo (o link é que só aparece para o
   * dono), e para quem não é dono ela não mostra nada. Não é a única tranca —
   * `contas_cadastradas()` devolve vazio e a policy `app_config_dono` recusa a
   * escrita —, é só o recado honesto.
   */
  if (!ehDono(email)) {
    return (
      <section className="flex flex-col gap-4">
        <CabecalhoMais titulo="Contas" />
        <p className="text-muted-foreground text-sm">Só o dono vê esta tela.</p>
      </section>
    );
  }

  return <TelaContas />;
}

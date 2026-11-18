import Link from "next/link";
import { Button } from "@/components/ui/button";
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
        <CabecalhoMais titulo="Esta tela é do dono do app" descricao="Só quem administra as contas vê o limite e quem está usando." />
        <Button asChild className="alvo self-start"><Link href="/mais">Voltar para Mais</Link></Button>
      </section>
    );
  }

  return <TelaContas />;
}

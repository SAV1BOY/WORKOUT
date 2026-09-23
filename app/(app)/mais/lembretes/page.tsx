import { redirect } from "next/navigation";
import { TelaLembretes } from "@/components/mais/tela-lembretes";
import { configuracaoVapid, LINHA_LEMBRETES } from "@/lib/lembretes";
import { idDoUsuario } from "@/lib/supabase/server";
import { publicaDaPrivada } from "@/lib/web-push";

export const metadata = { title: `${LINHA_LEMBRETES.titulo} — Treino do Terraço` };
// as chaves VAPID são do ambiente em que o servidor roda, não do build
export const dynamic = "force-dynamic";

/**
 * Mais → Lembretes (SPEC §23.4). O servidor confere as três variáveis VAPID
 * (e se o par fecha) e entrega ao navegador **só a chave pública**; sem
 * configuração, a tela diz isso e não oferece nada. O id de quem está logado
 * vai junto: a coluna `user_id` não tem default e o insert precisa dele (§23.2).
 */
export default async function Lembretes() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  // `process.env` inteiro: `process.env.NEXT_PUBLIC_…` seria o valor do build
  const vapid = configuracaoVapid(process.env, publicaDaPrivada);
  return <TelaLembretes userId={userId} chavePublica={vapid.ok ? vapid.publica : null} />;
}

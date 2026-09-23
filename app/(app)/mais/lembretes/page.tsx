import { TelaLembretes } from "@/components/mais/tela-lembretes";
import { configuracaoVapid, LINHA_LEMBRETES } from "@/lib/lembretes";
import { publicaDaPrivada } from "@/lib/web-push";

export const metadata = { title: `${LINHA_LEMBRETES.titulo} — Treino do Terraço` };
// as chaves VAPID são do ambiente em que o servidor roda, não do build
export const dynamic = "force-dynamic";

/**
 * Mais → Lembretes (SPEC §23.4). O servidor confere as três variáveis VAPID
 * (e se o par fecha) e entrega ao navegador **só a chave pública**; sem
 * configuração, a tela diz isso e não oferece nada.
 */
export default function Lembretes() {
  // `process.env` inteiro: `process.env.NEXT_PUBLIC_…` seria o valor do build
  const vapid = configuracaoVapid(process.env, publicaDaPrivada);
  return <TelaLembretes chavePublica={vapid.ok ? vapid.publica : null} />;
}

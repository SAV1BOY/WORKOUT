import { NextResponse } from "next/server";
import {
  PAYLOAD_DE_TESTE,
  SEM_CONFIGURACAO,
  SEM_TABELA,
  configuracaoVapid,
  destinoDaResposta,
  endpointAceito,
  tabelaAusente,
  textoDoResultado,
  type ResultadoDoAparelho,
} from "@/lib/lembretes";
import { inscricaoLembreteSchema } from "@/lib/schemas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { montarPedidoPush, publicaDaPrivada } from "@/lib/web-push";

/*
 * `POST /api/lembretes/teste` (SPEC §23.5): manda um lembrete de teste para
 * cada aparelho da conta de quem pediu.
 *
 * - `nodejs`: a cifragem e a assinatura usam `node:crypto`.
 * - Nunca a service role: o banco é lido com a sessão do cookie, e a RLS de
 *   `lembretes_inscricoes` só devolve as linhas desta pessoa.
 * - `process.env` é passado inteiro para `configuracaoVapid`: um
 *   `process.env.NEXT_PUBLIC_…` escrito aqui seria trocado pelo valor do
 *   **build**, e as chaves são do ambiente em que o servidor roda.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quanto esperar por cada serviço de push. */
const PRAZO_DO_ENVIO_MS = 10_000;

function erro(status: number, mensagem: string) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function POST() {
  const vapid = configuracaoVapid(process.env, publicaDaPrivada);
  if (!vapid.ok) return erro(503, SEM_CONFIGURACAO);

  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro(401, "Entre de novo para continuar.");

  const { data, error } = await supabase
    .from("lembretes_inscricoes")
    .select("id, endpoint, p256dh, auth, aparelho, criado_em");
  if (error) {
    return tabelaAusente(error)
      ? erro(503, SEM_TABELA)
      : erro(502, "Não deu para ler os aparelhos agora. Tente de novo.");
  }

  const inscricoes = (data ?? []).flatMap((linha: unknown) => {
    const lida = inscricaoLembreteSchema.safeParse(linha);
    return lida.success ? [lida.data] : [];
  });
  if (inscricoes.length === 0) {
    return erro(409, textoDoResultado([]));
  }

  const origemDeTeste = process.env.LEMBRETES_PUSH_DE_TESTE;
  const corpo = JSON.stringify(PAYLOAD_DE_TESTE);
  const resultados: (ResultadoDoAparelho & { id: string; status: number | null })[] =
    await Promise.all(
      inscricoes.map(async (inscricao) => {
        if (!endpointAceito(inscricao.endpoint, origemDeTeste)) {
          return { id: inscricao.id, aparelho: inscricao.aparelho, destino: "recusado" as const, status: null };
        }
        try {
          const pedido = montarPedidoPush(inscricao, corpo, vapid, Date.now(), PAYLOAD_DE_TESTE.tag);
          const resposta = await fetch(pedido.url, {
            method: "POST",
            headers: pedido.cabecalhos,
            body: new Uint8Array(pedido.corpo),
            redirect: "manual",
            cache: "no-store",
            signal: AbortSignal.timeout(PRAZO_DO_ENVIO_MS),
          });
          const destino = destinoDaResposta(resposta.status);
          if (destino === "expirada") {
            // RFC 8030 §7.3: 404/410 = a inscrição não existe mais
            await supabase.from("lembretes_inscricoes").delete().eq("id", inscricao.id);
          }
          return { id: inscricao.id, aparelho: inscricao.aparelho, destino, status: resposta.status };
        } catch {
          return { id: inscricao.id, aparelho: inscricao.aparelho, destino: "erro" as const, status: null };
        }
      }),
    );

  return NextResponse.json({ texto: textoDoResultado(resultados), resultados });
}

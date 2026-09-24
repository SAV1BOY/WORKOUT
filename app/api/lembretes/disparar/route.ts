import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  SEM_CONFIGURACAO,
  configuracaoVapid,
  destinoDaResposta,
  endpointAceito,
} from "@/lib/lembretes";
import { lembretesDevidos, type ContaDaRegra } from "@/lib/lembretes-regra";
import { disparoSchema, type FaseId, type TreinoId, type UsuarioDoDisparo } from "@/lib/schemas";
import type { SessaoCurta } from "@/lib/semana";
import { criarClienteServidor } from "@/lib/supabase/server";
import { montarPedidoPush, publicaDaPrivada } from "@/lib/web-push";

/*
 * `POST /api/lembretes/disparar` (SPEC §23.11): quem chama é o pg_cron, a
 * cada 5 minutos, por `public.lembretes_tick()` + pg_net, com o cabeçalho
 * `x-lembretes-segredo` e o JSON mínimo das contas com lembrete ligado.
 *
 * - Sem sessão (o middleware deixa passar só esta rota): o segredo é a porta.
 * - Nunca a service role: a rota não lê tabela nenhuma; grava o resultado
 *   pela RPC `lembretes_resultado`, com a chave anon e o mesmo segredo, que o
 *   banco confere contra o Vault.
 * - `process.env` inteiro para as chaves (as do ambiente, não as do build).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRAZO_DO_ENVIO_MS = 10_000;
/** O corpo que o tick manda cabe folgado nisto; mais que isso não é o tick. */
const MAIOR_CORPO = 512 * 1024;

/**
 * Lê o corpo em bytes até `limite`: o `content-length` declarado maior já
 * recusa, e a leitura para no primeiro pedaço que passar (nada de guardar o
 * resto na memória). Passou → `null` (413).
 */
async function lerAte(request: Request, limite: number): Promise<string | null> {
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > limite) return null;
  if (!request.body) return "";
  const leitor = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel().catch(() => undefined);
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes).toString("utf8");
}

function resposta(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status });
}

/** Compara os sha256 (32 bytes dos dois lados): tempo constante, sem vazar o tamanho. */
function segredoConfere(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = createHash("sha256").update(recebido, "utf8").digest();
  const b = createHash("sha256").update(esperado, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** A conta do JSON do tick no formato da regra pura. */
function contaDaRegra(u: UsuarioDoDisparo): ContaDaRegra {
  return {
    perfil: {
      data_inicio: u.perfil.data_inicio ?? null,
      fase_atual: u.perfil.fase_atual as FaseId,
      fase_desde: u.perfil.fase_desde ?? undefined,
      ultimo_treino: (u.perfil.ultimo_treino ?? null) as TreinoId | null,
      semana_corrida: u.perfil.semana_corrida ?? undefined,
      semana_corda: u.perfil.semana_corda ?? undefined,
      semana_fixa: u.perfil.semana_fixa ?? undefined,
      prefs: u.perfil.prefs ?? {},
    },
    overrides: u.overrides.map((o) => ({
      data: o.data,
      tipo: o.tipo,
      workout_id: o.workout_id ?? null,
      sessao: o.sessao ?? null,
    })),
    sessoes: u.sessoes.map((s) => ({
      id: s.id,
      data: s.data,
      status: s.status as "em_andamento" | "concluida" | "abandonada",
      workout_id: s.workout_id as SessaoCurta["workout_id"],
    })),
    cardios: u.cardios.map((c) => ({
      id: c.id,
      data: c.data,
      tipo: c.tipo as "corrida" | "corda" | "caminhada" | "outro",
      concluida: c.concluida,
    })),
    enviados: u.enviados,
  };
}

export async function POST(request: Request) {
  const segredo = (process.env.LEMBRETES_SEGREDO ?? "").trim();
  if (!segredo) return resposta(503, { erro: SEM_CONFIGURACAO, codigo: "SEM_CONFIGURACAO" });
  if (!segredoConfere(request.headers.get("x-lembretes-segredo"), segredo)) {
    return resposta(401, { erro: "Segredo dos lembretes inválido." });
  }
  const vapid = configuracaoVapid(process.env, publicaDaPrivada);
  if (!vapid.ok) return resposta(503, { erro: SEM_CONFIGURACAO, codigo: "SEM_CONFIGURACAO" });

  const texto = await lerAte(request, MAIOR_CORPO);
  if (texto === null) return resposta(413, { erro: "Corpo grande demais." });
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return resposta(400, { erro: "Corpo não é JSON." });
  }
  const lido = disparoSchema.safeParse(bruto);
  if (!lido.success) return resposta(400, { erro: "Corpo fora do formato do disparo." });

  const agora = new Date(lido.data.agora);
  const origemDeTeste = process.env.LEMBRETES_PUSH_DE_TESTE;
  const enviados: { user_id: string; tipo: string; dia: string }[] = [];
  const expirados = new Set<string>();
  let avisos = 0;
  let entregas = 0;

  for (const usuario of lido.data.usuarios) {
    const devidos = lembretesDevidos(contaDaRegra(usuario), agora);
    for (const aviso of devidos) {
      avisos += 1;
      const corpo = JSON.stringify(aviso.payload);
      const destinos = await Promise.all(
        usuario.inscricoes.map(async (inscricao) => {
          if (!endpointAceito(inscricao.endpoint, origemDeTeste)) return "recusado" as const;
          try {
            const pedido = montarPedidoPush(inscricao, corpo, vapid, Date.now(), aviso.payload.tag);
            const r = await fetch(pedido.url, {
              method: "POST",
              headers: pedido.cabecalhos,
              body: new Uint8Array(pedido.corpo),
              redirect: "manual",
              cache: "no-store",
              signal: AbortSignal.timeout(PRAZO_DO_ENVIO_MS),
            });
            const destino = destinoDaResposta(r.status);
            if (destino === "expirada") expirados.add(inscricao.endpoint);
            return destino;
          } catch {
            return "erro" as const;
          }
        }),
      );
      const chegaram = destinos.filter((d) => d === "enviado").length;
      entregas += chegaram;
      // só marca o que chegou a algum aparelho: o resto tenta no próximo tick
      if (chegaram > 0) enviados.push({ user_id: usuario.user_id, tipo: aviso.tipo, dia: aviso.dia });
    }
  }

  let gravado = true;
  if (enviados.length > 0 || expirados.size > 0) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.rpc("lembretes_resultado", {
      segredo,
      enviados,
      expirados: [...expirados],
    });
    gravado = !error;
  }

  return resposta(gravado ? 200 : 502, {
    contas: lido.data.usuarios.length,
    avisos,
    entregas,
    marcados: enviados.length,
    expirados: expirados.size,
    gravado,
  });
}

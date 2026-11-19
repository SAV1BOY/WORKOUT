"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { liveQuery } from "dexie";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CorrecoesDeContagem } from "@/components/mais/correcoes-de-contagem";
import { listarConciliacoesDeContagem, listarContagensPendentes, type ConciliacaoDeContagem, type ContagemPendente } from "@/lib/contagens-pendentes";
import { AVISO_DE_CONFLITO_DE_CONTAGEM, estadoDaFila, resumoDaFila, tentarAgora, type EstadoDaFila } from "@/lib/outbox";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { clienteNavegador } from "@/lib/supabase/client";
import { useRede } from "@/lib/usar-rede";
import { EVENTO_DE_LOGIN_CONFIRMADO } from "@/lib/vinculo-do-player";

const LOGIN_MUDOU = "Reabra a sincronização com a conta deste treino.";

/** O HTML de Mais pode vir do worker depois de o aparelho ter mudado de conta. */
export function LinhaSincronizacao({ userId }: { userId: string }) {
  const [conta, setConta] = useState<string | null>(null);
  useEffect(() => {
    let revisao = 0;
    const conferir = () => {
      const leitura = ++revisao;
      // O SDK libera o lock de autenticação quando o callback do evento termina.
      window.setTimeout(() => {
        if (leitura !== revisao) return;
        void confirmarContaDoTreino(userId, LOGIN_MUDOU).then(
          () => { if (leitura === revisao) setConta(userId); },
          () => { if (leitura === revisao) setConta(null); },
        );
      }, 0);
    };
    conferir();
    const { data: { subscription } } = clienteNavegador().auth.onAuthStateChange((evento: AuthChangeEvent, sessao: Session | null) => {
      if (evento === "SIGNED_OUT" || (sessao && sessao.user.id !== userId)) {
        revisao++;
        setConta(null);
      } else if (sessao?.user.id === userId) {
        conferir();
      }
    });
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    window.addEventListener(EVENTO_DE_LOGIN_CONFIRMADO, conferir);
    window.addEventListener("pageshow", conferir);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      revisao++;
      subscription.unsubscribe();
      window.removeEventListener(EVENTO_DE_LOGIN_CONFIRMADO, conferir);
      window.removeEventListener("pageshow", conferir);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [userId]);
  return conta === userId ? <FilaDaConta key={userId} conta={userId} /> : null;
}

function FilaDaConta({ conta }: { conta: string }) {
  const [estado, setEstado] = useState<EstadoDaFila | null>(null);
  const [pendencias, setPendencias] = useState<ContagemPendente[]>([]);
  const [comparacoes, setComparacoes] = useState<ConciliacaoDeContagem[]>([]);
  const [tentando, setTentando] = useState(false);
  const [erro, setErro] = useState("");
  const secao = useRef<HTMLElement>(null);
  const online = useRede();
  useEffect(() => {
    const inscricao = liveQuery(async () => ({
      fila: await estadoDaFila(conta),
      contagens: await listarContagensPendentes(conta),
      comparacoes: await listarConciliacoesDeContagem(conta),
    })).subscribe({
      next: ({ fila, contagens, comparacoes }) => {
        setEstado(fila);
        setPendencias(contagens);
        setComparacoes(comparacoes);
        setErro("");
      },
      error: () => {
        setEstado(null);
        setPendencias([]);
        setComparacoes([]);
        setErro("Não foi possível consultar a fila neste aparelho.");
      },
    });
    return () => inscricao.unsubscribe();
  }, [conta]);
  const tentar = async () => {
    setTentando(true);
    try {
      await confirmarContaDoTreino(conta, LOGIN_MUDOU);
      await tentarAgora();
      const fila = await estadoDaFila(conta);
      await confirmarContaDoTreino(conta, LOGIN_MUDOU);
      setEstado(fila);
      setErro(fila.quantos ? "A fila ainda tem registros para sincronizar." : "");
    } catch {
      setErro("Não foi possível sincronizar. Confira a conexão e tente de novo.");
    } finally {
      setTentando(false);
    }
  };
  const resumo = estado && resumoDaFila(estado);
  const haConflito = comparacoes.some(c => c.estado !== "aguardando");
  const detalhe = haConflito && (!estado?.erro || estado.erro === AVISO_DE_CONFLITO_DE_CONTAGEM)
    ? "Confira as séries em Corrigir contagens para concluir a sincronização."
    : resumo?.detalhe;

  return (
    <section ref={secao} id="sincronizacao" aria-label="Sincronização" tabIndex={-1} className="bg-muted grid gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <RefreshCw aria-hidden className={`size-4 shrink-0 ${resumo?.travada ? "text-destructive" : "text-muted-foreground"}`} />
        <span role="status" className="flex min-w-0 flex-col">
          <span className="font-medium">{resumo?.titulo ?? "Consultando a fila…"}</span>
          <span className="text-muted-foreground line-clamp-3 text-xs text-balance" title={detalhe}>{detalhe}</span>
        </span>
        {estado && estado.quantos > 0 && (
          <Button variant="outline" className="alvo ml-auto shrink-0" disabled={!online || tentando} onClick={() => void tentar()}>
            {!online ? "Sem rede" : tentando ? "Tentando…" : "Tentar agora"}
          </Button>
        )}
      </div>
      {erro && <p role="alert" className="text-sm">{erro}</p>}
      <CorrecoesDeContagem conta={conta} pendencias={pendencias} comparacoes={comparacoes} online={online}
        tentando={tentando} tentar={tentar} aoFecharSemPendencias={() => secao.current?.focus()} />
    </section>
  );
}

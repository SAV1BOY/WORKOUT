"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { liveQuery } from "dexie";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopiasDeEdicoesDoTreino } from "@/components/mais/copias-de-edicoes-do-treino";
import { CorrecoesDeContagem } from "@/components/mais/correcoes-de-contagem";
import { RevisaoDoEquipamento } from "@/components/mais/revisao-do-equipamento";
import { listarConciliacoesDeContagem, listarContagensPendentes, type ConciliacaoDeContagem, type ContagemPendente } from "@/lib/contagens-pendentes";
import { listarMateriaisPendentes, type MaterialPendente } from "@/lib/material-pendente";
import { AVISO_DE_CONFLITO_DE_CONTAGEM, AVISO_DE_CONFLITO_DE_MATERIAL, estadoDaFila, resumoDaFila, tentarAgora, type EstadoDaFila } from "@/lib/outbox";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { listarConciliacoesDeSaltos, listarSaltosPendentes, type ConciliacaoDeSaltos, type SaltosPendentes } from "@/lib/saltos-pendentes";
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

const semCorrecoes = {
  pendencias: [] as ContagemPendente[], comparacoes: [] as ConciliacaoDeContagem[],
  saltos: [] as SaltosPendentes[], comparacoesDeSaltos: [] as ConciliacaoDeSaltos[],
};

function FilaDaConta({ conta }: { conta: string }) {
  const [estado, setEstado] = useState<EstadoDaFila | null>(null);
  const [correcoes, setCorrecoes] = useState(semCorrecoes);
  const [materiais, setMateriais] = useState<MaterialPendente[]>([]);
  const [tentando, setTentando] = useState(false);
  const [erro, setErro] = useState("");
  const secao = useRef<HTMLElement>(null);
  const online = useRede();
  useEffect(() => {
    const inscricao = liveQuery(async () => ({
      fila: await estadoDaFila(conta),
      pendencias: await listarContagensPendentes(conta),
      comparacoes: await listarConciliacoesDeContagem(conta),
      saltos: await listarSaltosPendentes(conta),
      comparacoesDeSaltos: await listarConciliacoesDeSaltos(conta),
      equipamentos: await listarMateriaisPendentes(conta),
    })).subscribe({
      next: ({ fila, equipamentos, ...lidas }) => {
        setEstado(fila);
        setCorrecoes(lidas);
        setMateriais(equipamentos);
        setErro("");
      },
      error: () => {
        setEstado(null);
        setCorrecoes(semCorrecoes);
        setMateriais([]);
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
  const haConflitoDeSaltos = correcoes.comparacoesDeSaltos.some(c => c.estado !== "aguardando");
  const haConflito = haConflitoDeSaltos || correcoes.comparacoes.some(c => c.estado !== "aguardando");
  const instrucao = haConflitoDeSaltos ? "Confira os registros em Corrigir contagens para concluir a sincronização."
    : "Confira as séries em Corrigir contagens para concluir a sincronização.";
  let detalhe = resumo?.detalhe;
  if (materiais.length && estado?.erro === AVISO_DE_CONFLITO_DE_MATERIAL) {
    detalhe = "Confira o equipamento do treino antes de sincronizar.";
  } else if (haConflito && (!estado?.erro || estado.erro === AVISO_DE_CONFLITO_DE_CONTAGEM)) {
    detalhe = instrucao;
  }

  return (
    <section ref={secao} id="sincronizacao" aria-label="Sincronização" tabIndex={-1} className="bg-muted grid min-w-0 grid-cols-1 gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-[1_1_9rem] items-center gap-2">
          <RefreshCw aria-hidden className={`size-4 shrink-0 ${resumo?.travada ? "text-destructive" : "text-muted-foreground"}`} />
          <span role="status" className="flex min-w-0 flex-col wrap-anywhere">
            <span className="font-medium">{resumo?.titulo ?? "Consultando a fila…"}</span>
            <span className="text-muted-foreground line-clamp-3 text-xs text-balance" title={detalhe}>{detalhe}</span>
          </span>
        </div>
        {estado && estado.quantos > 0 && (
          <Button variant="outline" className="alvo ml-auto h-auto max-w-full py-1 whitespace-normal wrap-anywhere" disabled={!online || tentando} onClick={() => void tentar()}>
            {!online ? "Sem rede" : tentando ? "Tentando…" : "Tentar agora"}
          </Button>
        )}
      </div>
      {erro && <p role="alert" className="text-sm">{erro}</p>}
      <RevisaoDoEquipamento conta={conta} materiais={materiais} online={online}
        aoFecharSemPendencias={() => secao.current?.focus()} />
      <CopiasDeEdicoesDoTreino conta={conta} />
      <CorrecoesDeContagem conta={conta} {...correcoes} online={online}
        tentando={tentando} tentar={tentar} aoFecharSemPendencias={() => secao.current?.focus()} />
    </section>
  );
}

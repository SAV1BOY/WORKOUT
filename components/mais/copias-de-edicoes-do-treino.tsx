"use client";

import { liveQuery } from "dexie";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { exercicioPorId } from "@/lib/dados";
import { valoresDaSerieRegistrada } from "@/lib/detalhe-do-treino";
import { itensDoPlano } from "@/lib/livre";
import { lerCopiaDeMaterial, listarCopiasDeMaterial, type CopiaDeMaterial } from "@/lib/material-pendente";
import { assistenciaSchema } from "@/lib/schemas";
import { acaoDaFolha } from "./controles-de-contagem";

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function medida(valor: unknown) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function descricaoDaSerie(serie: CopiaDeMaterial["seriesGuardadas"][number]) {
  const linha = serie.payload.linha;
  const nome = exercicioPorId.get(serie.exercicioId)?.nome ?? serie.exercicioId;
  const indice = linha?.tipo === "aquecimento" ? `Aquecimento ${serie.indice}` : `Série ${serie.indice}`;
  if (!linha) return `${nome} · ${indice}`;
  const valores = valoresDaSerieRegistrada({
    exercise_id: serie.exercicioId, tipo: typeof linha.tipo === "string" ? linha.tipo : "",
    reps: medida(linha.reps), reps_lado2: medida(linha.reps_lado2),
    tempo_s: medida(linha.tempo_s), tempo_s_lado2: medida(linha.tempo_s_lado2),
    passos: medida(linha.passos), carga_kg: medida(linha.carga_kg),
    assistencia: assistenciaSchema.safeParse(linha.assistencia).data,
  });
  return `${nome} · ${indice} · ${valores}`;
}

export function CopiasDeEdicoesDoTreino({ conta }: { conta: string }) {
  const [copias, setCopias] = useState<CopiaDeMaterial[]>([]);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    const leituras = liveQuery(() => listarCopiasDeMaterial(conta)).subscribe({
      next: lidas => { setCopias(lidas); setErro(false); },
      error: () => { setCopias([]); setErro(true); },
    });
    return () => leituras.unsubscribe();
  }, [conta]);

  if (erro) return <p role="alert" className="text-sm">Não foi possível consultar as cópias de edições neste aparelho.</p>;
  if (!copias.length) return null;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className={`${acaoDaFolha} justify-self-start`}>Cópias de edições do treino</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-2 overflow-hidden pb-3">
        <SheetHeader className="shrink-0 pr-14 pb-0">
          <SheetTitle>Cópias de edições do treino</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-3">
          <SheetDescription>Estas edições ficam neste aparelho. Baixe uma cópia para conservá-la ao sair da conta ou limpar os dados do app.</SheetDescription>
          {copias.map(copia => <CopiaDoTreino key={copia.id} conta={conta} copia={copia} />)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CopiaDoTreino({ conta, copia }: { conta: string; copia: CopiaDeMaterial }) {
  const id = useId();
  const [verDados, setVerDados] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const emCurso = useRef(false);
  const original = copia.original;
  const plano = "equipamentoDaSessao" in original ? original.equipamentoDaSessao.planoInicial : original.linha?.plano;
  const itens = itensDoPlano(plano);

  async function baixar() {
    if (emCurso.current) return;
    emCurso.current = true;
    setBaixando(true);
    setMensagem("");
    try {
      const guardada = await lerCopiaDeMaterial(conta, copia.id);
      const arquivo = new Blob([JSON.stringify(guardada, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edicoes-do-treino-${guardada.sessaoId}-${guardada.id}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMensagem("Download solicitado.");
    } catch {
      setMensagem("Não foi possível baixar a cópia. Confira a conta e tente de novo.");
    } finally {
      emCurso.current = false;
      setBaixando(false);
    }
  }

  return (
    <section aria-labelledby={id} className="border-border grid min-w-0 gap-3 border-b py-4 wrap-anywhere last:border-0">
      <div>
        <h3 id={id} className="font-semibold">{copia.titulo || "Treino"} · {quando.format(copia.guardadaEm)}</h3>
        <p className="text-muted-foreground">Treino {copia.sessaoId.slice(-8)}</p>
      </div>
      {itens && <div>
        <p className="font-medium">Exercícios do plano guardado</p>
        <ol className="list-inside list-decimal">{itens.map((item, i) => (
          <li key={i}>{exercicioPorId.get(item.exercicioId)?.nome ?? item.exercicioId}</li>
        ))}</ol>
      </div>}
      {copia.seriesGuardadas.length > 0 && <div>
        <p className="font-medium">Registros de séries guardados na cópia</p>
        <ul className="list-inside list-disc">{copia.seriesGuardadas.map(serie => (
          <li key={`${serie.filaId}-${serie.id}`}>{descricaoDaSerie(serie)}</li>
        ))}</ul>
      </div>}
      <details className="min-w-0" onToggle={evento => setVerDados(evento.currentTarget.open)}>
        <summary className="alvo cursor-pointer py-2 font-medium">Ver dados completos</summary>
        {verDados && <pre className="bg-muted max-h-64 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap wrap-anywhere">
          {JSON.stringify(copia, null, 2)}
        </pre>}
      </details>
      <Button variant="outline" className={`${acaoDaFolha} justify-self-start`} disabled={baixando}
        onClick={() => void baixar()}>Baixar cópia</Button>
      {mensagem && <p role="status">{mensagem}</p>}
    </section>
  );
}

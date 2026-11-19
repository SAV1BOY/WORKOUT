"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  confirmarContagemPendente, contagemInteiraValida, MAX_CONTAGEM,
  type CampoContagem, type ContagemPendente,
} from "@/lib/contagens-pendentes";
import { exercicioPorId } from "@/lib/dados";
import { corrigirConsultasDaSerie } from "@/lib/espelhos-da-contagem";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";

const rotulos: Record<CampoContagem, string> = {
  reps: "Repetições", reps_lado2: "Repetições (lado esquerdo)",
  tempo_s: "Tempo em segundos", tempo_s_lado2: "Tempo em segundos (lado esquerdo)",
  passos: "Passos", reps_alvo_min: "Meta mínima de repetições", reps_alvo_max: "Meta máxima de repetições",
};
const numero = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 21 });
const momento = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function lerInteiro(texto = "") {
  const valor = /^\d+$/.test(texto.trim()) ? Number(texto) : NaN;
  return contagemInteiraValida(valor) ? valor : null;
}

export function CorrecoesDeContagem({ conta, pendencias, aoFecharSemPendencias }: {
  conta: string; pendencias: ContagemPendente[]; aoFecharSemPendencias: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [salvou, setSalvou] = useState(false);
  const aviso = useRef<HTMLParagraphElement>(null);
  if (!pendencias.length && !aberta) return null;
  const aoGuardar = () => {
    setSalvou(true);
    aviso.current?.focus();
  };

  return (
    <Sheet open={aberta} onOpenChange={valor => {
      setAberta(valor);
      if (valor) setSalvou(false);
    }}>
      <SheetTrigger asChild><Button variant="outline" className="alvo justify-self-start">Corrigir contagens</Button></SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-2 overflow-hidden pb-3"
        onCloseAutoFocus={evento => {
          if (pendencias.length) return;
          evento.preventDefault();
          aoFecharSemPendencias();
        }}>
        <SheetHeader className="shrink-0 pr-14">
          <SheetTitle>Corrigir contagens</SheetTitle>
          <SheetDescription>Confira os valores inteiros destas séries para que elas possam sincronizar.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-3">
          <p ref={aviso} tabIndex={-1} role="status" className="text-sm font-medium">{salvou && "Correção salva neste aparelho."}</p>
          {pendencias.map(pendencia => (
            <CorrecaoDaSerie key={`${pendencia.sessaoId}/${pendencia.serieId}`} conta={conta} atual={pendencia} aoGuardar={aoGuardar} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CorrecaoDaSerie({ conta, atual, aoGuardar }: {
  conta: string; atual: ContagemPendente; aoGuardar: () => void;
}) {
  const id = useId();
  const cliente = useQueryClient();
  const [base, setBase] = useState(atual);
  const [digitados, setDigitados] = useState<Partial<Record<CampoContagem, string>>>({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const exercicio = base.exercicioId ? exercicioPorId.get(base.exercicioId) : undefined;
  const unilateral = base.unilateral || exercicio?.prescricao_padrao.unilateral;
  const tipo = base.tipo === "aquecimento" ? "Aquecimento" : "Série";
  const titulo = `${exercicio?.nome ?? base.exercicioId ?? "Exercício"} · ${tipo}${base.indice == null ? "" : ` ${base.indice}`}`;
  const horario = base.registradaEm ? Date.parse(base.registradaEm) : NaN;
  const mudou = atual.revisao !== base.revisao;
  const faltaValor = base.campos.some(c => c.posterior === null && lerInteiro(digitados[c.campo]) === null);

  const confirmar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (emCurso.current || mudou || faltaValor) return;
    emCurso.current = true;
    setSalvando(true);
    setErro("");
    try {
      const valores: Partial<Record<CampoContagem, number>> = {};
      for (const c of base.campos) {
        if (c.posterior === null) valores[c.campo] = lerInteiro(digitados[c.campo])!;
      }
      const correcoes = await confirmarContagemPendente(conta, base, valores);
      await confirmarContaDoTreino(conta, "A conta desta série mudou.");
      corrigirConsultasDaSerie(cliente, conta, base.sessaoId, base.serieId, correcoes);
      aoGuardar();
    } catch {
      setErro("Não foi possível confirmar a correção. Confira se a série mudou e tente de novo.");
    } finally {
      emCurso.current = false;
      setSalvando(false);
    }
  };

  return (
    <form aria-labelledby={id} onSubmit={evento => void confirmar(evento)} className="border-border flex flex-col gap-3 border-b py-4 last:border-0">
      <div>
        <h3 id={id} className="font-semibold wrap-anywhere">{titulo}</h3>
        <p className="text-muted-foreground text-sm">
          {Number.isFinite(horario) ? momento.format(horario) : `Treino ${base.sessaoId.slice(-8)}`}
          {base.ordemEx != null && ` · Exercício ${base.ordemEx}`}
        </p>
      </div>
      {base.campos.map(({ campo, fracionario, posterior }) => {
        const rotulo = unilateral && (campo === "reps" || campo === "tempo_s")
          ? `${rotulos[campo]} (lado direito)` : rotulos[campo];
        const campoId = `${id}-${campo}`;
        const invalido = Boolean(digitados[campo]) && lerInteiro(digitados[campo]) === null;
        return (
          <div key={campo} className="grid gap-1">
            {posterior === null ? <label htmlFor={campoId} className="font-medium">{rotulo}</label> : <p className="font-medium">{rotulo}</p>}
            <p id={`${campoId}-recusado`} className="text-muted-foreground text-sm">Valor recusado: {numero.format(fracionario)}</p>
            {posterior !== null ? (
              <p className="text-sm">Valor já corrigido: {numero.format(posterior)}</p>
            ) : (
              <>
                <Input id={campoId} type="text" inputMode="numeric" autoComplete="off" value={digitados[campo] ?? ""}
                  aria-invalid={invalido} aria-describedby={`${campoId}-recusado ${campoId}-ajuda`}
                  disabled={salvando || mudou} className="alvo max-w-44" placeholder="Número inteiro"
                  onChange={e => setDigitados({ ...digitados, [campo]: e.target.value })} />
                <p id={`${campoId}-ajuda`} className="text-muted-foreground text-xs">
                  {invalido ? `Use um inteiro de 0 a ${numero.format(MAX_CONTAGEM)}.` : "Digite o valor desta série, sem casas decimais."}
                </p>
              </>
            )}
          </div>
        );
      })}
      {mudou ? (
        <>
          <p role="status" className="text-sm">A série mudou neste aparelho. Confira os valores atuais.</p>
          <Button type="button" variant="outline" className="alvo self-start" onClick={() => { setBase(atual); setDigitados({}); setErro(""); }}>
            Rever valores
          </Button>
        </>
      ) : (
        <Button type="submit" className="alvo self-start" disabled={salvando || faltaValor}>
          {salvando ? "Confirmando…" : "Confirmar correção"}
        </Button>
      )}
      {erro && <p role="alert" className="text-destructive text-sm">{erro}</p>}
    </form>
  );
}

"use client";

import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  alternativasPara, montagensParaTroca, motivoDaAlternativa,
  type FiltroAlternativa,
} from "@/lib/alternativas";
import { NOME_EQUIPAMENTO } from "@/lib/catalogo";
import { acharExercicio, equipamentoDisponivel } from "@/lib/dados";
import { evitado, evitadosPorUltimo } from "@/lib/preferencias";
import type { EquipamentoTag } from "@/lib/schemas";
import type { Prefs } from "@/lib/types";

const FILTROS: Record<FiltroAlternativa, string> = {
  todos: "Todas",
  corpo: "Peso do corpo",
  tatame: "Tatame",
  elastico: "Elástico",
  "outro-equipamento": "Outro equipamento",
};
const INVENTARIO = [...equipamentoDisponivel()].sort((a, b) =>
  NOME_EQUIPAMENTO[a].localeCompare(NOME_EQUIPAMENTO[b], "pt-BR"),
);

export const AVISO_DA_TROCA =
  "As séries que você já fez ficam registradas no exercício original. A alternativa começa com suas próprias séries.";

type Escolha = {
  exercicioId: string;
  prefs?: Prefs;
  aoSubstituir: (id: string) => void;
};

/** Os mesmos filtros e alternativas na ficha, no player e na lista do dia. */
export function OpcoesDeAlternativa({ exercicioId, prefs, aoSubstituir }: Escolha) {
  const [filtro, setFiltro] = useState<FiltroAlternativa>("todos");
  const [disponiveis, setDisponiveis] = useState<ReadonlySet<EquipamentoTag>>(equipamentoDisponivel);
  const origem = acharExercicio(exercicioId);
  const opcoes = evitadosPorUltimo(alternativasPara(exercicioId, filtro, disponiveis), (e) => e.id, prefs);

  function mudarEquipamento(tag: EquipamentoTag, marcado: boolean) {
    setDisponiveis((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(tag);
      else proximo.delete(tag);
      return proximo;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Equipamento para a alternativa" className="flex flex-wrap gap-1.5">
        {(Object.keys(FILTROS) as FiltroAlternativa[]).map((valor) => (
          <Button
            key={valor}
            type="button"
            size="sm"
            variant={filtro === valor ? "default" : "outline"}
            aria-pressed={filtro === valor}
            className="alvo px-3"
            onClick={() => setFiltro(valor)}
          >
            {FILTROS[valor]}
          </Button>
        ))}
      </div>
      <details className="rounded-lg border px-3">
        <summary className="alvo cursor-pointer content-center text-sm font-medium">
          Equipamentos disponíveis
        </summary>
        <fieldset className="pb-2">
          <legend className="text-muted-foreground text-xs">Marque o que está à mão para esta troca.</legend>
          <div className="grid grid-cols-2 gap-x-2">
            {INVENTARIO.map((tag) => (
              <label key={tag} className="alvo flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={disponiveis.has(tag)}
                  onChange={(evento) => mudarEquipamento(tag, evento.target.checked)} />
                {NOME_EQUIPAMENTO[tag]}
              </label>
            ))}
          </div>
        </fieldset>
      </details>
      {opcoes.length ? (
        <ul aria-label="Exercícios alternativos" className="flex flex-col divide-y">
          {opcoes.map((e) => {
            const equipamento = montagensParaTroca(origem, e, filtro, disponiveis).map((kit) =>
              kit.length ? kit.map((tag) => NOME_EQUIPAMENTO[tag]).join(" + ") : "Peso do corpo",
            ).join(" ou ");
            return (
              <li key={e.id}>
                <button type="button" onClick={() => aoSubstituir(e.id)}
                  className="hover:bg-muted alvo flex w-full flex-col items-start gap-1 rounded-lg px-2 py-2 text-left">
                  <span className="text-sm font-semibold">{e.nome}</span>
                  <span className="text-muted-foreground text-xs">{e.prescricao_padrao.texto} · {equipamento}</span>
                  <span className="text-muted-foreground text-xs">{motivoDaAlternativa(origem, e)}</span>
                  {evitado(prefs, e.id) ? <span className="text-muted-foreground text-xs">Você marcou como evitar.</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p role="status" className="text-muted-foreground text-sm">
          Nenhuma alternativa com este equipamento. Escolha outro filtro ou ajuste os equipamentos disponíveis.
        </p>
      )}
    </div>
  );
}

/** O botão pode estar dentro da folha (trigger) ou ser controlado pelo player. */
export function SeletorAlternativa({
  exercicioId, prefs, aoSubstituir, aberto, aoMudarAberto, children,
  antesDoTreino = false, voltarAoOriginal, avisoDaTroca = AVISO_DA_TROCA,
}: Escolha & {
  aberto?: boolean;
  aoMudarAberto?: (aberto: boolean) => void;
  children?: ReactElement;
  antesDoTreino?: boolean;
  avisoDaTroca?: string;
  voltarAoOriginal?: { nome: string; escolher: () => void };
}) {
  const [abertoLocal, setAbertoLocal] = useState(false);
  function mudarAberto(valor: boolean) {
    setAbertoLocal(valor);
    aoMudarAberto?.(valor);
  }
  return (
    <Sheet open={aberto ?? abertoLocal} onOpenChange={mudarAberto}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto pb-8">
        <SheetHeader className="pr-14 pb-0">
          <SheetTitle>Substituir hoje</SheetTitle>
          <SheetDescription>
            {acharExercicio(exercicioId).nome}. {antesDoTreino ? "A escolha vale para o treino que você começar hoje." : avisoDaTroca}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          {voltarAoOriginal && (
            <Button type="button" variant="outline" className="alvo h-auto whitespace-normal"
              onClick={() => { voltarAoOriginal.escolher(); mudarAberto(false); }}>
              Voltar para {voltarAoOriginal.nome}
            </Button>
          )}
          <OpcoesDeAlternativa key={exercicioId} exercicioId={exercicioId} prefs={prefs}
            aoSubstituir={(id) => { aoSubstituir(id); mudarAberto(false); }} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

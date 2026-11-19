"use client";

import { ChevronDown, X } from "lucide-react";
import { useId, useRef, useState, type ReactElement } from "react";
import { EquipamentoDeHoje, nomeDoMaterial, type MaterialDoTreino } from "@/components/exercicio/equipamento-de-hoje";
import { PassosDoExercicio } from "@/components/exercicio/passos-do-exercicio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  alternativasPara, montagensParaTroca, motivoDaAlternativa,
  type FiltroAlternativa,
} from "@/lib/alternativas";
import { filtrarExercicios } from "@/lib/catalogo";
import { acharExercicio, equipamentoDisponivel } from "@/lib/dados";
import { evitado, evitadosPorUltimo } from "@/lib/preferencias";
import { resolverTrocasDoTreino } from "@/lib/trocas";
import type { EquipamentoTag, Exercicio, TreinoId } from "@/lib/schemas";
import type { Prefs } from "@/lib/types";

const FILTROS: Record<FiltroAlternativa, string> = {
  todos: "Todas",
  corpo: "Peso do corpo",
  tatame: "Tatame",
  elastico: "Elástico",
  "outro-equipamento": "Outro equipamento",
};

export const AVISO_DA_TROCA =
  "As séries que você já fez ficam registradas no exercício original. A alternativa começa com suas próprias séries.";

export interface RecorrenciaDaTroca {
  treinoId: TreinoId;
  lembradas: Readonly<Record<string, string>>;
  aoLembrar: (originalId: string, alternativaId: string | null) => Promise<void>;
}

type Escolha = {
  exercicioId: string;
  originalId?: string;
  ocupados?: readonly string[];
  recorrencia?: RecorrenciaDaTroca;
  material?: MaterialDoTreino;
  prefs?: Prefs;
  aoSubstituir: (id: string) => void;
};

export function duracaoDaTroca(originalId: string, ativoId: string, recorrencia?: RecorrenciaDaTroca): string {
  return recorrencia?.lembradas[originalId] === ativoId ? `nos treinos ${recorrencia.treinoId}` : "só hoje";
}

function execucaoAberta(escopo: Element | null) {
  return escopo?.querySelector<HTMLDetailsElement>("details[data-execucao-da-alternativa][open]");
}

function ExecucaoDaAlternativa({ exercicio }: { exercicio: Exercicio }) {
  const [aberta, setAberta] = useState(false);
  const conteudoId = useId();
  return (
    <details data-execucao-da-alternativa className="group/execucao min-w-0"
      onToggle={evento => setAberta(evento.currentTarget.open)}>
      <summary role="button" aria-label={`Ver execução de ${exercicio.nome}`} aria-controls={conteudoId} aria-expanded={aberta}
        onClick={evento => {
          // O summary abre com toque, Enter e Espaço, inclusive no Safari sem details.name.
          const gatilho = evento.currentTarget;
          const anterior = execucaoAberta(gatilho.closest("ul"));
          if (anterior && anterior !== gatilho.parentElement) anterior.open = false;
        }}
        className="foco alvo text-primary hover:bg-muted flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm font-medium">
        Ver execução
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open/execucao:rotate-180" />
      </summary>
      <section id={conteudoId} aria-label={`Execução de ${exercicio.nome}`}
        className="mb-2 flex min-w-0 flex-col gap-3 rounded-lg bg-muted/50 p-3 wrap-anywhere">
        {aberta && (
          <>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Montagem</h3>
              <p className="text-muted-foreground text-sm">{exercicio.montagem}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Instruções</h3>
              <PassosDoExercicio passos={exercicio.passos} />
            </div>
          </>
        )}
      </section>
    </details>
  );
}

/** Um primeiro Escape recolhe a execução dentro da folha; o seguinte fecha a folha. */
export function recolherExecucaoDaAlternativa(evento: KeyboardEvent) {
  if (!(evento.target instanceof Element)) return;
  const aberta = execucaoAberta(evento.target.closest('[role="dialog"]'));
  if (!aberta) return;
  evento.preventDefault();
  aberta.open = false;
  aberta.querySelector("summary")?.focus();
}

/** Os mesmos filtros e alternativas na ficha, no player e na lista do dia. */
export function OpcoesDeAlternativa({
  exercicioId, originalId = exercicioId, ocupados, recorrencia, material, prefs, aoSubstituir,
}: Escolha) {
  const [filtro, setFiltro] = useState<FiltroAlternativa>("todos");
  const [busca, setBusca] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);
  const buscaId = useId();
  const [materialLocal, setMaterialLocal] = useState<ReadonlySet<EquipamentoTag>>(equipamentoDisponivel);
  const materialAtual = material ?? { disponiveis: materialLocal, aoMudar: setMaterialLocal };
  const { disponiveis } = materialAtual;
  const [lembrar, setLembrar] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const ocupado = useRef(false);
  const nomeDoGrupo = useId();
  const paraOPrograma = lembrar && recorrencia;
  const origem = acharExercicio(paraOPrograma ? originalId : exercicioId);
  const lembradasDosOutros = paraOPrograma
    ? Object.entries(resolverTrocasDoTreino(paraOPrograma.treinoId, paraOPrograma.lembradas))
        .filter(([original]) => original !== originalId)
    : [];
  const alternativas = alternativasPara(origem.id, filtro, disponiveis).filter((e) => {
    if (ocupados?.includes(e.id)) return false;
    if (!paraOPrograma) return true;
    const mapa = { ...paraOPrograma.lembradas, [originalId]: e.id };
    const efetivas = resolverTrocasDoTreino(paraOPrograma.treinoId, mapa);
    return efetivas[originalId] === e.id &&
      lembradasDosOutros.every(([original, destino]) => efetivas[original] === destino);
  });
  const opcoes = evitadosPorUltimo(alternativas, (e) => e.id, prefs);
  const visiveis = filtrarExercicios(opcoes, { busca });

  async function aplicar(paraHoje: string, paraOProximo: string | null) {
    if (ocupado.current) return;
    setErro("");
    if (recorrencia && (paraOPrograma || paraOProximo === null)) {
      ocupado.current = true;
      setGravando(true);
      try {
        await recorrencia.aoLembrar(originalId, paraOProximo);
      } catch {
        setErro("Não foi possível guardar a mudança para os próximos treinos. Tente de novo.");
        return;
      } finally {
        ocupado.current = false;
        setGravando(false);
      }
    }
    aoSubstituir(paraHoje);
  }

  return (
    <div className="flex flex-col gap-3">
      {recorrencia && (
        <fieldset disabled={gravando} className="flex min-w-0 flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Aplicar a troca</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
            {([false, true] as const).map((valor) => (
              <label key={String(valor)} className="alvo flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm has-checked:border-primary">
                <input type="radio" name={nomeDoGrupo} checked={lembrar === valor}
                  onChange={() => { setLembrar(valor); setErro(""); }} className="shrink-0 accent-primary" />
                <span className="min-w-0 wrap-anywhere">{valor ? `Usar nos próximos ${recorrencia.treinoId}` : "Só neste treino"}</span>
              </label>
            ))}
          </div>
          {recorrencia.lembradas[originalId] && (
            <Button type="button" variant="ghost" className="alvo h-auto justify-start whitespace-normal text-left"
              onClick={() => void aplicar(exercicioId, null)}>
              Restaurar {acharExercicio(originalId).nome} nos próximos {recorrencia.treinoId}
            </Button>
          )}
        </fieldset>
      )}
      {erro && <p role="alert" className="text-destructive text-sm">{erro}</p>}
      <div role="group" aria-label="Equipamento para a alternativa" className="flex flex-wrap gap-1.5">
        {(Object.keys(FILTROS) as FiltroAlternativa[]).map((valor) => (
          <Button
            key={valor}
            type="button"
            size="sm"
            variant={filtro === valor ? "default" : "outline"}
            aria-pressed={filtro === valor}
            className="alvo h-auto max-w-full whitespace-normal px-3 py-1 wrap-anywhere"
            onClick={() => setFiltro(valor)}
          >
            {FILTROS[valor]}
          </Button>
        ))}
      </div>
      <EquipamentoDeHoje material={materialAtual} noSeletor />
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={buscaId} className="text-sm font-medium wrap-anywhere">Buscar alternativa pelo nome</label>
        <div className="flex items-center gap-1">
          <Input id={buscaId} ref={campoBusca} type="search" inputMode="search"
            value={busca} onChange={evento => setBusca(evento.target.value)}
            className="alvo h-12 flex-1 px-2 text-base [&::-webkit-search-cancel-button]:appearance-none" />
          {busca && (
            <Button type="button" size="icon" variant="ghost" aria-label="Limpar busca"
              className="alvo w-[max(44px,2rem)] shrink-0" onClick={() => { setBusca(""); campoBusca.current?.focus(); }}>
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      {visiveis.length ? (
        <ul aria-label="Exercícios alternativos" className="flex flex-col divide-y">
          {visiveis.map((e) => {
            const equipamento = montagensParaTroca(origem, e, filtro, disponiveis).map((kit) =>
              kit.length ? kit.map(nomeDoMaterial).join(" + ") : "Peso do corpo",
            ).join(" ou ");
            return (
              <li key={e.id} className="min-w-0 py-1">
                <button type="button" disabled={gravando} onClick={() => void aplicar(e.id, e.id)}
                  className="hover:bg-muted alvo flex w-full flex-col items-start gap-1 rounded-lg px-2 py-2 text-left wrap-anywhere">
                  <span className="text-sm font-semibold">{e.nome}</span>
                  <span className="text-muted-foreground text-xs">{e.prescricao_padrao.texto} · {equipamento}</span>
                  <span className="text-muted-foreground text-xs">{motivoDaAlternativa(origem, e)}</span>
                  {evitado(prefs, e.id) ? <span className="text-muted-foreground text-xs">Você marcou como evitar.</span> : null}
                </button>
                <ExecucaoDaAlternativa exercicio={e} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p role="status" className="text-muted-foreground text-sm">
          {opcoes.length ? "Nenhuma alternativa com esse nome." :
            "Nenhuma alternativa com este equipamento. Escolha outro filtro ou ajuste os equipamentos disponíveis."}
        </p>
      )}
    </div>
  );
}

/** O botão pode estar dentro da folha (trigger) ou ser controlado pelo player. */
export function SeletorAlternativa({
  exercicioId, originalId, ocupados, recorrencia, material, prefs, aoSubstituir, aberto, aoMudarAberto, children,
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
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto pb-8" onEscapeKeyDown={recolherExecucaoDaAlternativa}>
        <SheetHeader className="pr-14 pb-0">
          <SheetTitle>Substituir hoje</SheetTitle>
          <SheetDescription>
            {acharExercicio(exercicioId).nome}. {antesDoTreino ? "Escolha o exercício para o treino de hoje." : avisoDaTroca}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          {voltarAoOriginal && (!originalId || !ocupados?.includes(originalId)) && (
            <Button type="button" variant="outline" className="alvo h-auto whitespace-normal"
              onClick={() => { voltarAoOriginal.escolher(); mudarAberto(false); }}>
              Voltar para {voltarAoOriginal.nome}{recorrencia && " só neste treino"}
            </Button>
          )}
          <OpcoesDeAlternativa key={exercicioId} exercicioId={exercicioId} originalId={originalId}
            ocupados={ocupados} recorrencia={recorrencia} material={material} prefs={prefs}
            aoSubstituir={(id) => { aoSubstituir(id); mudarAberto(false); }} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

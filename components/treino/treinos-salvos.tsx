"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetDescription } from "@/components/ui/sheet";
import { ajustesDoModeloConfirmados, modeloCompativelComCatalogo } from "@/lib/modelo-de-treino";
import { useModelosDeTreino, type ModeloDeTreino } from "@/lib/queries/modelos-de-treino";
import { useRede } from "@/lib/usar-rede";

export type PainelDosModelos =
  | { tipo: "salvos" }
  | { tipo: "salvar"; id: string }
  | { tipo: "excluir"; modelo: ModeloDeTreino }
  | { tipo: "descartar"; proximo: ModeloDeTreino | null };

const botao = "alvo h-auto max-w-full whitespace-normal wrap-anywhere py-2";
const painel = "min-h-0 overflow-y-auto px-5 pb-1";

function impedimentoParaAbrir(modelo: ModeloDeTreino): string | null {
  if (!modeloCompativelComCatalogo(modelo)) return "Atualize o app para usar este treino";
  if (ajustesDoModeloConfirmados(modelo)) return null;
  if (modelo.descansos_por_exercicio !== undefined) return "As séries deste treino precisam ser confirmadas online.";
  if (modelo.series_por_exercicio !== undefined) return "O descanso deste treino precisa ser confirmado online.";
  return "As séries e o descanso deste treino precisam ser confirmados online.";
}

export function TreinosSalvos({ conta, oculto, aoEscolher, aoExcluir, aoVoltar }: {
  conta: string;
  oculto: boolean;
  aoEscolher: (modelo: ModeloDeTreino | null, gatilho: HTMLButtonElement) => void;
  aoExcluir: (modelo: ModeloDeTreino, gatilho: HTMLButtonElement) => void;
  aoVoltar: () => void;
}) {
  const consulta = useModelosDeTreino(conta);
  const online = useRede();
  const modelos = [...(consulta.data ?? [])].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id),
  );
  return (
    <div className={painel} hidden={oculto}>
      {consulta.isPending && <p role="status" className="text-muted-foreground text-sm">Carregando treinos…</p>}
      {consulta.isError && (
        <div>
          <p role="alert" className="text-sm">Não foi possível consultar os treinos salvos.</p>
          <Button type="button" variant="outline" className={botao} onClick={() => void consulta.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {consulta.isSuccess && modelos.length === 0 && (
        <p className="text-muted-foreground text-sm">Nenhum treino salvo. Escolha os exercícios e toque em Salvar treino.</p>
      )}
      {modelos.length > 0 && (
        <ul aria-label="Treinos salvos" className="divide-y">
          {modelos.map(modelo => {
            const motivo = impedimentoParaAbrir(modelo);
            const aviso = motivo ? `aviso-modelo-${modelo.id}` : undefined;
            return (
              <li key={modelo.id} className="flex items-center gap-1 py-1">
                <button type="button" aria-label={`Carregar ${modelo.nome}`} aria-describedby={aviso} disabled={!!motivo}
                  className="alvo enabled:hover:bg-muted/50 flex min-w-0 flex-1 flex-col items-start rounded-lg p-2 text-left"
                  onClick={evento => aoEscolher(modelo, evento.currentTarget)}>
                  <span className="text-sm font-semibold wrap-anywhere">{modelo.nome}</span>
                  <span id={aviso} className="text-muted-foreground text-xs wrap-anywhere">
                    {motivo ?? `${modelo.exercicios.length} ${modelo.exercicios.length === 1 ? "exercício" : "exercícios"}`}
                  </span>
                </button>
                <Button type="button" size="icon" variant="ghost" className="alvo shrink-0" aria-label={`Excluir ${modelo.nome}`}
                  onClick={evento => aoExcluir(modelo, evento.currentTarget)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {online && !consulta.isError && modelos.some(m => !ajustesDoModeloConfirmados(m) && modeloCompativelComCatalogo(m)) && (
          <Button type="button" variant="outline" className={botao} disabled={consulta.isFetching}
            onClick={() => void consulta.refetch()}>{consulta.isFetching ? "Conferindo ajustes…" : "Conferir ajustes"}</Button>
        )}
        <Button type="button" variant="outline" className={botao}
          onClick={evento => aoEscolher(null, evento.currentTarget)}>Novo treino</Button>
        <Button type="button" variant="ghost" className={botao} onClick={aoVoltar}>Voltar</Button>
      </div>
    </div>
  );
}

export function NomeDoTreino({ nome, aoMudar, atualizando, gravando, erro, aoSalvar, aoVoltar }: {
  nome: string;
  aoMudar: (nome: string) => void;
  atualizando: boolean;
  gravando: boolean;
  erro: string | null;
  aoSalvar: () => void;
  aoVoltar: () => void;
}) {
  return (
    <form className={painel} onSubmit={evento => { evento.preventDefault(); aoSalvar(); }}>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nome do treino
        <Input autoComplete="off" enterKeyHint="done" maxLength={80} required value={nome}
          disabled={gravando} onChange={evento => aoMudar(evento.target.value)} />
      </label>
      {erro && <p role="alert" className="text-destructive mt-2 text-sm">{erro}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={gravando || !nome.trim()} className={botao}>
          {gravando ? "Salvando…" : atualizando ? "Salvar alterações" : "Salvar"}
        </Button>
        <Button type="button" disabled={gravando} variant="outline" className={botao} onClick={aoVoltar}>Cancelar</Button>
      </div>
    </form>
  );
}

export function ConfirmacaoDoModelo({ gravando, erro, aoCancelar, acao, descricao, aoConfirmar }: {
  gravando: boolean;
  erro: string | null;
  aoCancelar: () => void;
  acao: "Excluir treino" | "Descartar alterações";
  descricao: string;
  aoConfirmar: () => void;
}) {
  return (
    <div className={painel}>
      <SheetDescription className="mb-3 wrap-anywhere">{descricao}</SheetDescription>
      {erro && <p role="alert" className="text-destructive mb-2 text-sm">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={botao} disabled={gravando} onClick={aoCancelar}>Cancelar</Button>
        <Button type="button" variant="destructive" className={botao} disabled={gravando} onClick={aoConfirmar}>
          {gravando ? "Excluindo…" : acao}
        </Button>
      </div>
    </div>
  );
}

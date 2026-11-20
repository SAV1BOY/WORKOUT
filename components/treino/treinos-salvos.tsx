"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetDescription } from "@/components/ui/sheet";
import { semAcento } from "@/lib/catalogo";
import { exercicioPorId } from "@/lib/dados";
import { ajustesDoModeloConfirmados, LIMITE_DO_NOME_DO_TREINO, modeloCompativelComCatalogo } from "@/lib/modelo-de-treino";
import { useModelosDeTreino, type ModeloDeTreino } from "@/lib/queries/modelos-de-treino";
import { useRede } from "@/lib/usar-rede";

export type PainelDosModelos =
  | { tipo: "salvos" }
  | { tipo: "salvar"; id: string; modo: "novo" | "atualizar" | "copia" }
  | { tipo: "iniciar"; modelo: ModeloDeTreino }
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

function nomeDoMovimento(id: string): string {
  return exercicioPorId.get(id)?.nome ?? "Exercício fora do catálogo";
}

export function TreinosSalvos({ conta, oculto, ocupado, pronto, aoIniciar, aoEscolher, aoExcluir, aoVoltar }: {
  conta: string;
  oculto: boolean;
  ocupado: boolean;
  pronto: boolean;
  aoIniciar: (modelo: ModeloDeTreino, gatilho: HTMLButtonElement) => void;
  aoEscolher: (modelo: ModeloDeTreino | null, gatilho: HTMLButtonElement) => void;
  aoExcluir: (modelo: ModeloDeTreino, gatilho: HTMLButtonElement) => void;
  aoVoltar: () => void;
}) {
  const consulta = useModelosDeTreino(conta);
  const online = useRede();
  const [busca, setBusca] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);
  const idDaBusca = useId();
  useEffect(() => {
    const campo = campoBusca.current;
    const folha = campo?.closest<HTMLElement>('[role="dialog"]');
    if (!campo || !folha) return;
    const viewport = window.visualViewport;
    const revelar = () => {
      if (document.activeElement !== campo) return;
      const caixa = campo.getBoundingClientRect();
      const limites = folha.getBoundingClientRect();
      const topoDaTela = viewport?.offsetTop ?? 0;
      const topo = Math.max(limites.top, topoDaTela);
      const fim = Math.min(limites.bottom, topoDaTela + (viewport?.height ?? window.innerHeight));
      const faixa = Math.min(fim, caixa.bottom) - Math.max(topo, caixa.top);
      // O WebKit pode focar um input deixando só uma beirada tocável na folha.
      if (fim > topo && faixa < Math.min(44, fim - topo, caixa.height)) {
        folha.scrollTop += caixa.top < topo ? caixa.top - topo : caixa.bottom - fim;
      }
    };
    const aposFoco = () => requestAnimationFrame(revelar);
    campo.addEventListener("focus", aposFoco);
    viewport?.addEventListener("resize", revelar);
    return () => {
      campo.removeEventListener("focus", aposFoco);
      viewport?.removeEventListener("resize", revelar);
    };
  }, []);
  const modelos = [...(consulta.data ?? [])].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id),
  );
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const contagemPorNome = new Map<string, number>();
  for (const modelo of modelos) {
    const nome = semAcento(modelo.nome);
    contagemPorNome.set(nome, (contagemPorNome.get(nome) ?? 0) + 1);
  }
  const visiveis = modelos.filter(modelo => {
    const nome = semAcento(modelo.nome);
    return termos.every(termo => nome.includes(termo));
  });
  const buscaAtiva = consulta.isSuccess && modelos.length > 0 && termos.length > 0;
  return (
    <div className={painel} hidden={oculto}>
      <label htmlFor={idDaBusca} className="text-sm font-medium wrap-anywhere">Buscar treino salvo</label>
      <div className="mt-1 mb-3 flex items-center gap-1">
        <Input id={idDaBusca} ref={campoBusca} type="search" inputMode="search" value={busca}
          onChange={evento => setBusca(evento.target.value)} disabled={ocupado}
          className="alvo h-12 min-w-0 flex-1 px-2 text-base [&::-webkit-search-cancel-button]:appearance-none" />
        {busca && <Button type="button" size="icon" variant="ghost" aria-label="Limpar busca" disabled={ocupado}
          className="alvo w-[max(44px,2rem)] shrink-0" onClick={() => { setBusca(""); campoBusca.current?.focus(); }}>
          <X aria-hidden="true" />
        </Button>}
      </div>
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
      <p role="status" className={buscaAtiva && visiveis.length === 0 ? "text-muted-foreground text-sm" : "sr-only"}>
        {buscaAtiva && (visiveis.length === 0 ? "Nenhum treino encontrado para essa busca." :
          visiveis.length === 1 ? "1 treino encontrado." : `${visiveis.length} treinos encontrados.`)}
      </p>
      {visiveis.length > 0 && (
        <ul aria-label="Treinos salvos" className="divide-y">
          {visiveis.map(modelo => {
            const motivo = impedimentoParaAbrir(modelo);
            const aviso = motivo ? `aviso-modelo-${modelo.id}` : undefined;
            const carregar = `carregar-modelo-${modelo.id}`;
            const previa = (contagemPorNome.get(semAcento(modelo.nome)) ?? 0) > 1 ? `exercicios-modelo-${modelo.id}` : undefined;
            const descricao = [aviso, previa].filter(Boolean).join(" ") || undefined;
            return (
              <li key={modelo.id} className="space-y-1 py-3">
                <label htmlFor={carregar} className="block cursor-pointer wrap-anywhere">
                  <span className="block text-sm font-semibold">{modelo.nome}</span>
                  <span id={aviso} className="text-muted-foreground block text-xs">
                    {motivo ?? `${modelo.exercicios.length} ${modelo.exercicios.length === 1 ? "exercício" : "exercícios"}`}
                  </span>
                  {previa && <span id={previa} className="block text-xs">
                    {modelo.exercicios.slice(0, 2).map(nomeDoMovimento).join(" · ")}
                  </span>}
                </label>
                {previa && modelo.exercicios.length > 2 && <details>
                  <summary className="alvo cursor-pointer content-center rounded-lg py-2 text-sm font-medium wrap-anywhere">
                    Ver os {modelo.exercicios.length} exercícios
                  </summary>
                  <ol aria-label={`Exercícios de ${modelo.nome}`} className="list-decimal space-y-1 ps-6 pb-2 text-sm wrap-anywhere">
                    {modelo.exercicios.map(id => <li key={id}>{nomeDoMovimento(id)}</li>)}
                  </ol>
                </details>}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" className={botao} aria-label={`Começar ${modelo.nome}`} aria-describedby={descricao}
                    disabled={!!motivo || ocupado || !pronto} onClick={evento => aoIniciar(modelo, evento.currentTarget)}>Começar</Button>
                  <Button id={carregar} type="button" variant="outline" className={botao} aria-label={`Carregar ${modelo.nome}`} aria-describedby={descricao}
                    disabled={!!motivo || ocupado} onClick={evento => aoEscolher(modelo, evento.currentTarget)}>Carregar</Button>
                  <Button type="button" size="icon" variant="ghost" className="alvo" disabled={ocupado} aria-label={`Excluir ${modelo.nome}`} aria-describedby={previa}
                    onClick={evento => aoExcluir(modelo, evento.currentTarget)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {online && !consulta.isError && modelos.some(m => !ajustesDoModeloConfirmados(m) && modeloCompativelComCatalogo(m)) && (
          <Button type="button" variant="outline" className={botao} disabled={consulta.isFetching || ocupado}
            onClick={() => void consulta.refetch()}>{consulta.isFetching ? "Conferindo ajustes…" : "Conferir ajustes"}</Button>
        )}
        <Button type="button" variant="outline" className={botao} disabled={ocupado}
          onClick={evento => aoEscolher(null, evento.currentTarget)}>Novo treino</Button>
        <Button type="button" variant="ghost" className={botao} disabled={ocupado} onClick={aoVoltar}>Voltar</Button>
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
  const idDoLimite = useId();
  const [compondo, setCompondo] = useState(false);
  const nomeAparado = nome.trim();
  const excedeuLimite = [...nomeAparado].length > LIMITE_DO_NOME_DO_TREINO;
  const mostrarLimite = excedeuLimite && !compondo;
  const podeSalvar = !gravando && !compondo && !excedeuLimite && nomeAparado.length > 0;
  return (
    <form className={painel} onSubmit={evento => { evento.preventDefault(); if (podeSalvar) aoSalvar(); }}>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nome do treino
        <Input autoComplete="off" enterKeyHint="done" required value={nome}
          aria-invalid={mostrarLimite || undefined} aria-describedby={mostrarLimite ? idDoLimite : undefined}
          onCompositionStart={() => setCompondo(true)} onCompositionEnd={() => setCompondo(false)}
          disabled={gravando} onChange={evento => aoMudar(evento.target.value)} />
      </label>
      {mostrarLimite && <p id={idDoLimite} role="alert" className="text-destructive mt-2 text-sm">
        Use até {LIMITE_DO_NOME_DO_TREINO} caracteres no nome do treino.
      </p>}
      {erro && <p role="alert" className="text-destructive mt-2 text-sm">{erro}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={!podeSalvar} className={botao}>
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
  acao: "Excluir treino" | "Descartar alterações" | "Começar treino";
  descricao: string;
  aoConfirmar: () => void;
}) {
  return (
    <div className={painel}>
      <SheetDescription className="mb-3 wrap-anywhere">{descricao}</SheetDescription>
      {erro && <p role="alert" className="text-destructive mb-2 text-sm">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={botao} disabled={gravando} onClick={aoCancelar}>Cancelar</Button>
        <Button type="button" variant={acao === "Começar treino" ? "default" : "destructive"} className={botao} disabled={gravando} onClick={aoConfirmar}>
          {gravando ? (acao === "Começar treino" ? "Começando…" : "Excluindo…") : acao}
        </Button>
      </div>
    </div>
  );
}

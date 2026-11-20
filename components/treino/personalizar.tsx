"use client";

import { ArrowUpDown, Check, Plus, Search, SearchX, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSessaoLivre } from "@/components/colecoes/usar-sessao-livre";
import { EquipamentoDeHoje, nomeDoMaterial } from "@/components/exercicio/equipamento-de-hoje";
import { OrdemDosEscolhidos } from "@/components/treino/ordem-dos-escolhidos";
import { Button } from "@/components/ui/button";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Input } from "@/components/ui/input";
import { Miniatura } from "@/components/ui/miniatura";
import { Vazio } from "@/components/ui/vazio";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { equipamentosDaAlternativa } from "@/lib/alternativas";
import { filtrarExercicios } from "@/lib/catalogo";
import { acharExercicio, equipamentoDisponivel, exerciciosComVariacoes } from "@/lib/dados";
import { mover } from "@/lib/ordem";
import { evitadosPorUltimo } from "@/lib/preferencias";
import type { Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";

const inventarioCompleto = equipamentoDisponivel();

/**
 * Começa um treino livre com os movimentos do catálogo e suas variações,
 * na ordem escolhida antes de começar.
 */
export function Personalizar({ prefs }: { prefs?: Prefs }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [material, setMaterial] = useState(inventarioCompleto);
  const [reordenando, setReordenando] = useState(false);
  const campoBusca = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const gatilhoDaOrdem = useRef<HTMLButtonElement>(null);
  const iniciando = useRef(false);
  const focoAoAlternar = useRef(false);

  useLayoutEffect(() => {
    if (!focoAoAlternar.current) return;
    focoAoAlternar.current = false;
    (reordenando ? titulo.current : gatilhoDaOrdem.current)?.focus();
  }, [reordenando]);

  function mostrarOrdem(mostrar: boolean) {
    focoAoAlternar.current = true;
    setReordenando(mostrar);
  }

  const equipamentoPorExercicio = useMemo(() => {
    const disponiveis = new Map<string, string>();
    for (const e of exerciciosComVariacoes) {
      const kits = equipamentosDaAlternativa(e, material);
      if (!kits.length) continue;
      const montagem = material.size === inventarioCompleto.size ? e.equipamento_texto
        : kits.map(kit => kit.length ? kit.map(nomeDoMaterial).join(" + ") : "Peso do corpo").join(" ou ");
      disponiveis.set(e.id, montagem);
    }
    return disponiveis;
  }, [material]);

  const achados = useMemo(
    () =>
      evitadosPorUltimo(
        filtrarExercicios(exerciciosComVariacoes, { busca }).filter(e => equipamentoPorExercicio.has(e.id)),
        (e) => e.id,
        prefs,
      ),
    [busca, equipamentoPorExercicio, prefs],
  );

  const { comecar, ocupado, pronto } = useSessaoLivre(escolhidos);

  const alternar = (id: string) =>
    setEscolhidos((atuais) =>
      atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
    );

  function moverEscolhido(id: string, direcao: -1 | 1) {
    setEscolhidos(atuais => {
      const indice = atuais.indexOf(id);
      return mover(atuais, indice, indice + direcao);
    });
  }

  async function iniciar() {
    if (iniciando.current || ocupado || !pronto || escolhidos.length === 0) return;
    iniciando.current = true;
    try {
      await comecar(escolhidos, { titulo: "Treino personalizado", equipamentosDisponiveis: material });
    } finally {
      iniciando.current = false;
    }
  }

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (!v && ocupado) return;
        setAberto(v);
        if (!v) {
          focoAoAlternar.current = false;
          setReordenando(false);
          setBusca("");
        }
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          className="cartao border-border bg-card hover:bg-muted/40 alvo flex w-full items-center gap-3 border border-dashed px-4 py-4 text-left"
        >
          <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
            <Plus aria-hidden="true" className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">Personalizar treino</span>
            <span className="text-muted-foreground text-xs">
              Crie o seu próprio, com os exercícios que quiser.
            </span>
          </span>
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col pb-8"
        showCloseButton={!ocupado}
        onEscapeKeyDown={evento => {
          if (reordenando) {
            evento.preventDefault();
            mostrarOrdem(false);
          }
        }}>
        <SheetHeader className="pb-0">
          <SheetTitle ref={titulo} className="pr-10 wrap-anywhere">
            {reordenando ? "Reordenar escolhidos" : "Crie o seu próprio"}
          </SheetTitle>
          {reordenando && <SheetDescription>{escolhidos.length} exercícios no treino.</SheetDescription>}
        </SheetHeader>

        {reordenando && <OrdemDosEscolhidos ids={escolhidos} aoMover={moverEscolhido} aoFechar={() => mostrarOrdem(false)} />}
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 px-4", reordenando && "hidden")}>
          <div className="min-h-0 overflow-y-auto px-1">
            {!reordenando && (
              <SheetDescription className="mb-3">
                Escolha e ordene seus exercícios. Cada um mantém a prescrição do catálogo e a sua progressão.
              </SheetDescription>
            )}
            <div className="relative flex items-center gap-1">
              {!busca && <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />}
              <Input
                ref={campoBusca}
                type="search"
                inputMode="search"
                value={busca}
                disabled={ocupado}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar exercício"
                aria-label="Buscar exercício pelo nome"
                className={cn("alvo h-12 min-w-0 flex-1 text-base [&::-webkit-search-cancel-button]:appearance-none", busca ? "px-2" : "pl-9")}
              />
              {busca && (
                <Button type="button" size="icon" variant="ghost" aria-label="Limpar busca" disabled={ocupado}
                  className="alvo w-[max(44px,2rem)] shrink-0" onClick={() => { setBusca(""); campoBusca.current?.focus(); }}>
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="mt-3">
              <EquipamentoDeHoje material={{ disponiveis: material, aoMudar: setMaterial }} noSeletor
                desabilitado={ocupado} descricao="O catálogo mostra os exercícios que você pode fazer com o material marcado." />
            </div>

            {escolhidos.length >= 2 && (
              <Button ref={gatilhoDaOrdem} type="button" variant="outline" disabled={ocupado}
                className="alvo mt-3 h-auto max-w-full whitespace-normal py-2"
                onClick={() => mostrarOrdem(true)}>
                <ArrowUpDown aria-hidden="true" className="size-4 shrink-0" />
                Reordenar escolhidos
              </Button>
            )}
            {escolhidos.length > 0 ? (
              <ul aria-label="Escolhidos" className="mt-3 flex flex-wrap gap-2">
                {escolhidos.map((id, i) => {
                  const nome = acharExercicio(id).nome;
                  const faltaMaterial = !equipamentoPorExercicio.has(id);
                  const aviso = `material-escolhido-${id}`;
                  return (
                    <li key={id} className="max-w-full">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => alternar(id)}
                        aria-label={`Tirar ${nome}`}
                        aria-describedby={faltaMaterial ? aviso : undefined}
                        className="border-primary bg-primary/10 alvo flex min-h-11 max-w-full items-center gap-1 rounded-full border px-3 py-1 text-left text-xs wrap-anywhere"
                      >
                        <span className="numero">{i + 1}.</span>
                        <span className="min-w-0">
                          {nome}
                          {faltaMaterial && <span id={aviso} className="block font-medium">Requer outro material</span>}
                        </span>
                        <X aria-hidden="true" className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <ul
              aria-label="Catálogo"
              className="@container mt-3 divide-y"
            >
              {achados.map((e) => {
                const marcado = escolhidos.includes(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-pressed={marcado}
                      disabled={ocupado}
                      onClick={() => alternar(e.id)}
                      className="hover:bg-muted/40 alvo grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-2 text-left @2xs:flex @2xs:gap-3"
                    >
                      <Miniatura exercicioId={e.id} className="col-start-1 row-start-2 size-11 @2xs:size-14" />
                      <span className="col-span-full row-start-1 flex min-w-0 flex-1 flex-col gap-0.5 wrap-anywhere">
                        <span className="text-sm font-medium text-balance">{e.nome}</span>
                        <span className="numero text-muted-foreground text-xs">
                          {e.prescricao_padrao.texto} · {equipamentoPorExercicio.get(e.id)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "col-start-2 row-start-2 flex size-6 shrink-0 items-center justify-center rounded-full border",
                          marcado
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {marcado ? (
                          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
              {achados.length === 0 ? (
                <li>
                  <Vazio
                    icone={SearchX}
                    titulo="Nenhum exercício com os filtros atuais"
                    frase="Tente outro nome ou ajuste os equipamentos disponíveis."
                    className="border-0"
                  />
                </li>
              ) : null}
            </ul>
          </div>

          <BotaoLargo
            className="h-auto min-h-14 shrink-0 py-2 whitespace-normal"
            disabled={!pronto || ocupado || escolhidos.length === 0}
            onClick={() => void iniciar()}
          >
            {/* SPEC §22.7 item 8: "Começar com 3 exercícios", não "Começar (3)" */}
            {ocupado
              ? "Começando…"
              : escolhidos.length === 0
                ? "Escolha os exercícios"
                : `Começar com ${escolhidos.length} ${
                    escolhidos.length === 1 ? "exercício" : "exercícios"
                  }`}
          </BotaoLargo>
        </div>
      </SheetContent>
    </Sheet>
  );
}

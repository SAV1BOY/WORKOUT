"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LinhaColecao } from "@/components/colecoes/linha-colecao";
import { Skeleton } from "@/components/ui/skeleton";
import { ListaExercicios } from "@/components/exercicios/lista-exercicios";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Button } from "@/components/ui/button";
import { CardCapa } from "@/components/ui/card-capa";
import { Input } from "@/components/ui/input";
import { treinoDeHoje } from "@/lib/calendario";
import {
  buscarColecoes,
  circuitos,
  colecoesDePlano,
  colecoesDeTreino,
  colecoesPorAparelho,
  colecoesPorGrupo,
  desafios,
  type Colecao,
} from "@/lib/colecoes";
import { proximoTreinoDaFase, semanaDaFase } from "@/lib/calendario";
import { detalheDoTreino, resumoDoTreino } from "@/lib/hoje";
import { capaDoTreino } from "@/lib/capas";
import { dificuldadeDaColecao } from "@/lib/dificuldade";
import { exerciciosDoTreino } from "@/lib/dados";
import { ligado } from "@/lib/preferencias";
import { useOverrides, usePerfil } from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";

/** Quantas linhas uma seção mostra antes do "Ver todos". */
const PREVIA = 3;

/**
 * `/explorar` (SPEC §13.4 e §14.4): busca sempre visível, um destaque, as
 * coleções derivadas dos JSON em "Escolhas para você" e o catálogo dos 81
 * embaixo. Nenhum texto de marketing: título, subtítulo e detalhe saem dos
 * próprios JSON.
 */
export function TelaExplorar() {
  const hoje = useHoje();
  const [busca, setBusca] = useState("");

  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;
  const intervalo = hoje ? intervaloDaSemana(hoje) : null;
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);

  const dia = useMemo(() => {
    if (!hoje || !perfil) return null;
    return treinoDeHoje(hoje, perfil, overridesQ.data ?? []);
  }, [hoje, perfil, overridesQ.data]);

  const mostrarRaios = ligado(perfil?.prefs, "mostrar_raios");

  const secoes = useMemo(
    () => [
      { titulo: "Treinos do programa", itens: colecoesDeTreino() },
      { titulo: "Parte do corpo", itens: colecoesPorGrupo() },
      { titulo: "Circuitos", itens: circuitos() },
      { titulo: "Por aparelho", itens: colecoesPorAparelho() },
      { titulo: "Planos", itens: colecoesDePlano() },
    ],
    [],
  );

  /** O destaque só aparece com perfil e overrides na mão (§22.2 item 2). */
  const pronto = Boolean(hoje && perfil) && !overridesQ.isPending;

  const achadas = useMemo(
    () => (busca.trim() === "" ? [] : buscarColecoes(busca)),
    [busca],
  );
  const buscando = busca.trim() !== "";

  return (
    <section aria-label="Explorar" className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Explorar</h1>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            inputMode="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar exercício ou coleção"
            aria-label="Buscar exercício ou coleção"
            className="alvo h-12 pl-9 text-base"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar a busca"
              className="alvo text-muted-foreground absolute top-1/2 right-0 flex -translate-y-1/2 items-center justify-center"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      {buscando ? (
        <section aria-label="Coleções encontradas" className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">
            Coleções ({achadas.length})
          </h2>
          {achadas.length === 0 ? (
            <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
              Nenhuma coleção com esse nome.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {achadas.map((c) => (
                <li key={c.id}>
                  <LinhaColecao colecao={c} mostrarRaios={mostrarRaios} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/*
            SPEC §22.2 item 2: o destaque é a única parte de `/explorar` que
            espera o servidor (perfil + overrides da semana). Enquanto ele não
            chega, o lugar dele fica reservado com um esqueleto da MESMA forma
            do `CardCapa` — antes a tela montava sem destaque e pulava quando o
            perfil chegava. As seções e o catálogo saem dos JSON e não esperam.
          */}
          {pronto ? (
            <Destaque perfil={perfil} dia={dia} hoje={hoje} mostrarRaios={mostrarRaios} />
          ) : (
            <EsqueletoDoDestaque />
          )}
          <h2 className="text-base font-semibold">Escolhas para você</h2>
          {secoes.map((s) => (
            <Secao
              key={s.titulo}
              titulo={s.titulo}
              itens={s.itens}
              mostrarRaios={mostrarRaios}
            />
          ))}
        </>
      )}

      <section aria-label="Catálogo" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Todos os exercícios</h2>
        <ListaExercicios busca={busca} />
      </section>
    </section>
  );
}

/* --------------------------------------------------------- destaque */

/** A forma do `CardCapa` do destaque, para a tela não pular (SPEC §22.2). */
function EsqueletoDoDestaque() {
  return (
    <article
      role="status"
      aria-label="Carregando o destaque"
      className="cartao border-border bg-card overflow-hidden border"
    >
      <div className="bg-muted/60 flex min-h-40 w-full flex-col justify-end gap-2 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="p-4">
        <Skeleton className="h-12 w-full" />
      </div>
    </article>
  );
}

type Dia = ReturnType<typeof treinoDeHoje> | null;

/**
 * Um destaque no topo (SPEC §14.4): o treino de hoje quando há treino de
 * força; senão a sessão da semana do plano que está em curso.
 */
function Destaque({
  perfil,
  dia,
  hoje,
  mostrarRaios,
}: {
  perfil: ReturnType<typeof usePerfil>["data"] | null;
  dia: Dia;
  hoje: string | null;
  mostrarRaios: boolean;
}) {
  if (!perfil || !hoje) return null;

  const treinoId = dia?.tipo === "forca" ? dia.treinoId : null;
  if (treinoId) {
    const resumo = resumoDoTreino(treinoId);
    const raios = dificuldadeDaColecao(
      exerciciosDoTreino(treinoId).map(({ exercicio }) => exercicio),
    );
    return (
      <CardCapa
        titulo={resumo.nome}
        subtitulo={resumo.foco}
        detalhe={detalheDoTreino(treinoId)}
        foto={capaDoTreino(treinoId)}
        raios={mostrarRaios ? raios : null}
        etiqueta="hoje"
      >
        <BotaoLargo asChild>
          <Link href="/treinar">Começar treino</Link>
        </BotaoLargo>
      </CardCapa>
    );
  }

  const lista = desafios({
    fase: perfil.fase_atual,
    semanaDaFase: semanaDaFase(hoje, perfil.fase_desde),
    semanaFixa: perfil.semana_fixa,
    semanaCorrida: perfil.semana_corrida,
    proximoTreino: proximoTreinoDaFase(perfil.fase_atual, perfil.ultimo_treino),
  });
  const plano = lista[dia?.tipo === "cardio" ? 1 : 0];
  if (!plano) return null;

  return (
    <CardCapa
      titulo={plano.titulo}
      subtitulo={plano.subtitulo}
      detalhe={`semana ${plano.semanaAtual} de ${plano.semanas}`}
      foto={plano.capa}
      etiqueta="hoje"
    >
      <BotaoLargo asChild>
        <Link href={plano.href}>{plano.acao}</Link>
      </BotaoLargo>
    </CardCapa>
  );
}

/* ------------------------------------------------------------ seção */

function Secao({
  titulo,
  itens,
  mostrarRaios,
}: {
  titulo: string;
  itens: Colecao[];
  mostrarRaios: boolean;
}) {
  const [tudo, setTudo] = useState(false);
  if (itens.length === 0) return null;
  const mostradas = tudo ? itens : itens.slice(0, PREVIA);

  return (
    <section aria-label={titulo} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {itens.length > PREVIA ? (
          <Button
            variant="ghost"
            className="alvo text-primary -mr-2 h-11 text-xs"
            aria-expanded={tudo}
            onClick={() => setTudo((v) => !v)}
          >
            {tudo ? "Ver menos" : `Ver todos (${itens.length})`}
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y">
        {mostradas.map((c) => (
          <li key={c.id}>
            <LinhaColecao colecao={c} mostrarRaios={mostrarRaios} />
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { ArrowRight, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LinhaColecao } from "@/components/colecoes/linha-colecao";
import { Skeleton } from "@/components/ui/skeleton";
import { ListaExercicios } from "@/components/exercicios/lista-exercicios";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Button } from "@/components/ui/button";
import { Vazio } from "@/components/ui/vazio";
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
  metaDoPlano,
  semCapasRepetidas,
  todasAsColecoes,
  type Colecao,
} from "@/lib/colecoes";
import {
  FILTROS_VAZIOS,
  filtrarExercicios,
  idsDoPrograma,
  temFiltro,
  type FiltrosCatalogo,
} from "@/lib/catalogo";
import { proximoTreinoDaFase, semanaDaFase } from "@/lib/calendario";
import { detalheDoTreino, resumoDoTreino } from "@/lib/hoje";
import { capaDoTreino } from "@/lib/capas";
import { dificuldadeDaColecao } from "@/lib/dificuldade";
import { exercicios, exerciciosDoTreino } from "@/lib/dados";
import { ligado } from "@/lib/preferencias";
import { useOverrides, usePerfil } from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";
import { cn } from "@/lib/utils";

/** Quantas linhas uma seção mostra antes do "Ver todos". */
const PREVIA = 3;

/**
 * Quantos exercícios a vitrine mostra de prévia (SPEC §22.9 item 1). O
 * catálogo inteiro aqui dentro fazia `/explorar` medir 8.922 px — doze telas,
 * 78% delas de catálogo. O catálogo tem tela própria: `/exercicios`.
 */
const PREVIA_DO_CATALOGO = 12;

/**
 * `/explorar` (SPEC §13.4 e §14.4): busca sempre visível, um destaque, as
 * coleções derivadas dos JSON em "Escolhas para você" e o catálogo dos 81
 * embaixo. Nenhum texto de marketing: título, subtítulo e detalhe saem dos
 * próprios JSON.
 */
export function TelaExplorar() {
  const hoje = useHoje();
  const [busca, setBusca] = useState("");
  /*
   * SPEC §22.9 item 10: os filtros do catálogo moram AQUI, e não dentro da
   * <ListaExercicios>. A contagem do título saía de uma conta feita só com o
   * termo enquanto a lista já tinha aplicado o filtro recolhido atrás do botão
   * "Filtros": buscar "supino" e escolher Grupo = Costas deixava «Exercícios
   * (6)» em cima e "Nenhum exercício com esses filtros" embaixo. Com o estado
   * aqui, o número e a lista saem do MESMO filtro.
   */
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_VAZIOS);
  /** Trocar o termo mantém os filtros; apagar a busca inteira os solta. */
  const trocarBusca = (valor: string) => {
    setBusca(valor);
    if (valor.trim() === "") setFiltros(FILTROS_VAZIOS);
  };

  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;
  const intervalo = hoje ? intervaloDaSemana(hoje) : null;
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);

  const dia = useMemo(() => {
    if (!hoje || !perfil) return null;
    return treinoDeHoje(hoje, perfil, overridesQ.data ?? []);
  }, [hoje, perfil, overridesQ.data]);

  const mostrarRaios = ligado(perfil?.prefs, "mostrar_raios");

  /*
   * SPEC §22.9 item 7: `semCapasRepetidas` é aplicado POR SEÇÃO — é dentro de
   * uma seção que quatro linhas seguidas apareciam com a mesma foto.
   */
  /*
   * SPEC §22.12 item 4: com o perfil, os planos de barra fixa e corrida dizem
   * a posição ("semana 3 de 12"); sem ele, a duração.
   */
  const semanaFixa = perfil?.semana_fixa;
  const semanaCorrida = perfil?.semana_corrida;
  const posicao = useMemo(
    () =>
      semanaFixa === undefined || semanaCorrida === undefined
        ? null
        : { semanaFixa, semanaCorrida },
    [semanaFixa, semanaCorrida],
  );
  const secoes = useMemo(
    () => [
      { titulo: "Treinos do programa", itens: semCapasRepetidas(colecoesDeTreino()) },
      { titulo: "Parte do corpo", itens: semCapasRepetidas(colecoesPorGrupo()) },
      { titulo: "Circuitos", itens: semCapasRepetidas(circuitos()) },
      { titulo: "Por aparelho", itens: semCapasRepetidas(colecoesPorAparelho()) },
      { titulo: "Planos", itens: semCapasRepetidas(colecoesDePlano(posicao)) },
    ],
    [posicao],
  );

  /** O destaque só aparece com perfil e overrides na mão (§22.2 item 2). */
  const pronto = Boolean(hoje && perfil) && !overridesQ.isPending;

  const achadas = useMemo(
    () =>
      busca.trim() === ""
        ? []
        : semCapasRepetidas(buscarColecoes(busca, todasAsColecoes(posicao))),
    [busca, posicao],
  );
  const doPrograma = useMemo(() => idsDoPrograma(), []);
  /* quantos exercícios a mesma busca acha — com os mesmos filtros da lista */
  const quantosExercicios = useMemo(
    () =>
      busca.trim() === ""
        ? 0
        : filtrarExercicios(exercicios, { ...filtros, busca }, doPrograma).length,
    [busca, filtros, doPrograma],
  );
  const buscando = busca.trim() !== "";
  /* `filtros.busca` fica sempre vazio: quem busca é a barra de cima. */
  const comFiltro = temFiltro(filtros);
  /*
   * O bloco dos exercícios fica de pé mesmo com zero achados quando há filtro:
   * é ele que carrega o botão "Filtros" e o "Limpar filtros". Sem ele, quem
   * filtrou até o vazio ficaria sem como desfazer.
   */
  const blocoExercicios = buscando && (quantosExercicios > 0 || comFiltro);
  const blocoColecoes = achadas.length > 0;
  const nada = buscando && !blocoExercicios && !blocoColecoes;

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
            onChange={(e) => trocarBusca(e.target.value)}
            placeholder="Buscar exercício ou coleção"
            aria-label="Buscar exercício ou coleção"
            className="alvo h-12 pl-9 text-base"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => trocarBusca("")}
              aria-label="Limpar a busca"
              className="alvo text-muted-foreground absolute top-1/2 right-0 flex -translate-y-1/2 items-center justify-center"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      {/*
        SPEC §22.9 itens 3 e 4: o resultado começa pelos EXERCÍCIOS — com
        "supino" eles caíam em y=860, atrás de nove linhas de coleção, fora da
        primeira tela. Sem nenhum resultado, UM vazio só, citando o termo.
      */}
      {nada ? (
        <Vazio
          icone={SearchX}
          titulo={`Nada para «${busca.trim()}»`}
          frase="Tente uma palavra mais curta, ou o nome do aparelho."
          acao={{ rotulo: "Limpar busca", aoTocar: () => trocarBusca("") }}
        />
      ) : buscando ? (
        <>
          {/*
            SPEC §22.9 item 10: o seletor só existe quando há DOIS blocos entre
            os quais escolher. Desenhar sempre os dois âncoras deixava, numa
            busca como "tatame" (0 exercícios, 2 coleções), um «Exercícios (0)»
            focável de 80×44 px apontando para um id fora do documento — tocar
            nele não fazia nada. Com um bloco só não há para onde pular.
          */}
          {blocoExercicios && blocoColecoes ? (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <a href="#achados-exercicios" className="alvo foco flex items-center rounded-md">
                Exercícios ({quantosExercicios})
              </a>
              <span aria-hidden="true">·</span>
              <a href="#achados-colecoes" className="alvo foco flex items-center rounded-md">
                Coleções ({achadas.length})
              </a>
            </p>
          ) : null}

          {blocoExercicios ? (
            <section
              id="achados-exercicios"
              aria-label="Exercícios encontrados"
              className="flex scroll-mt-4 flex-col gap-1"
            >
              {/*
                `aria-live` porque este título é o único contador da seção:
                mexer num filtro muda o número sem mexer no foco.
              */}
              <h2 className="text-base font-semibold" aria-live="polite">
                Exercícios ({quantosExercicios})
              </h2>
              <ListaExercicios
                busca={busca}
                filtros={filtros}
                aoMudarFiltros={setFiltros}
              />
            </section>
          ) : null}

          {blocoColecoes ? (
            <section
              id="achados-colecoes"
              aria-label="Coleções encontradas"
              className="flex scroll-mt-4 flex-col gap-1"
            >
              <h2 className="text-base font-semibold">
                Coleções ({achadas.length})
              </h2>
              <ul className="flex flex-col divide-y">
                {achadas.map((c) => (
                  <li key={c.id}>
                    <LinhaColecao colecao={c} mostrarRaios={mostrarRaios} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
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
          {/*
            SPEC §22.9 item 8: o rótulo não agrupava nada e competia com os
            títulos de seção. Agora é overline de 11 px, e o degrau para o
            título de 16 px com régua acima é visível de longe.
          */}
          <h2 className="text-muted-foreground text-rotulo tracking-wide uppercase">
            Escolhas para você
          </h2>
          {secoes.map((s, i) => (
            <Secao
              key={s.titulo}
              titulo={s.titulo}
              itens={s.itens}
              mostrarRaios={mostrarRaios}
              regua={i > 0}
            />
          ))}

          {/*
            SPEC §22.9 item 1: prévia do catálogo, não o catálogo. Os 81
            exercícios têm tela própria.
          */}
          {/*
            SPEC §22.12 item 5: "Exercícios" é irmão de "Escolhas para você"
            (h2), e os cinco títulos do grupo de escolhas ficam h3.
          */}
          <section aria-label="Catálogo" className="flex flex-col gap-2 border-t pt-3">
            <h2 className="text-base font-semibold">Exercícios</h2>
            <ListaExercicios limite={PREVIA_DO_CATALOGO} />
            <BotaoLargo asChild variant="outline">
              <Link href="/exercicios">
                Ver os {exercicios.length} exercícios
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </BotaoLargo>
          </section>
        </>
      )}
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
  if (!plano || plano.id === "fase") return null;
  /* SPEC §22.12 item 4: a meta sai da mesma função da vitrine, não da tela */
  const meta = metaDoPlano(
    { id: plano.id, semanas: plano.semanas, subtitulo: plano.subtitulo },
    { semanaFixa: perfil.semana_fixa, semanaCorrida: perfil.semana_corrida },
  );

  return (
    <CardCapa
      titulo={plano.titulo}
      subtitulo={plano.subtitulo}
      detalhe={meta}
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
  regua = false,
}: {
  titulo: string;
  itens: Colecao[];
  mostrarRaios: boolean;
  /** A régua que separa uma seção da anterior (SPEC §22.9 item 8). */
  regua?: boolean;
}) {
  const [tudo, setTudo] = useState(false);
  if (itens.length === 0) return null;
  const mostradas = tudo ? itens : itens.slice(0, PREVIA);

  return (
    <section
      aria-label={titulo}
      className={cn("flex flex-col gap-1", regua && "border-t pt-3")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{titulo}</h3>
        {itens.length > PREVIA ? (
          <Button
            variant="ghost"
            className="alvo text-primary -mr-2 text-xs"
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

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Erro } from "@/components/carregando";
import { useOverrides } from "@/lib/queries/dados";
import { useEventosTodos } from "@/lib/queries/progresso";
import { editarNotaNoHistorico } from "@/lib/queries/historico-da-sessao";
import { NotaDoTreino } from "@/components/treinar/nota-do-treino";
import { ChevronRight, Flame, History, Pause, Repeat2 } from "lucide-react";
import Link from "next/link";
import { addDays } from "date-fns";
import { useId, useMemo, useState } from "react";
import { DetalheDasSeries } from "@/components/relatorio/detalhe-das-series";
import { useRepetirTreinoLivre } from "@/components/relatorio/usar-repeticao";
import { Button } from "@/components/ui/button";
import { FaixaSemana } from "@/components/ui/faixa-semana";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Vazio } from "@/components/ui/vazio";
import { formatarData, formatarDataCompleta, formatarIntervaloDaSemana } from "@/lib/formato";
import { iso, inicioDaSemana, paraData } from "@/lib/calendario";
import { registros, textoDoMotorDaSessao } from "@/lib/relatorio";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import { retomadaDasPrefs } from "@/lib/retomada";
import type { CardioBruto, SerieBruta, SessaoBruta, SoltaBruta } from "@/lib/progresso";
import { GLIFO_DA_MARCA, NOME_DA_MARCA, ORDEM_DA_LEGENDA, faixaDaSemana, montarGrade } from "@/lib/semana";
import type { LinhaPerfil, LinhaExcecaoAgenda } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Quantos registros a lista mostra antes do "Ver mais". */
const PAGINA = 12;

/**
 * Histórico (SPEC §13.5): a faixa da semana navegável e "Todos os registros" —
 * sessões de força com treino, duração, séries e ↑/=/↓; cardio com tipo,
 * semana e duração; e as repetições soltas do dia.
 */
export function Historico({
  hoje,
  perfil,
  overrides,
  inicioDaAgenda,
  sessoes,
  cardios,
  series,
  seriesDisponiveis,
  seriesConfirmadasEm,
  atividadesCompletas,
  online,
  soltas,
}: {
  hoje: string;
  perfil: LinhaPerfil;
  overrides: LinhaExcecaoAgenda[] | undefined;
  inicioDaAgenda: string | null;
  sessoes: SessaoBruta[];
  cardios: CardioBruto[];
  series: SerieBruta[];
  seriesDisponiveis: boolean;
  seriesConfirmadasEm?: number;
  atividadesCompletas: boolean;
  online: boolean;
  soltas: SoltaBruta[];
}) {
  /** Quantas semanas atrás da de hoje a faixa está (0 = esta semana). */
  const cliente = useQueryClient();
  const [atras, setAtras] = useState(0);
  const [tudo, setTudo] = useState(false);
  /* quantas páginas de 12 já foram abertas; volta a 1 ao trocar de recorte */
  const [paginas, setPaginas] = useState(1);
  const { repetir, repetindoId, erro } = useRepetirTreinoLivre(perfil, hoje);

  const inicio = useMemo(
    () => iso(addDays(inicioDaSemana(paraData(hoje)), -7 * atras)),
    [hoje, atras],
  );
  const fim = useMemo(() => iso(addDays(paraData(inicio), 6)), [inicio]);

  const anteriores = inicioDaAgenda !== null && inicio < inicioDaAgenda;
  const semanaQ = useOverrides(anteriores ? inicio : null, anteriores ? fim : null, perfil.user_id);
  const overridesDaFaixa = anteriores ? semanaQ.data : overrides;
  const eventosQ = useEventosTodos(perfil.user_id);

  const dias = useMemo(
    () =>
      faixaDaSemana(
        montarGrade({
          data: inicio,
          perfil,
          overrides: overridesDaFaixa,
          sessoes,
          cardios: cardios.map((c, i) => ({
            id: `c${i}`,
            data: c.data,
            tipo: c.tipo,
            concluida: c.concluida,
          })),
          hoje,
        }),
      ),
    [inicio, perfil, overridesDaFaixa, sessoes, cardios, hoje],
  );

  /* SPEC §18.5: a pausa decidida, que mora nas prefs do perfil */
  const retomada = useMemo(() => retomadaDasPrefs(perfil.prefs), [perfil.prefs]);

  const lista = useMemo(
    () => registros({
      sessoes, cardios, series, seriesDisponiveis, soltas, eventos: eventosQ.data, retomada,
      de: tudo ? null : inicio, ate: tudo ? null : fim,
    }),
    [sessoes, cardios, series, seriesDisponiveis, soltas, eventosQ.data, retomada, tudo, inicio, fim],
  );
  const mostrados = lista.slice(0, PAGINA * paginas);
  const consultas = [semanaQ, eventosQ];
  const falha = consultas.find(q => q.error);

  return (
    <section aria-label="Histórico" className="flex flex-col gap-3">
      {online && falha?.error && <Erro mensagem={falha.error.message} aoTentarDeNovo={() => {
        for (const consulta of consultas) if (consulta.isError) void consulta.refetch();
      }} />}
      <FaixaSemana
        dias={dias}
        rotulo={formatarIntervaloDaSemana(inicio, fim)}
        aoVoltar={() => {
          setAtras((n) => n + 1);
          setPaginas(1);
        }}
        aoAvancar={
          atras > 0
            ? () => {
                setAtras((n) => Math.max(0, n - 1));
                setPaginas(1);
              }
            : undefined
        }
      />

      {/*
        SPEC §22.6 item 9: as marcas da faixa não se explicavam sozinhas — um
        ✓, um anel vazio e um traço cinza, sem uma palavra em volta. O texto
        vem de `LEGENDA_DA_FAIXA`, montado a partir de `MarcaDoDia`: escrito à
        mão ele explicava quatro glifos para as cinco marcas que a faixa
        desenha, e "parcial" ficava de fora.
      */}
      <ul aria-label="Legenda da semana" className="text-muted-foreground text-rotulo -mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {ORDEM_DA_LEGENDA.map((marca) => (
          <li key={marca} className="whitespace-nowrap">
            <span aria-hidden>{GLIFO_DA_MARCA[marca]} </span>{NOME_DA_MARCA[marca]}
          </li>
        ))}
        <li className="whitespace-nowrap">hoje em destaque</li>
      </ul>

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {tudo ? "Todos os registros" : "Registros da semana"}
        </h3>
        <button
          type="button"
          onClick={() => {
            setTudo((v) => !v);
            setPaginas(1);
          }}
          aria-pressed={tudo}
          className="alvo text-primary flex items-center text-xs underline underline-offset-4"
        >
          {tudo ? "Só esta semana" : "Todos os registros"}
        </button>
      </div>

      <span role="status" className="sr-only">{repetindoId ? "Abrindo treino…" : ""}</span>
      {mostrados.length === 0 && !atividadesCompletas ? (
        <p className="text-muted-foreground text-sm" role="status">Os registros desta lista ainda estão incompletos neste aparelho.</p>
      ) : mostrados.length === 0 ? (
        <Vazio
          icone={History}
          titulo={tudo ? "Nenhum registro ainda" : "Nada registrado nesta semana"}
          frase={
            tudo
              ? "O primeiro treino concluído aparece aqui, com séries, carga e tempo."
              : "Esta semana está vazia; os registros antigos continuam guardados."
          }
          acao={
            tudo
              ? { rotulo: "Ver o treino de hoje", href: "/" }
              : {
                  /* Rótulo próprio, sem repetir nem CONTER o do botão de
                     cima ("Todos os registros"): dois controles com nomes que
                     se sobrepõem na mesma região confundem leitor de tela — e
                     o locator por nome acessível casa com os dois. */
                  rotulo: "Ver o histórico completo",
                  aoTocar: () => {
                    setTudo(true);
                    setPaginas(1);
                  },
                }
          }
        />
      ) : (
        <ul aria-label="Registros" className="flex flex-col divide-y">
          {mostrados.map((r) => {
            const sessao = r.sessaoDeForca;
            return (
              <li key={`${perfil.user_id}:${r.chave}`}>
                <LinhaDoRegistro registro={r} conta={perfil.user_id}
                  series={series} seriesDisponiveis={seriesDisponiveis} confirmadasEm={seriesConfirmadasEm} />
                {sessao && sessao.user_id === perfil.user_id && montarRepeticaoDoTreinoLivre(sessao) && (
                  <div className="flex flex-col items-start gap-1 pb-2 pl-12">
                    <Button type="button" variant="outline" size="sm"
                      className="alvo h-auto max-w-full scroll-mb-24 whitespace-normal"
                      aria-label={`Repetir treino: ${r.titulo} de ${formatarDataCompleta(r.data)}`}
                      aria-busy={repetindoId === sessao.id}
                      disabled={repetindoId !== null}
                      onClick={() => void repetir(sessao)}>
                      <Repeat2 aria-hidden="true" className="size-4" />
                      {repetindoId === sessao.id ? "Abrindo treino…" : "Repetir treino"}
                    </Button>
                    {erro?.id === sessao.id && (
                      <p role="alert" className="text-destructive text-sm">{erro.mensagem}</p>
                    )}
                  </div>
                )}
                {sessao && sessao.user_id === perfil.user_id && (
                  <div className="pb-2 pl-12">
                    <NotaDoTreino key={`${perfil.user_id}:${sessao.id}`} valor={sessao.nota_geral}
                      aoGuardar={(texto, anterior) => editarNotaNoHistorico(cliente, perfil.user_id, sessao, texto, anterior)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lista.length > mostrados.length ? (
        <button
          type="button"
          onClick={() => setPaginas((n) => n + 1)}
          className="alvo border-border hover:bg-accent text-muted-foreground w-full rounded-xl border text-sm"
        >
          Ver mais {Math.min(PAGINA, lista.length - mostrados.length)} de{" "}
          {lista.length}
        </button>
      ) : null}
    </section>
  );
}

function LinhaDoRegistro({
  registro: r, conta, series, seriesDisponiveis, confirmadasEm,
}: {
  registro: ReturnType<typeof registros>[number];
  conta: string;
  series: readonly SerieBruta[];
  seriesDisponiveis: boolean;
  confirmadasEm?: number;
}) {
  const descricaoId = useId();
  const motor = textoDoMotorDaSessao(r.motor);
  const miolo = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          r.tipo === "forca"
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {r.tipo === "soltas" ? <Flame className="size-4" /> : null}
        {r.tipo === "pausa" ? <Pause className="size-4" /> : null}
        {r.tipo === "soltas" || r.tipo === "pausa" ? null : r.titulo.slice(0, 1)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-balance wrap-anywhere">{r.titulo}</span>
        <span id={descricaoId} className="numero text-muted-foreground text-xs">
          {r.detalhe}
          {motor ? ` · ${motor}` : ""}
        </span>
      </span>
      <span className="numero text-muted-foreground shrink-0 text-xs">
        {formatarData(r.data)}
      </span>
    </>
  );

  const sessao = r.sessaoDeForca;
  if (sessao?.status === "concluida" && sessao.user_id === conta) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <button type="button" data-registro={r.tipo}
            aria-label={`Ver séries de ${r.titulo} de ${formatarDataCompleta(r.data)}`}
            aria-describedby={descricaoId}
            className="alvo foco hover:bg-muted/40 flex w-full items-center gap-3 rounded-xl py-2 text-left">
            {miolo}
            <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-3 overflow-hidden">
          <SheetHeader className="shrink-0 gap-1 pr-16 pb-0">
            <SheetTitle>Séries do treino</SheetTitle>
            <SheetDescription className="wrap-anywhere">
              {r.titulo} · {formatarDataCompleta(r.data)}
            </SheetDescription>
          </SheetHeader>
          <DetalheDasSeries sessao={sessao} conta={conta} series={series}
            fonteCompleta={seriesDisponiveis} confirmadasEm={confirmadasEm} />
        </SheetContent>
      </Sheet>
    );
  }
  if (!r.href) {
    return (
      <span data-registro={r.tipo} className="flex items-center gap-3 py-2">
        {miolo}
      </span>
    );
  }
  return (
    <Link
      href={r.href}
      data-registro={r.tipo}
      className="hover:bg-muted/40 alvo flex items-center gap-3 rounded-xl py-2"
    >
      {miolo}
    </Link>
  );
}

"use client";

import { ArrowLeft, Check, CircleDot, Circle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ICONE_DO_TIPO } from "@/components/colecoes/linha-colecao";
import { useSessaoLivre } from "@/components/colecoes/usar-sessao-livre";
import { ListaDaColecao } from "@/components/colecoes/lista-da-colecao";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { CardCapa } from "@/components/ui/card-capa";
import {
  ctaDoPlano,
  exerciciosParaSessao,
  metaDoPlano,
  planos,
  semanaDoPerfilNoPlano,
  semanaPresa,
  semanasConcluidasDoDesafio,
  semanasDoPlano,
  type Colecao,
  type CtaDoPlano,
  type DadosDoPlano,
  type EstadoDaSemana,
} from "@/lib/colecoes";
import { evitadosPorUltimo, ligado } from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";
import { cn } from "@/lib/utils";

/**
 * A tela de uma coleção (SPEC §14.4): capa, lista e "Começar", que abre uma
 * sessão livre com os primeiros exercícios da coleção (§14.3).
 *
 * Coleção de plano não abre sessão livre: ela leva para a tela do plano, onde
 * a sessão da semana já existe com a prescrição certa (§3.4 e §3.3).
 */
export function TelaColecao({ colecao }: { colecao: Colecao }) {
  const perfilQ = usePerfil();
  const prefs = perfilQ.data?.prefs;
  const mostrarRaios = ligado(prefs, "mostrar_raios");

  const ids = useMemo(
    () => evitadosPorUltimo(colecao.exercicios, (id) => id, prefs),
    [colecao.exercicios, prefs],
  );
  const escolhidos = useMemo(
    () => exerciciosParaSessao(colecao.exercicios, { prefs }),
    [colecao.exercicios, prefs],
  );

  const { comecar, ocupado, pronto } = useSessaoLivre(colecao.exercicios);

  /* Plano não abre sessão livre: leva para a tela do plano (§3.3 e §3.4). */
  const dadosDoPlano = planos().find((p) => p.id === colecao.plano) ?? null;
  /*
   * SPEC §22.12 item 4: com o perfil na mão, o plano diz onde o usuário está
   * ("semana 3 de 12"), como na vitrine; sem perfil, a da vitrine: a duração,
   * ou nada quando o objetivo já diz o prazo.
   */
  const perfil = perfilQ.data ?? null;
  const posicao = perfil
    ? { semanaFixa: perfil.semana_fixa, semanaCorrida: perfil.semana_corrida }
    : null;
  const detalhe =
    dadosDoPlano && posicao ? metaDoPlano(dadosDoPlano, posicao) : colecao.detalhe;
  /*
   * SPEC §22.12 item 7: o botão do plano é o MESMO do desafio (rótulo e
   * destino), vindo de `ctaDoPlano()` — esta tela não escreve o rótulo.
   */
  const cta = dadosDoPlano ? ctaDoPlano(dadosDoPlano.id, posicao) : null;
  /* SPEC §22.13 item 8: sem foto, a capa grande leva o ícone do tipo */
  const Icone = ICONE_DO_TIPO[colecao.tipo];

  return (
    <section aria-label={colecao.titulo} className="flex flex-col gap-4">
      <Link
        href="/explorar"
        className="alvo text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Explorar
      </Link>

      {/*
        SPEC §22.12 item 6: a capa é o título da página — o único h1 do main,
        também quando se chega por uma URL antiga com acento ou maiúscula.
      */}
      <CardCapa
        nivelTitulo="h1"
        titulo={colecao.titulo}
        subtitulo={colecao.subtitulo}
        detalhe={detalhe}
        foto={colecao.capa}
        icone={<Icone aria-hidden="true" className="size-12" />}
        raios={mostrarRaios ? colecao.raios : null}
      >
        {cta ? (
          <BotaoLargo asChild>
            <Link href={cta.href}>{cta.acao}</Link>
          </BotaoLargo>
        ) : (
          <>
            <BotaoLargo
              disabled={!pronto || ocupado || escolhidos.length === 0}
              onClick={() =>
                void comecar(escolhidos, { titulo: colecao.titulo, colecao: colecao.id })
              }
            >
              {ocupado ? "Começando…" : "Começar"}
            </BotaoLargo>
            <p className="text-muted-foreground text-xs text-balance">
              {escolhidos.length < colecao.exercicios.length
                ? `Sessão livre com ${escolhidos.length} dos ${colecao.exercicios.length}: compostos antes de isolamento, só o que dá para fazer aqui.`
                : "Sessão livre com os exercícios abaixo, compostos antes de isolamento."}
            </p>
          </>
        )}
      </CardCapa>

      {dadosDoPlano ? (
        <SemanasDoPlano
          plano={dadosDoPlano}
          semanaAtual={semanaDoPerfilNoPlano(dadosDoPlano.id, perfil)}
          cta={cta}
        />
      ) : null}

      {dadosDoPlano === null && ids.length > 0 ? (
        <ListaDaColecao
          ids={ids}
          titulo={`Exercícios de ${colecao.titulo}`}
          mostrarRaios={mostrarRaios}
          prefs={prefs}
        />
      ) : null}
    </section>
  );
}

const ROTULO_DO_ESTADO: Readonly<Record<EstadoDaSemana, string>> = {
  feita: "feita",
  atual: "agora",
  "a-fazer": "a fazer",
};

const ICONE_DO_ESTADO = { feita: Check, atual: CircleDot, "a-fazer": Circle } as const;

/**
 * As semanas do plano (SPEC §22.13 item 9): "Semana X de N" com a barra das
 * semanas **concluídas** — a mesma leitura do card de desafio (§22.2 item 8)
 * — e a lista das semanas ou estágios de `data/cardio.json`, cada uma com o
 * estado em texto. A atual tem `aria-current="step"` e o link da sessão da
 * semana (o mesmo destino de `ctaDoPlano()`). Sem perfil, só a lista.
 */
function SemanasDoPlano({
  plano,
  semanaAtual,
  cta,
}: {
  plano: DadosDoPlano;
  semanaAtual: number | null;
  cta: CtaDoPlano | null;
}) {
  const linhas = semanasDoPlano(plano.id, semanaAtual);
  const total = plano.semanas;
  const atual =
    semanaAtual === null || !Number.isFinite(semanaAtual)
      ? null
      : semanaPresa(semanaAtual, total);
  const concluidas =
    atual === null ? 0 : semanasConcluidasDoDesafio({ semanaAtual: atual, semanas: total });
  const porcento = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return (
    <section aria-labelledby="semanas-do-plano" className="flex flex-col gap-3">
      <h2 id="semanas-do-plano" className="text-base font-semibold">
        Semanas do plano
      </h2>

      {atual !== null ? (
        <div className="flex flex-col gap-1">
          <p className="numero text-muted-foreground flex items-baseline justify-between text-xs">
            <span>
              Semana {atual} de {total} · {concluidas}{" "}
              {concluidas === 1 ? "concluída" : "concluídas"}
            </span>
            <span>{porcento}%</span>
          </p>
          <div
            role="progressbar"
            aria-valuenow={concluidas}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`Progresso: ${concluidas} de ${total} semanas concluídas`}
            className="bg-muted h-2 w-full overflow-hidden rounded-full"
          >
            <div className="bg-primary h-full" style={{ width: `${porcento}%` }} />
          </div>
        </div>
      ) : null}

      <ol className="border-border divide-border flex flex-col divide-y rounded-xl border">
        {linhas.map((l) => {
          const IconeDoEstado = l.estado ? ICONE_DO_ESTADO[l.estado] : null;
          return (
            <li
              key={l.rotulo}
              data-semana-do-plano={l.estado ?? "sem-perfil"}
              aria-current={l.estado === "atual" ? "step" : undefined}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5",
                l.estado === "atual" && "bg-muted",
              )}
            >
              {IconeDoEstado ? (
                <IconeDoEstado
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    l.estado === "a-fazer" ? "text-muted-foreground" : "text-primary",
                  )}
                />
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{l.rotulo}</span>
                  {l.estado ? (
                    <span className="text-muted-foreground text-xs">
                      {ROTULO_DO_ESTADO[l.estado]}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs text-balance">{l.descricao}</span>
                {l.estado === "atual" && cta ? (
                  <Link
                    href={cta.href}
                    className="alvo text-foreground flex w-fit items-center text-sm font-medium underline underline-offset-4"
                  >
                    Abrir a sessão desta semana
                  </Link>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

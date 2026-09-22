"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useSessaoLivre } from "@/components/colecoes/usar-sessao-livre";
import { ListaDaColecao } from "@/components/colecoes/lista-da-colecao";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { CardCapa } from "@/components/ui/card-capa";
import { exerciciosParaSessao, metaDoPlano, planos, type Colecao } from "@/lib/colecoes";
import { evitadosPorUltimo, ligado } from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";

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
   * ("semana 3 de 12"), como na vitrine; sem perfil, a duração do build.
   */
  const perfil = perfilQ.data ?? null;
  const detalhe =
    dadosDoPlano && perfil
      ? metaDoPlano(dadosDoPlano, {
          semanaFixa: perfil.semana_fixa,
          semanaCorrida: perfil.semana_corrida,
        })
      : colecao.detalhe;

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
        raios={mostrarRaios ? colecao.raios : null}
      >
        {dadosDoPlano ? (
          <BotaoLargo asChild>
            <Link href={dadosDoPlano.href}>Fazer a sessão da semana</Link>
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

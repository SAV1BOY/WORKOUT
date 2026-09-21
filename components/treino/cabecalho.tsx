"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FaixaSemana } from "@/components/ui/faixa-semana";
import { formatarData, formatarKg } from "@/lib/formato";
import type { StatusDoPeso } from "@/lib/hoje";
import type { ProgressoDaMeta } from "@/lib/metas";
import type { DiaDaFaixa } from "@/lib/semana";
import { cn } from "@/lib/utils";

/**
 * O cabeçalho da aba Treino (SPEC §13.3): a saudação com o dia, a sequência de
 * semanas com a meta cumprida, a faixa da semana e a meta semanal. A fase e o
 * peso (§3.1) continuam logo abaixo, em duas caixas.
 */
export function CabecalhoDoTreino({
  saudacao,
  sequenciaDeSemanas,
  dias,
  meta,
  fase,
  semanaDaFase,
  peso,
  acoes,
}: {
  /** "Terça, 15/09" */
  saudacao: string;
  sequenciaDeSemanas: number;
  dias: DiaDaFaixa[];
  meta: ProgressoDaMeta;
  fase: string;
  semanaDaFase: number;
  peso: StatusDoPeso;
  /**
   * SPEC §22.7 item 1: o "Ajustar" mora aqui, ao lado da data — era um FAB
   * fixo que cobria 81 % do "Substituir" do 3º exercício da lista.
   */
  acoes?: ReactNode;
}) {
  const largura = Math.min(
    100,
    Math.round((meta.feitos / Math.max(meta.meta, 1)) * 100),
  );

  return (
    <section aria-label="Situação" className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {saudacao}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {sequenciaDeSemanas > 0 ? (
            <span
              className="border-primary/40 bg-primary/10 text-primary flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
              aria-label={`Sequência: ${sequenciaDeSemanas} ${
                sequenciaDeSemanas === 1 ? "semana" : "semanas"
              } com a meta cumprida`}
            >
              <Flame aria-hidden="true" className="size-4" />
              <span className="numero">{sequenciaDeSemanas}</span>
              {sequenciaDeSemanas === 1 ? "semana" : "semanas"}
            </span>
          ) : null}
          {acoes}
        </div>
      </header>

      <FaixaSemana dias={dias} href="/calendario" />

      <div className="cartao border-border bg-card flex flex-col gap-1.5 border px-3 py-2.5">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">Meta semanal</span>
          <span className="numero text-lg">{meta.texto}</span>
        </p>
        <span
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={meta.meta}
          aria-valuenow={meta.feitos}
          aria-label="Meta semanal"
          className="bg-muted block h-2 w-full overflow-hidden rounded-full"
        >
          <span
            aria-hidden="true"
            className="bg-primary block h-full rounded-full transition-[width]"
            style={{ width: `${largura}%` }}
          />
        </span>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-2">
        <Caixa rotulo="Fase" valor={fase} legenda={`semana ${semanaDaFase}`} />
        <Caixa
          rotulo="Peso"
          valor={peso.peso !== null ? formatarKg(peso.peso) : "—"}
          legenda={
            peso.dias === null
              ? null
              : peso.dias === 0
                ? "hoje"
                : `há ${peso.dias} ${peso.dias === 1 ? "dia" : "dias"}`
          }
        />
      </div>

      {peso.pedirPesagem ? (
        <div className="border-border flex items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2">
          <p className="text-muted-foreground text-xs">
            {peso.data === null
              ? "Ainda não tem peso registrado."
              : `Último peso em ${formatarData(peso.data)}. Pese-se em jejum, 1× por semana.`}
          </p>
          <Button asChild variant="outline" className="alvo shrink-0 px-3">
            <Link href="/corpo">Pesar</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Um ladrilho do par "Fase | Peso" (SPEC §22.7 item 4). Os dois têm a mesma
 * gramática — rótulo, valor, legenda —, cada parte numa linha de altura fixa e
 * tudo ancorado ao topo: assim os valores caem na mesma linha de base e as
 * duas caixas têm a mesma altura mesmo quando uma delas não tem legenda.
 */
function Caixa({
  rotulo,
  valor,
  legenda,
}: {
  rotulo: string;
  valor: string;
  legenda?: string | null;
}) {
  return (
    <div
      data-ladrilho={rotulo}
      className="cartao border-border bg-card flex flex-col items-start justify-start border px-3 py-2"
    >
      <span className="text-muted-foreground text-rotulo flex h-4 items-center tracking-wide uppercase">
        {rotulo}
      </span>
      <span className="numero flex h-6 items-center text-base text-nowrap">
        {valor}
      </span>
      <span className="text-muted-foreground flex h-4 items-center text-xs">
        {legenda ?? ""}
      </span>
    </div>
  );
}

/**
 * A faixa fixa do dia (SPEC §22.7 item 2): quando o card do treino de hoje sai
 * da tela — a aba tem 2.555 px —, o mesmo caminho volta como uma faixa fina no
 * alto, com o nome do treino, o progresso e um toque para continuar.
 *
 * A faixa INTEIRA é o controle, como a barra do tocador de um app de música:
 * ela é um cartão opaco por cima da lista, então cada pixel dela tem de fazer
 * a coisa que ela anuncia. A tentativa anterior — `pointer-events-none` no
 * cartão, toque só no "Continuar" — devolvia esses pixels à lista de baixo e
 * trocava um defeito por outro pior: tocar em "Treino A · agachamento no
 * centro" abria a ficha de um exercício que nem estava à vista. Agora
 * `document.elementFromPoint` em qualquer ponto do retângulo da faixa cai
 * dentro dela.
 *
 * O contêiner segue com `pointer-events-none` só para não capturar o vazio dos
 * lados no desktop (a faixa tem `max-w-lg`); quem recebe o toque é o `aside`.
 * Nada fica inalcançável por causa dela: a linha que para debaixo da faixa
 * volta com um dedo de rolagem, e para o salto por âncora e o foco pelo
 * teclado a folga vem do `scroll-padding-top` do documento (globals.css).
 */
export function FaixaFixaDoDia({
  titulo,
  detalhe,
  rotulo,
  href,
  aoTocar,
}: {
  /** "Treino B" */
  titulo: string;
  /** "0/17 séries" ou "6 exercícios · 44 min" */
  detalhe: string | null;
  /** "Continuar" | "Começar" */
  rotulo: string;
  /** Quando existe, a ação é um link (o Next continua dando prefetch). */
  href?: string;
  aoTocar?: () => void;
}) {
  /* "Continuar — Treino A, 0/17 séries": o verbo primeiro, como o leitor de
     tela anuncia o controle que a barra inteira virou. */
  const nomeAcessivel = `${rotulo} — ${titulo}${detalhe ? `, ${detalhe}` : ""}`;

  const classeDaBarra =
    "group alvo flex w-full items-center gap-2 px-4 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset";

  const conteudo = (
    <>
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold">{titulo}</span>
        {detalhe ? (
          <span className="text-muted-foreground numero">{` · ${detalhe}`}</span>
        ) : null}
      </span>
      {/* só a aparência do botão: quem responde ao toque é a barra toda */}
      <span
        aria-hidden="true"
        className={cn(
          buttonVariants(),
          "pointer-events-none shrink-0 group-hover:bg-primary/80",
        )}
      >
        {rotulo}
      </span>
    </>
  );

  return (
    <div
      data-faixa-do-dia
      className="pt-segura pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
    >
      <aside
        aria-label="Treino de hoje"
        className="border-border bg-card flutuante pointer-events-auto w-full max-w-lg border-b"
      >
        {href ? (
          <Link
            href={href}
            aria-label={nomeAcessivel}
            className={classeDaBarra}
          >
            {conteudo}
          </Link>
        ) : (
          <button
            type="button"
            aria-label={nomeAcessivel}
            onClick={aoTocar}
            className={classeDaBarra}
          >
            {conteudo}
          </button>
        )}
      </aside>
    </div>
  );
}

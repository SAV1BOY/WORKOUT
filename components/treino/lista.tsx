"use client";

import { ChevronRight, Repeat } from "lucide-react";
import { useState } from "react";
import { FichaEmFolha } from "@/components/exercicio/ficha-folha";
import { useTemVideo } from "@/components/videos-do-app";
import { Miniatura } from "@/components/ui/miniatura";
import { Raios } from "@/components/ui/raios";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { acharExercicio } from "@/lib/dados";
import { dificuldadeDe } from "@/lib/dificuldade";
import type { ItemPrevia } from "@/lib/hoje";
import { evitado, evitadosPorUltimo } from "@/lib/preferencias";
import { substitutosPara } from "@/lib/sessao";
import type { Prefs } from "@/lib/types";

/**
 * A lista do treino do dia (SPEC §13.3): miniatura, nome, prescrição, carga de
 * hoje com o rótulo do implemento, a explicação da carga (§6.6), os raios de
 * dificuldade (§13.4), o ⇄ para substituir e o toque que abre a ficha.
 */
export function ListaDoDia({
  itens,
  carregando = false,
  mostrarRaios = true,
  prefs,
  aoSubstituir,
  titulo = "Exercícios de hoje",
}: {
  itens: ItemPrevia[];
  carregando?: boolean;
  mostrarRaios?: boolean;
  /** `profiles.prefs` — o "não gosto" muda a ordem dos substitutos (§14.1.2). */
  prefs?: Prefs;
  /** Quando existe, cada item ganha o ⇄ (a lista da aba Treino). */
  aoSubstituir?: (originalId: string, novoExercicioId: string) => void;
  titulo?: string;
}) {
  const [ficha, setFicha] = useState<string | null>(null);
  // a ficha aberta daqui mostra vídeo igual à do player (SPEC §22.2 item 7)
  const temVideo = useTemVideo(ficha);

  if (carregando) {
    return (
      <ul
        className="flex flex-col gap-3"
        role="status"
        aria-label="Carregando a lista"
      >
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton className="size-14 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={titulo} className="flex flex-col divide-y">
      {/* `scroll-mt-14` na linha: a faixa fixa do dia (§22.7 item 2) não pode
          comer a linha para onde a página acabou de rolar */}
      {itens.map((item) => (
        <li
          key={item.originalId}
          className="flex scroll-mt-14 items-center gap-1 py-2 first:pt-0"
        >
          {/* SPEC §14.2: tocar no exercício abre a ficha em folha, por cima */}
          <button
            type="button"
            aria-label={`Ficha: ${item.nome}`}
            onClick={() => setFicha(item.exercicioId)}
            className="hover:bg-muted/40 alvo -mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left"
          >
            <Miniatura exercicioId={item.exercicioId} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              {/*
                SPEC §22.7 item 5: o nome vem primeiro e sozinho na linha. Os
                raios desceram para o fim da prescrição, o que devolveu a
                largura inteira ao nome. A quebra em até duas linhas
                (`line-clamp-2`) continua: a 360 px quase nenhum nome do
                programa cabe numa linha e o corte apagaria justamente o que
                separa "Desenvolvimento com halteres" de "Desenvolvimento
                militar em pé" — e no celular não há `title` para consultar.
              */}
              <span className="line-clamp-2 min-w-0 text-sm font-semibold">
                {item.ordem}. {item.nome}
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="numero">{item.alvoTexto}</span>
                {mostrarRaios ? (
                  <Raios
                    nivel={dificuldadeDe(acharExercicio(item.exercicioId))}
                    tamanho="sm"
                    className="text-primary shrink-0"
                  />
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">
                {/* o olho bate no número da carga, não na palavra "Hoje" */}
                <span className="text-foreground">
                  Hoje: <span className="numero">{item.cargaTexto}</span>
                </span>
                {item.historico ? ` (${item.historico})` : ""}
              </span>
              {item.substituido ? (
                <span className="text-muted-foreground text-xs">
                  no lugar de {acharExercicio(item.originalId).nome} (só hoje)
                </span>
              ) : null}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
          </button>

          {aoSubstituir ? (
            <Substituir
              exercicioId={item.exercicioId}
              nome={item.nome}
              aoEscolher={(novo) => aoSubstituir(item.originalId, novo)}
              aoDesfazer={
                item.substituido
                  ? () => aoSubstituir(item.originalId, item.originalId)
                  : undefined
              }
              nomeDoOriginal={acharExercicio(item.originalId).nome}
              prefs={prefs}
            />
          ) : null}
        </li>
      ))}
      <FichaEmFolha
        exercicioId={ficha}
        aberto={ficha !== null}
        aoMudarAberto={(v) => setFicha(v ? ficha : null)}
        prefs={prefs}
        temVideo={temVideo}
      />
    </ul>
  );
}

/**
 * O mesmo fluxo da sessão (SPEC §3.2): exercícios do mesmo grupo que dão para
 * fazer com o equipamento do terraço. A escolha aqui fica guardada para a
 * sessão que vai começar (§13.3).
 */
function Substituir({
  exercicioId,
  nome,
  nomeDoOriginal,
  prefs,
  aoEscolher,
  aoDesfazer,
}: {
  exercicioId: string;
  nome: string;
  nomeDoOriginal: string;
  prefs?: Prefs;
  aoEscolher: (id: string) => void;
  aoDesfazer?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const lista = evitadosPorUltimo(
    substitutosPara(exercicioId),
    (e) => e.id,
    prefs,
  );
  if (lista.length === 0 && !aoDesfazer) return null;

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Substituir ${nome}`}
          className="alvo text-muted-foreground shrink-0"
        >
          <Repeat className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[80dvh] overflow-y-auto pb-8"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Substituir hoje</SheetTitle>
          <SheetDescription>
            O registro fica com o substituto; a progressão do original não muda.
            A escolha vale para o treino que você começar hoje.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-1 px-4">
          {aoDesfazer ? (
            <li>
              <SheetClose asChild>
                <button
                  type="button"
                  onClick={aoDesfazer}
                  className="hover:bg-muted alvo flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left"
                >
                  <span className="text-sm font-medium">
                    Voltar para {nomeDoOriginal}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    o exercício do programa
                  </span>
                </button>
              </SheetClose>
            </li>
          ) : null}
          {lista.map((e) => (
            <li key={e.id}>
              <SheetClose asChild>
                <button
                  type="button"
                  onClick={() => aoEscolher(e.id)}
                  className="hover:bg-muted alvo flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left"
                >
                  <span className="text-sm font-medium">{e.nome}</span>
                  <span className="text-muted-foreground text-xs">
                    {e.prescricao_padrao.texto} · {e.equipamento_texto}
                    {evitado(prefs, e.id) ? " · você marcou como evitar" : ""}
                  </span>
                </button>
              </SheetClose>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

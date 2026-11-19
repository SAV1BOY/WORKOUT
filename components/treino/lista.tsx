"use client";

import { ChevronRight, Repeat } from "lucide-react";
import { useState } from "react";
import { FichaEmFolha } from "@/components/exercicio/ficha-sob-demanda";
import { useTemVideo } from "@/components/videos-do-app";
import { Miniatura } from "@/components/ui/miniatura";
import { Raios } from "@/components/ui/raios";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MaterialDoTreino } from "@/components/exercicio/equipamento-de-hoje";
import { duracaoDaTroca, SeletorAlternativa, type RecorrenciaDaTroca } from "@/components/exercicio/seletor-alternativa";
import { acharExercicio } from "@/lib/dados";
import { dificuldadeDe } from "@/lib/dificuldade";
import type { ItemPrevia } from "@/lib/hoje";
import { nomeAcessivel } from "@/lib/midia";
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
  recorrencia,
  material,
  titulo = "Exercícios de hoje",
}: {
  itens: ItemPrevia[];
  carregando?: boolean;
  mostrarRaios?: boolean;
  /** `profiles.prefs` — o "não gosto" muda a ordem dos substitutos (§14.1.2). */
  prefs?: Prefs;
  /** Quando existe, cada item ganha o ⇄ (a lista da aba Treino). */
  aoSubstituir?: (originalId: string, novoExercicioId: string) => void;
  recorrencia?: RecorrenciaDaTroca;
  material?: MaterialDoTreino;
  titulo?: string;
}) {
  const [originalDaFicha, setFicha] = useState<string | null>(null);
  // a ficha aberta daqui mostra vídeo igual à do player (SPEC §22.2 item 7)
  const itemDaFicha = itens.find((item) => item.originalId === originalDaFicha);
  const ficha = itemDaFicha?.exercicioId ?? null;
  const temVideo = useTemVideo(ficha);
  const ocupadosForaDe = (originalId: string) =>
    itens.filter((outro) => outro.originalId !== originalId).map((outro) => outro.exercicioId);

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
            aria-label={nomeAcessivel("Ficha", item.nome)}
            onClick={() => setFicha(item.originalId)}
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
                  no lugar de {acharExercicio(item.originalId).nome} ({duracaoDaTroca(item.originalId, item.exercicioId, recorrencia)})
                </span>
              ) : null}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
          </button>

          {aoSubstituir ? (
            <SeletorAlternativa
              antesDoTreino
              originalId={item.originalId}
              ocupados={ocupadosForaDe(item.originalId)}
              recorrencia={recorrencia}
              material={material}
              exercicioId={item.exercicioId}
              prefs={prefs}
              aoSubstituir={(novo) => aoSubstituir(item.originalId, novo)}
              voltarAoOriginal={item.substituido ? {
                nome: acharExercicio(item.originalId).nome,
                escolher: () => aoSubstituir(item.originalId, item.originalId),
              } : undefined}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Substituir ${item.nome}`}
                className="alvo text-muted-foreground shrink-0"
              >
                <Repeat aria-hidden="true" className="size-5" />
              </Button>
            </SeletorAlternativa>
          ) : null}
        </li>
      ))}
      <FichaEmFolha
        exercicioId={ficha}
        aberto={ficha !== null}
        aoMudarAberto={(v) => { if (!v) setFicha(null); }}
        troca={itemDaFicha && aoSubstituir ? {
          originalId: itemDaFicha.originalId,
          ocupados: ocupadosForaDe(itemDaFicha.originalId),
          recorrencia,
          material,
          avisoDaTroca: "Escolha o exercício para o treino de hoje.",
          aoSubstituir: (novo) => aoSubstituir(itemDaFicha.originalId, novo),
        } : undefined}
        prefs={prefs}
        temVideo={temVideo}
      />
    </ul>
  );
}

"use client";

import { CircleHelp, Repeat } from "lucide-react";
import { useState } from "react";
import { MediaGrande } from "@/components/exercicio/media-grande";
import type { MaterialDoTreino } from "@/components/exercicio/equipamento-de-hoje";
import { FichaEmFolha } from "@/components/exercicio/ficha-sob-demanda";
import { BotaoMontagem } from "@/components/treinar/montagem";
import { LinhaSerieForm } from "@/components/treinar/serie";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { duracaoDaTroca, SeletorAlternativa, type RecorrenciaDaTroca } from "@/components/exercicio/seletor-alternativa";
import { acharExercicio } from "@/lib/dados";
import { nomeAcessivel } from "@/lib/midia";
import { textoDoAlvo } from "@/lib/hoje";
import type { OpcoesMontagem } from "@/lib/montagem";
import type { Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  avisoDaTroca,
  cargaEmUso,
  firmePadrao,
  textoDaCargaDoBloco,
  textoDosTrocados,
  type BlocoLocal,
  type SerieLocal,
} from "@/lib/sessao";

export function BlocoExercicio({
  bloco,
  historico,
  opcoes,
  prefs,
  temVideo = false,
  aoMudarSerie,
  aoMarcarSerie,
  aoMudarFirme,
  aoMudarNota,
  aoSubstituir,
  recorrencia,
  material,
  ocupados,
}: {
  bloco: BlocoLocal;
  /** "subiu +2 kg no treino de 12/09" (SPEC §6.6). */
  historico: string | null;
  opcoes: OpcoesMontagem;
  /** `profiles.prefs` — o "não gosto" muda a ordem dos substitutos (§14.1.2). */
  prefs?: Prefs;
  /** Existe `public/videos/<id>.mp4` para este exercício (SPEC §13.1). */
  temVideo?: boolean;
  aoMudarSerie: (serieId: string, campos: Partial<SerieLocal>) => void;
  aoMarcarSerie: (serieId: string, concluida: boolean) => void;
  aoMudarFirme: (firme: boolean) => void;
  aoMudarNota: (nota: string) => void;
  aoSubstituir: (novoExercicioId: string) => void;
  recorrencia?: RecorrenciaDaTroca;
  material?: MaterialDoTreino;
  ocupados?: readonly string[];
}) {
  const exercicio = acharExercicio(bloco.exercicioId);
  const firme = bloco.ultimaFirme ?? firmePadrao(bloco);
  const [ficha, setFicha] = useState(false);
  const trocados = textoDosTrocados(bloco);
  let nAquecimento = 0;
  let nTrabalho = 0;

  return (
    <Card id={`bloco-${bloco.ordem}`} className="cartao scroll-mt-20 gap-3 overflow-hidden pt-0 pb-4">
      {/* SPEC §13.3: capa em vídeo (quando existe), figura animada ou foto */}
      <MediaGrande
        exercicioId={bloco.exercicioId}
        temVideo={temVideo}
        /* SPEC §22.13 item 5: a figura abre o "Como fazer" deste bloco */
        aoAbrir={() => setFicha(true)}
        rotuloDoAbrir="abre o Como fazer"
        className="h-36 rounded-none"
      />

      <CardHeader className="gap-1 px-4">
        <div className="flex items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-base leading-tight font-semibold text-balance">
              {bloco.ordem}. {exercicio.nome}
            </h2>
            <p className="text-muted-foreground text-xs">
              {textoDoAlvo(bloco.prescricao.series, bloco.alvo)} · descanso{" "}
              {bloco.descansoTexto}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="alvo shrink-0"
            aria-label={nomeAcessivel("Como fazer", exercicio.nome)}
            onClick={() => setFicha(true)}
          >
            <CircleHelp className="size-5" />
          </Button>
          <FichaEmFolha
            exercicioId={bloco.exercicioId}
            aberto={ficha}
            troca={{
              originalId: bloco.originalId,
              recorrencia,
              material,
              ocupados,
              avisoDaTroca: avisoDaTroca(bloco),
              aoSubstituir,
            }}
            aoMudarAberto={setFicha}
            temVideo={temVideo}
            prefs={prefs}
          />
        </div>

        <p className="text-sm">
          <span className="numero">Hoje: {textoDaCargaDoBloco(bloco)}</span>
          {historico ? (
            <span className="text-muted-foreground"> ({historico})</span>
          ) : null}
        </p>

        {bloco.substituido ? (
          <p className="text-muted-foreground text-xs">
            no lugar de {acharExercicio(bloco.originalId).nome} ({duracaoDaTroca(bloco.originalId, bloco.exercicioId, recorrencia)})
          </p>
        ) : null}

        {trocados && <p className="text-muted-foreground text-xs">{trocados}</p>}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* a montagem fala da carga que está na barra agora, não da do dia */}
          <BotaoMontagem
            exercicioId={bloco.exercicioId}
            carga={cargaEmUso(bloco)}
            opcoes={opcoes}
          />
          <SeletorAlternativa
            originalId={bloco.originalId}
            ocupados={ocupados}
            recorrencia={recorrencia}
            material={material}
            avisoDaTroca={avisoDaTroca(bloco)}
            voltarAoOriginal={bloco.substituido ? {
              nome: acharExercicio(bloco.originalId).nome,
              escolher: () => aoSubstituir(bloco.originalId),
            } : undefined}
            exercicioId={bloco.exercicioId}
            prefs={prefs}
            aoSubstituir={aoSubstituir}
          >
            <Button variant="ghost" size="sm" className="alvo gap-1.5 px-3"
              aria-label={nomeAcessivel("Substituir hoje", exercicio.nome)}>
              <Repeat aria-hidden="true" className="size-4" />
              substituir hoje
            </Button>
          </SeletorAlternativa>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4">
        <ul className="flex flex-col gap-2">
          {bloco.series.map((serie) => {
            const indice =
              serie.tipo === "aquecimento" ? ++nAquecimento : ++nTrabalho;
            return (
              <LinhaSerieForm
                key={serie.id}
                bloco={bloco}
                serie={serie}
                indice={indice}
                opcoes={opcoes}
                aoMudar={(campos) => aoMudarSerie(serie.id, campos)}
                aoMarcar={(concluida) => aoMarcarSerie(serie.id, concluida)}
              />
            );
          })}
        </ul>

        {/*
          Alvo de 44 px (SPEC §3): o `Switch` do shadcn tem 18 px de altura, e
          aqui a linha inteira é o botão — dá para bater com o polegar.
        */}
        <button
          type="button"
          role="switch"
          aria-checked={firme}
          aria-label={nomeAcessivel("Última repetição firme", exercicio.nome)}
          onClick={() => aoMudarFirme(!firme)}
          className={cn(
            "alvo flex h-12 items-center justify-between gap-3 rounded-lg border px-3 text-sm",
            firme ? "border-primary bg-primary/10" : "border-input bg-background",
          )}
        >
          <span>Última repetição saiu firme?</span>
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
              firme ? "border-primary text-primary" : "border-input text-muted-foreground",
            )}
          >
            {firme ? "sim" : "não"}
          </span>
        </button>

        <input
          value={bloco.nota ?? ""}
          onChange={(e) => aoMudarNota(e.target.value)}
          placeholder="Nota curta (opcional)"
          aria-label={nomeAcessivel("Nota", exercicio.nome)}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
        />
      </CardContent>
    </Card>
  );
}

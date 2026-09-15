"use client";

import { Repeat } from "lucide-react";
import { useState } from "react";
import { MediaGrande } from "@/components/exercicio/media-grande";
import { AjudaExercicio } from "@/components/treinar/ajuda";
import { BotaoMontagem } from "@/components/treinar/montagem";
import { LinhaSerieForm } from "@/components/treinar/serie";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { textoDoAlvo } from "@/lib/hoje";
import type { OpcoesMontagem } from "@/lib/montagem";
import { cn } from "@/lib/utils";
import {
  cargaEmUso,
  firmePadrao,
  substitutosPara,
  textoDaCargaDoBloco,
  type BlocoLocal,
  type SerieLocal,
} from "@/lib/sessao";

export function BlocoExercicio({
  bloco,
  historico,
  opcoes,
  temVideo = false,
  aoMudarSerie,
  aoMarcarSerie,
  aoMudarFirme,
  aoMudarNota,
  aoSubstituir,
}: {
  bloco: BlocoLocal;
  /** "subiu +2 kg no treino de 12/09" (SPEC §6.6). */
  historico: string | null;
  opcoes: OpcoesMontagem;
  /** Existe `public/videos/<id>.mp4` para este exercício (SPEC §13.1). */
  temVideo?: boolean;
  aoMudarSerie: (serieId: string, campos: Partial<SerieLocal>) => void;
  aoMarcarSerie: (serieId: string, concluida: boolean) => void;
  aoMudarFirme: (firme: boolean) => void;
  aoMudarNota: (nota: string) => void;
  aoSubstituir: (novoExercicioId: string) => void;
}) {
  const exercicio = acharExercicio(bloco.exercicioId);
  const firme = bloco.ultimaFirme ?? firmePadrao(bloco);
  let nAquecimento = 0;
  let nTrabalho = 0;

  return (
    <Card id={`bloco-${bloco.ordem}`} className="cartao scroll-mt-20 gap-3 overflow-hidden pt-0 pb-4">
      {/* SPEC §13.3: capa em vídeo (quando existe), figura animada ou foto */}
      <MediaGrande
        exercicioId={bloco.exercicioId}
        temVideo={temVideo}
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
          <AjudaExercicio exercicioId={bloco.exercicioId} />
        </div>

        <p className="text-sm">
          <span className="numero">Hoje: {textoDaCargaDoBloco(bloco)}</span>
          {historico ? (
            <span className="text-muted-foreground"> ({historico})</span>
          ) : null}
        </p>

        {bloco.substituido ? (
          <p className="text-muted-foreground text-xs">
            no lugar de {acharExercicio(bloco.originalId).nome} (só hoje)
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* a montagem fala da carga que está na barra agora, não da do dia */}
          <BotaoMontagem
            exercicioId={bloco.exercicioId}
            carga={cargaEmUso(bloco)}
            opcoes={opcoes}
          />
          <Substituir
            exercicioId={bloco.exercicioId}
            temRegistro={bloco.series.some((s) => s.concluida)}
            aoEscolher={aoSubstituir}
          />
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
          aria-label={`Última repetição firme no ${exercicio.nome}`}
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
          aria-label={`Nota do ${exercicio.nome}`}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
        />
      </CardContent>
    </Card>
  );
}

/** "Substituir hoje" (SPEC §3.2): mesmo grupo, equipamento que existe aqui. */
function Substituir({
  exercicioId,
  temRegistro,
  aoEscolher,
}: {
  exercicioId: string;
  temRegistro: boolean;
  aoEscolher: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const lista = substitutosPara(exercicioId);
  if (lista.length === 0) return null;

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="alvo h-11 gap-1.5 px-3">
          <Repeat className="size-4" />
          substituir hoje
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto pb-8">
        <SheetHeader className="pb-0">
          <SheetTitle>Substituir hoje</SheetTitle>
          <SheetDescription>
            {temRegistro
              ? "As séries já registradas deste bloco serão trocadas pelas do substituto."
              : "O registro fica com o substituto; a progressão do original não muda."}
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-1 px-4">
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

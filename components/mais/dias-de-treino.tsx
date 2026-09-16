"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DIAS } from "@/lib/dados";
import {
  NOME_DO_DIA,
  ROTULO_DO_DIA,
  comDiasDeTreino,
  diasDeTreinoDasPrefs,
  diasPadraoDaFase,
  resumoDosDias,
} from "@/lib/dias";
import { metaSemanal } from "@/lib/metas";
import { salvarPrefs } from "@/lib/queries/mais";
import type { DiaSemana } from "@/lib/schemas";
import type { LinhaPerfil } from "@/lib/types";

/** "3 de força · 2 de cardio · 1 livre" — o que a escolha produz (SPEC §17.1). */
function resumoEmTexto(forca: number, cardio: number, livres: number): string {
  const partes = [
    `${forca} de força`,
    `${cardio} de cardio`,
    livres > 0 ? `${livres} ${livres === 1 ? "livre" : "livres"}` : null,
  ].filter(Boolean);
  return partes.join(" · ");
}

/**
 * O card "Dias de treino" (SPEC §17.1): sete chips que ligam e desligam os
 * dias da semana. A escolha vai para `profiles.prefs.dias_de_treino` e o resto
 * do app (aba Treino, calendário, meta semanal) passa a ler a semana montada
 * a partir dela — ou a do `programa.json`, quando não há escolha nenhuma.
 */
export function DiasDeTreino({
  userId,
  perfil,
}: {
  userId: string;
  perfil: LinhaPerfil;
}) {
  const cliente = useQueryClient();
  const padrao = diasPadraoDaFase(perfil.fase_atual);
  const gravados = diasDeTreinoDasPrefs(perfil.prefs);
  const escolhidos = gravados ?? padrao;
  const personalizado = gravados !== null;
  const [salvando, setSalvando] = useState(false);

  const resumo = resumoDosDias(perfil.fase_atual, gravados);
  /*
   * A meta que a aba Treino está usando de verdade: `prefs.meta_semanal`
   * quando ele a definiu no card logo abaixo, senão o padrão que estes dias
   * produzem. Sem isto os dois cards da mesma tela diziam números diferentes.
   */
  const meta = metaSemanal(perfil.prefs, perfil.fase_atual);

  const gravar = async (dias: DiaSemana[] | null, aviso: string) => {
    setSalvando(true);
    try {
      await salvarPrefs({
        userId,
        prefs: comDiasDeTreino(perfil.prefs, dias),
        cliente,
      });
      toast.success(aviso);
    } catch {
      toast.error("Não consegui salvar agora. Fica na fila.");
    } finally {
      setSalvando(false);
    }
  };

  const alternar = (dia: DiaSemana) => {
    const novos = escolhidos.includes(dia)
      ? escolhidos.filter((d) => d !== dia)
      : [...escolhidos, dia];
    const semana = resumoDosDias(perfil.fase_atual, novos);
    void gravar(
      novos,
      novos.length === 0
        ? "Nenhum dia de treino na semana."
        : `${novos.length} ${novos.length === 1 ? "dia" : "dias"}: ${resumoEmTexto(
            semana.forca,
            semana.cardio,
            semana.livres,
          )}.`,
    );
  };

  return (
    <Card id="dias-de-treino" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-base">Dias de treino</CardTitle>
        <CardDescription>
          Em quais dias você vai treinar. O app distribui a força primeiro, põe
          o cardio no que sobra e deixa o resto como descanso.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div role="group" aria-label="Dias de treino" className="grid grid-cols-4 gap-2">
          {DIAS.map((dia) => {
            const ligado = escolhidos.includes(dia);
            return (
              <Button
                key={dia}
                type="button"
                variant={ligado ? "default" : "outline"}
                aria-pressed={ligado}
                aria-label={NOME_DO_DIA[dia]}
                data-dia-chip={dia}
                className="alvo h-12"
                disabled={salvando}
                onClick={() => alternar(dia)}
              >
                {ROTULO_DO_DIA[dia]}
              </Button>
            );
          })}
        </div>

        <p className="text-muted-foreground text-xs" data-resumo-dias>
          {escolhidos.length === 0
            ? "Nenhum dia escolhido: a semana fica toda de descanso."
            : `${resumoEmTexto(resumo.forca, resumo.cardio, resumo.livres)} · meta semanal ${meta}`}
          {personalizado ? "" : " (os dias do programa)"}
        </p>

        {personalizado ? (
          <Button
            variant="outline"
            className="alvo h-12 w-full"
            disabled={salvando}
            onClick={() => void gravar(null, "De volta aos dias do programa.")}
          >
            Voltar aos dias do programa
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

"use client";

import { Trophy } from "lucide-react";
import { useMemo } from "react";
import { FaixaSemana } from "@/components/ui/faixa-semana";
import { semanaDaFase, semanaDoPlano } from "@/lib/calendario";
import { metaSemanal, progressoDaMeta } from "@/lib/metas";
import { useCardio, useOverrides, usePerfil, useSessoes } from "@/lib/queries/dados";
import { faixaDaSemana, intervaloDaSemana, montarGrade } from "@/lib/semana";

/**
 * "Semana N · feitos/meta" na conclusão (SPEC §14.1.5): os sete círculos
 * seg–dom, com hoje já contando como feito — a sessão que acabou ainda está
 * na fila de saída, e o card tem de mostrar o resultado dela.
 */
export function CardDaSemana({
  hoje,
  dataDaSessao,
}: {
  hoje: string;
  /** A sessão que acabou (conta na semana mesmo antes de a fila subir). */
  dataDaSessao: string;
}) {
  const intervalo = intervaloDaSemana(hoje);
  const perfilQ = usePerfil();
  const sessoesQ = useSessoes();
  const cardioQ = useCardio(intervalo.de, intervalo.ate);
  const overridesQ = useOverrides(intervalo.de, intervalo.ate);
  const perfil = perfilQ.data ?? null;

  const sessoes = useMemo(() => {
    const lista = sessoesQ.data ?? [];
    const jaTem = lista.some(
      (s) => s.data === dataDaSessao && s.status === "concluida",
    );
    if (jaTem) return lista;
    return [
      ...lista,
      {
        id: "recem-concluida",
        data: dataDaSessao,
        status: "concluida" as const,
        workout_id: "livre" as const,
        fase: perfil?.fase_atual ?? "fase1",
        concluida_em: null,
      },
    ];
  }, [sessoesQ.data, dataDaSessao, perfil?.fase_atual]);

  if (!perfil) return null;

  const semana = semanaDoPlano(hoje, perfil, overridesQ.data ?? []);
  const grade = montarGrade(semana, sessoes, cardioQ.data ?? [], hoje);
  const dias = faixaDaSemana(grade);
  const meta = progressoDaMeta({
    sessoes,
    cardios: cardioQ.data ?? [],
    de: intervalo.de,
    ate: intervalo.ate,
    meta: metaSemanal(perfil.prefs, perfil.fase_atual),
  });
  const numeroDaSemana = semanaDaFase(hoje, perfil.fase_desde);

  return (
    <section
      aria-label="Semana e meta"
      className="cartao border-border bg-card flex flex-col gap-2 border p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Semana {numeroDaSemana}</h3>
        <span className="flex items-center gap-1.5">
          <span className="numero text-lg">{meta.texto}</span>
          {meta.cumprida ? (
            <Trophy
              aria-label="Meta da semana cumprida"
              className="text-primary size-5"
            />
          ) : null}
        </span>
      </div>
      <FaixaSemana dias={dias} className="border-0 p-0" />
    </section>
  );
}

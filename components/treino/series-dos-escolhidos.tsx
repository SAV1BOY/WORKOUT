"use client";

import { BotaoLargo } from "@/components/ui/botao-largo";
import { acharExercicio } from "@/lib/dados";
import { MAX_SERIES_DA_SESSAO, MIN_SERIES_DA_SESSAO, prescricaoPadrao } from "@/lib/progressao";

const contagens = Array.from({ length: MAX_SERIES_DA_SESSAO - MIN_SERIES_DA_SESSAO + 1 }, (_, i) => i + MIN_SERIES_DA_SESSAO);

export function SeriesDosEscolhidos({ ids, ajustes, aoMudar, aoFechar }: {
  ids: readonly string[];
  ajustes: Readonly<Record<string, number>>;
  aoMudar: (id: string, series?: number) => void;
  aoFechar: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
      <ol aria-label="Séries de trabalho dos escolhidos" className="min-h-0 overflow-y-auto divide-y px-1">
        {ids.map(id => {
          const exercicio = acharExercicio(id);
          const padrao = prescricaoPadrao(exercicio).series;
          return (
            <li key={id} className="py-2">
              <label className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-[1_1_10rem] text-sm font-medium wrap-anywhere">{exercicio.nome}</span>
                <select aria-label={`Séries de trabalho de ${exercicio.nome}`} value={ajustes[id] ?? ""}
                  onChange={evento => aoMudar(id, evento.target.value ? Number(evento.target.value) : undefined)}
                  className="alvo foco numero border-input bg-background min-w-0 max-w-full rounded-md border px-2 py-1 text-base">
                  <option value="">Padrão ({padrao})</option>
                  {contagens.map(n => <option key={n} value={n}>{n} {n === 1 ? "série" : "séries"}</option>)}
                </select>
              </label>
            </li>
          );
        })}
      </ol>
      <BotaoLargo type="button" className="shrink-0" onClick={aoFechar}>Pronto</BotaoLargo>
    </div>
  );
}

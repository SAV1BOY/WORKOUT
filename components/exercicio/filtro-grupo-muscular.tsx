import type { Ref } from "react";
import { opcoesDoCatalogo, type FiltrosCatalogo } from "@/lib/catalogo";
import { exerciciosComVariacoes } from "@/lib/dados";

const { grupos } = opcoesDoCatalogo(exerciciosComVariacoes);

export function FiltroGrupoMuscular({ ref, grupo, aoMudar, desabilitado }: {
  ref?: Ref<HTMLSelectElement>;
  grupo: FiltrosCatalogo["grupo"];
  aoMudar: (grupo: FiltrosCatalogo["grupo"]) => void;
  desabilitado?: boolean;
}) {
  return (
    <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
      Grupo muscular
      <select ref={ref} value={grupo} disabled={desabilitado}
        onChange={e => aoMudar(e.target.value as FiltrosCatalogo["grupo"])}
        className="alvo foco border-input bg-background min-w-0 max-w-full flex-[1_0_7rem] rounded-md border px-2 text-base font-normal">
        <option value="todos">Todos</option>
        {grupos.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
    </label>
  );
}

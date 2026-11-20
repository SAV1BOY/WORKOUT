"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOME_EQUIPAMENTO } from "@/lib/catalogo";
import { equipamentoDisponivel } from "@/lib/dados";
import type { EquipamentoTag } from "@/lib/schemas";

export interface MaterialDoTreino {
  disponiveis: ReadonlySet<EquipamentoTag>;
  aoMudar: (disponiveis: ReadonlySet<EquipamentoTag>) => void;
}

export function nomeDoMaterial(tag: EquipamentoTag): string {
  return tag === "super-band" ? "Elástico (Super Band)" : NOME_EQUIPAMENTO[tag];
}

const inventario = [...equipamentoDisponivel()].sort((a, b) =>
  nomeDoMaterial(a).localeCompare(nomeDoMaterial(b), "pt-BR"),
);

function resumoDoMaterial(marcados: EquipamentoTag[]): string {
  if (marcados.length === inventario.length) return "Todo o equipamento";
  if (marcados.length === 0) return "Só peso do corpo";
  if (marcados.length <= 2) {
    return marcados.map(tag => tag === "super-band" ? "Elástico" : NOME_EQUIPAMENTO[tag]).join(" e ");
  }
  return `${marcados.length} de ${inventario.length} itens`;
}

export function EquipamentoDeHoje({
  material, noSeletor = false, desabilitado,
  descricao = "As alternativas deste treino usam o material marcado.",
}: {
  material: MaterialDoTreino;
  noSeletor?: boolean;
  desabilitado?: boolean;
  descricao?: string;
}) {
  const { disponiveis, aoMudar } = material;
  const marcados = inventario.filter(tag => disponiveis.has(tag));

  function mudar(tag: EquipamentoTag, presente: boolean) {
    const proximo = new Set(disponiveis);
    if (presente) proximo.add(tag);
    else proximo.delete(tag);
    aoMudar(proximo);
  }

  return (
    <details className="group rounded-lg border">
      <summary className="alvo hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2">
        <span className="flex min-w-0 flex-col text-left wrap-anywhere">
          <span className="text-sm font-medium">{noSeletor ? "Equipamentos disponíveis" : "Equipamento de hoje"}</span>
          <span className="text-muted-foreground text-xs">{resumoDoMaterial(marcados)}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
      </summary>
      <fieldset disabled={desabilitado} className="min-w-0 px-3 pb-2">
        <legend className="sr-only">Equipamento de hoje</legend>
        <p className="text-muted-foreground mb-2 text-sm">{descricao}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!marcados.length}
            className="alvo h-auto whitespace-normal px-2" onClick={() => aoMudar(new Set())}>
            Só peso do corpo
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={marcados.length === inventario.length}
            className="alvo h-auto whitespace-normal px-2" onClick={() => aoMudar(new Set(inventario))}>
            Usar todo o equipamento
          </Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-x-2">
          {inventario.map(tag => (
            <label key={tag} className="alvo flex min-w-0 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={disponiveis.has(tag)}
                onChange={evento => mudar(tag, evento.target.checked)} />
              <span className="min-w-0 wrap-anywhere">{nomeDoMaterial(tag)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </details>
  );
}

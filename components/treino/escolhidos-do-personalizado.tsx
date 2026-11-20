import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";

export function EscolhidosDoPersonalizado({ ids, series, descansos, equipamento, ocupado, idDoBotaoDeTroca, aoTirar, aoTrocar }: {
  ids: readonly string[];
  series: Readonly<Record<string, number>>;
  descansos: Readonly<Record<string, number>>;
  equipamento: ReadonlyMap<string, string>;
  ocupado: boolean;
  idDoBotaoDeTroca: (id: string) => string;
  aoTirar: (id: string) => void;
  aoTrocar: (id: string) => void;
}) {
  return (
    <ul aria-label="Escolhidos" className="mt-3 divide-y">
      {ids.map((id, i) => {
        const nome = acharExercicio(id).nome;
        const quantidade = series[id];
        const segundos = descansos[id];
        const botaoId = idDoBotaoDeTroca(id);
        const contagem = quantidade !== undefined ? botaoId + "-series" : undefined;
        const intervalo = segundos !== undefined ? botaoId + "-descanso" : undefined;
        const aviso = equipamento.has(id) ? undefined : botaoId + "-material";
        const descricao = [contagem, intervalo, aviso].filter(Boolean).join(" ") || undefined;
        return (
          <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <div className="min-w-0 flex-[1_1_9rem] text-sm wrap-anywhere">
              <span className="font-medium"><span className="numero">{i + 1}.</span> {nome}</span>
              {contagem && <span id={contagem} className="numero text-muted-foreground block text-xs">
                {quantidade} {quantidade === 1 ? "série" : "séries"} de trabalho
              </span>}
              {intervalo && <span id={intervalo} className="numero text-muted-foreground block text-xs">{segundos} s de descanso</span>}
              {aviso && <span id={aviso} className="block text-xs font-medium">Requer outro material</span>}
            </div>
            <div className="flex max-w-full flex-wrap gap-2">
              <Button type="button" size="sm" variant="ghost" aria-label={`Tirar ${nome}`} aria-describedby={descricao}
                disabled={ocupado} className="alvo h-auto px-2 py-1" onClick={() => aoTirar(id)}>Tirar</Button>
              <Button id={botaoId} type="button" size="sm" variant="outline" aria-label={`Trocar ${nome}`} aria-describedby={descricao}
                disabled={ocupado} className="alvo h-auto px-2 py-1" onClick={() => aoTrocar(id)}>Trocar</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

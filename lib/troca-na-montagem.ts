import { alternativasPara } from "@/lib/alternativas";
import { exercicioPorId } from "@/lib/dados";
import type { EquipamentoTag } from "@/lib/schemas";

export type EscolhaNaMontagem = {
  escolhidos: string[];
  seriesPorExercicio: Record<string, number>;
  descansosPorExercicio: Record<string, number>;
};

export type TrocaNaMontagem = {
  anterior: string;
  substituto: string;
  series?: number;
  descanso?: number;
};

function cabeNaLista(escolhidos: readonly string[], sai: string, entra: string) {
  const indice = escolhidos.indexOf(sai);
  return indice >= 0 && indice === escolhidos.lastIndexOf(sai) && !escolhidos.includes(entra);
}

function trocarAjuste(ajustes: Record<string, number>, sai: string, entra: string, valor?: number) {
  const novos = { ...ajustes };
  delete novos[sai];
  if (valor === undefined) delete novos[entra];
  else novos[entra] = valor;
  return novos;
}

function substituir(
  rascunho: EscolhaNaMontagem, sai: string, entra: string, series?: number, descanso?: number,
): EscolhaNaMontagem {
  return {
    escolhidos: rascunho.escolhidos.map(id => id === sai ? entra : id),
    seriesPorExercicio: trocarAjuste(rascunho.seriesPorExercicio, sai, entra, series),
    descansosPorExercicio: trocarAjuste(rascunho.descansosPorExercicio, sai, entra, descanso),
  };
}

export function trocarEscolhido(
  rascunho: EscolhaNaMontagem, anterior: string, substituto: string, material: ReadonlySet<EquipamentoTag>,
): (EscolhaNaMontagem & { troca: TrocaNaMontagem }) | null {
  if (!cabeNaLista(rascunho.escolhidos, anterior, substituto) || !exercicioPorId.has(anterior)) return null;
  if (!alternativasPara(anterior, "todos", material).some(e => e.id === substituto)) return null;
  const troca: TrocaNaMontagem = { anterior, substituto };
  const series = rascunho.seriesPorExercicio[anterior];
  const descanso = rascunho.descansosPorExercicio[anterior];
  if (series !== undefined) troca.series = series;
  if (descanso !== undefined) troca.descanso = descanso;
  return { ...substituir(rascunho, anterior, substituto), troca };
}

export function podeDesfazerTrocaNaMontagem(escolhidos: readonly string[], troca: TrocaNaMontagem) {
  return cabeNaLista(escolhidos, troca.substituto, troca.anterior);
}

export function desfazerTrocaNaMontagem(rascunho: EscolhaNaMontagem, troca: TrocaNaMontagem): EscolhaNaMontagem | null {
  if (!podeDesfazerTrocaNaMontagem(rascunho.escolhidos, troca)) return null;
  return substituir(rascunho, troca.substituto, troca.anterior, troca.series, troca.descanso);
}

/** As tags aceitas pelo catálogo e pela leitura da montagem do terraço. */
export const TAGS_DE_EQUIPAMENTO = [
  "anilhas",
  "banco",
  "barra-macica",
  "barra-w",
  "halteres",
  "cavalete",
  "barra-fixa",
  "cross-over",
  "puxadores",
  "tatame",
  "corda",
  "super-band",
] as const;

export function ehTagDeEquipamento(valor: string): valor is (typeof TAGS_DE_EQUIPAMENTO)[number] {
  return TAGS_DE_EQUIPAMENTO.some((tag) => tag === valor);
}

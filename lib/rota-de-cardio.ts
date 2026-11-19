import type { TipoCardio } from "@/lib/types";

/** Os quatro tipos que a rota `/cardio/[id]` aceita. */
export const TIPOS_DE_CARDIO: readonly TipoCardio[] = [
  "corrida",
  "corda",
  "caminhada",
  "outro",
];

export function ehTipoDeCardio(valor: string): valor is TipoCardio {
  return (TIPOS_DE_CARDIO as readonly string[]).includes(valor);
}

/** Só o resumo por UUID pode ser aberto pelo documento offline de uma sessão registrada. */
export function resumoDeCardioNaUrl(url: URL) {
  const tipo = /^\/cardio\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  const sessaoId = url.searchParams.get("sessao");
  if (!tipo || !ehTipoDeCardio(tipo) || !sessaoId || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(sessaoId)) return null;
  return { tipo, sessaoId };
}

import { CAMPOS_DE_CONTAGEM } from "@/lib/campos-de-contagem";
import type { EscritaTabela } from "@/lib/outbox-supabase";

export class LeituraAnteriorACorrecao extends Error {}

function fracoesDaFila(escritas: readonly EscritaTabela[], sessaoId?: string) {
  const fracoes = new Set<string>();
  for (const { linha } of escritas) {
    // escritasPendentes já separou os lotes em linhas da conta.
    if (!linha || typeof linha.id !== "string" || typeof linha.session_id !== "string" ||
        (sessaoId !== undefined && linha.session_id !== sessaoId)) continue;
    for (const campo of CAMPOS_DE_CONTAGEM) {
      const valor = linha[campo];
      if (typeof valor === "number" && Number.isFinite(valor) && !Number.isInteger(valor)) {
        fracoes.add(JSON.stringify([linha.session_id, linha.id, campo, valor]));
      }
    }
  }
  return fracoes;
}

/** Uma fração não sobe no PostgreSQL. Se desapareceu enquanto o GET estava em voo, a resposta antecede a correção. */
export function conferirContagensObservadas(escritas: readonly EscritaTabela[], sessaoId?: string) {
  const antes = fracoesDaFila(escritas, sessaoId);
  if (!antes.size) return undefined;
  return (atuais: readonly EscritaTabela[]) => {
    const agora = fracoesDaFila(atuais, sessaoId);
    for (const fracao of antes) if (!agora.has(fracao)) throw new LeituraAnteriorACorrecao();
  };
}

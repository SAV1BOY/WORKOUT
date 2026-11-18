/**
 * A leitura em texto de um gráfico (SPEC §22.19 item 1).
 *
 * O desenho do Recharts fica fora da árvore de acessibilidade; quem usa leitor
 * de tela ouve o nome da `<figure role="img">`, que é o título MAIS o que o
 * gráfico mostra. Pura: recebe as mesmas linhas que o gráfico desenha.
 */
import { formatarNumero } from "@/lib/formato";

export interface SerieParaLer {
  chave: string;
  nome: string;
}

export interface ReferenciaParaLer {
  nome: string;
  valor: number;
}

/** Até quantos pontos a leitura cita um a um; acima disso, o resumo. */
export const PONTOS_CITADOS = 6;

interface Ponto {
  x: string;
  valor: number;
}

function valorDe(linha: object, chave: string): number | null {
  const bruto = (linha as Record<string, unknown>)[chave];
  if (bruto === null || bruto === undefined || bruto === "") return null;
  const n = typeof bruto === "number" ? bruto : Number(bruto);
  return Number.isFinite(n) ? n : null;
}

function rotuloDe(linha: object, chave: string): string {
  const bruto = (linha as Record<string, unknown>)[chave];
  return bruto === null || bruto === undefined ? "" : String(bruto);
}

function comSufixo(valor: number, sufixo: string): string {
  return `${formatarNumero(valor)}${sufixo}`;
}

/** "queda de 1,8 kg" · "alta de 2 kg" · "sem variação" (primeiro → último). */
export function tendencia(primeiro: number, ultimo: number, sufixo = ""): string {
  const diferenca = Math.round((ultimo - primeiro) * 100) / 100;
  if (diferenca === 0) return "sem variação";
  return `${diferenca < 0 ? "queda" : "alta"} de ${comSufixo(Math.abs(diferenca), sufixo)}`;
}

function lerSerie(nome: string, pontos: readonly Ponto[], sufixo: string): string {
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  if (!primeiro || !ultimo) return "";
  if (pontos.length <= PONTOS_CITADOS) {
    const lista = pontos.map((p) => `${comSufixo(p.valor, sufixo)} em ${p.x}`).join(", ");
    return pontos.length === 1
      ? `${nome}: ${lista}`
      : `${nome}: ${lista} — ${tendencia(primeiro.valor, ultimo.valor, sufixo)}`;
  }
  let menor = primeiro;
  let maior = primeiro;
  for (const p of pontos) {
    if (p.valor < menor.valor) menor = p;
    if (p.valor > maior.valor) maior = p;
  }
  const faixa = `${nome}: ${pontos.length} valores de ${primeiro.x} a ${ultimo.x}`;
  // série constante (as 12 semanas sem barra fixa): o número uma vez só
  if (menor.valor === maior.valor) return `${faixa}, todos ${comSufixo(primeiro.valor, sufixo)}`;
  return (
    `${faixa}; ` +
    `primeiro ${comSufixo(primeiro.valor, sufixo)}, último ${comSufixo(ultimo.valor, sufixo)}` +
    ` — ${tendencia(primeiro.valor, ultimo.valor, sufixo)}; ` +
    `menor ${comSufixo(menor.valor, sufixo)} em ${menor.x}, ` +
    `maior ${comSufixo(maior.valor, sufixo)} em ${maior.x}`
  );
}

/**
 * "Peso por data. Peso: 84,2 kg em 12/08, 83,1 kg em 26/08, 82,4 kg em 12/09
 * — queda de 1,8 kg. Meta: 80 kg."
 *
 * - Até `PONTOS_CITADOS` pontos, cada um com o valor e o rótulo do eixo x.
 * - Acima disso, quantos, de quando a quando, o primeiro, o último, a
 *   tendência e o menor e o maior com o rótulo deles. Série constante:
 *   "12 valores de 29/06 a 14/09, todos 0" (o número uma vez só).
 * - Série sem nenhum valor não é citada (§22.19 item 3: nada fala de série
 *   vazia). Sem valor nenhum em série nenhuma: "sem dados".
 * - `referencia` (a meta do peso) entra no fim.
 */
export function leituraDoGrafico({
  titulo,
  dados,
  x,
  series,
  sufixo = "",
  referencia = null,
}: {
  titulo: string;
  dados: readonly object[];
  x: string;
  series: readonly SerieParaLer[];
  sufixo?: string;
  referencia?: ReferenciaParaLer | null;
}): string {
  const partes: string[] = [];
  for (const s of series) {
    const pontos: Ponto[] = [];
    for (const linha of dados) {
      const valor = valorDe(linha, s.chave);
      if (valor !== null) pontos.push({ x: rotuloDe(linha, x), valor });
    }
    if (pontos.length > 0) partes.push(lerSerie(s.nome, pontos, sufixo));
  }
  if (partes.length === 0) partes.push("sem dados");
  if (referencia && Number.isFinite(referencia.valor)) {
    partes.push(`${referencia.nome}: ${comSufixo(referencia.valor, sufixo)}`);
  }
  return `${titulo}. ${partes.join(". ")}.`;
}

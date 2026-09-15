/**
 * IMC — peso ÷ altura² (SPEC §13.5 e §14.1.5).
 *
 * Funções puras. As faixas são as da OMS, com o rótulo em pt-BR; a barra da
 * tela vai de 15 a 40, que é onde as faixas ficam legíveis.
 *
 * O IMC não distingue músculo de gordura: quem treina força pode subir de IMC
 * justamente porque o treino está funcionando. A ressalva de uma linha mora
 * aqui para a tela não inventar outra.
 */

export const IMC_MIN = 15;
export const IMC_MAX = 40;

export type ChaveDaFaixa =
  | "abaixo"
  | "saudavel"
  | "sobrepeso"
  | "obesidade1"
  | "obesidade2";

export interface FaixaDeImc {
  chave: ChaveDaFaixa;
  rotulo: string;
  /** Piso da faixa (o primeiro é 0). */
  de: number;
  /** Topo aberto da faixa (`null` na última). */
  ate: number | null;
}

/** SPEC §13.5: abaixo de 18,5 · 18,5–25 · 25–30 · 30–35 · 35+. */
export const FAIXAS_DE_IMC: readonly FaixaDeImc[] = [
  { chave: "abaixo", rotulo: "Abaixo do peso", de: 0, ate: 18.5 },
  { chave: "saudavel", rotulo: "Saudável", de: 18.5, ate: 25 },
  { chave: "sobrepeso", rotulo: "Sobrepeso", de: 25, ate: 30 },
  { chave: "obesidade1", rotulo: "Obesidade grau 1", de: 30, ate: 35 },
  { chave: "obesidade2", rotulo: "Obesidade grau 2 ou 3", de: 35, ate: null },
];

export const RESSALVA_DO_IMC =
  "O IMC não separa músculo de gordura: ganhar massa sobe o número.";

/** IMC de um peso (kg) e uma altura (cm). `null` quando falta um dos dois. */
export function imc(
  pesoKg: number | null | undefined,
  alturaCm: number | null | undefined,
): number | null {
  if (typeof pesoKg !== "number" || typeof alturaCm !== "number") return null;
  if (!Number.isFinite(pesoKg) || !Number.isFinite(alturaCm)) return null;
  if (pesoKg <= 0 || alturaCm <= 0) return null;
  const metros = alturaCm / 100;
  const valor = pesoKg / (metros * metros);
  return Math.round(valor * 10) / 10;
}

export function faixaDoImc(valor: number | null): FaixaDeImc | null {
  if (valor === null || !Number.isFinite(valor)) return null;
  return (
    FAIXAS_DE_IMC.find((f) => valor >= f.de && (f.ate === null || valor < f.ate)) ??
    FAIXAS_DE_IMC[FAIXAS_DE_IMC.length - 1] ??
    null
  );
}

/** Onde o marcador fica na barra de 15 a 40 (0 a 1), preso nas pontas. */
export function posicaoNaBarra(valor: number | null): number | null {
  if (valor === null || !Number.isFinite(valor)) return null;
  const preso = Math.min(IMC_MAX, Math.max(IMC_MIN, valor));
  return (preso - IMC_MIN) / (IMC_MAX - IMC_MIN);
}

/** A largura de cada faixa dentro da barra de 15 a 40 (soma 1). */
export function larguraDaFaixa(faixa: FaixaDeImc): number {
  const de = Math.max(IMC_MIN, faixa.de);
  const ate = Math.min(IMC_MAX, faixa.ate ?? IMC_MAX);
  return Math.max(0, (ate - de) / (IMC_MAX - IMC_MIN));
}

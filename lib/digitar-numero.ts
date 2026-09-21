/**
 * O que o campo numérico aceita enquanto o dedo digita (SPEC §22.11).
 *
 * Por que existe: em 21/09/2026, digitando "12,5" depressa em CARGA NA BARRA,
 * o player mostrou "11,5,5". São duas coisas ao mesmo tempo — o efeito do
 * `StepperNumerico` reescrevia o texto no meio da digitação (ao chegar em "12"
 * o app ajusta para a anilha possível, 11,5), e o campo aceitava a segunda
 * vírgula que caía no texto reescrito. O valor gravado saía certo, porque o
 * `onBlur` normaliza, mas o número impossível ficava na tela do campo mais
 * importante do player.
 *
 * A regra é pura de propósito: `<input>` controlado é o lugar clássico de
 * regressão silenciosa, e aqui ela mora num teste de unidade
 * (`lib/digitar-numero.test.ts`).
 */

/**
 * O que o campo passa a mostrar depois de uma digitação — o texto novo quando
 * ele é um número em construção, ou o texto de antes quando não é (a tecla
 * simplesmente não entra).
 *
 * Em construção quer dizer: dígitos, **um** separador decimal (ponto vira
 * vírgula, que é o que se escreve em português) e, onde o campo aceita
 * negativo, o sinal de menos na frente. Vazio é sempre permitido — é assim que
 * se apaga o campo para digitar outro valor.
 */
export function aceitarDigitacao(
  textoAtual: string,
  textoNovo: string,
  opcoes: { negativo?: boolean } = {},
): string {
  const proposto = textoNovo.replace(/\./g, ",");
  if (proposto === "") return "";
  const corpo =
    opcoes.negativo && proposto.startsWith("-") ? proposto.slice(1) : proposto;
  // dígitos, no máximo uma vírgula: "12", "12,", "12,5" e ",5" passam
  if (!/^\d*,?\d*$/.test(corpo)) return textoAtual;
  return proposto;
}

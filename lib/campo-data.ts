/**
 * O campo de data do Corpo (SPEC §22.19 item 6): "Hoje · Ontem · Outra data".
 *
 * Puro: diz qual dos três botões está aceso e o que cada um mostra. Quem
 * desenha é `components/ui/campo-data.tsx`.
 */
import { addDays } from "date-fns";
import { iso, paraData } from "@/lib/calendario";
import { formatarData } from "@/lib/formato";

export type QualData = "hoje" | "ontem" | "outra";

export interface OpcoesDaData {
  /** `aaaa-mm-dd` de hoje e de ontem, para gravar. */
  hoje: string;
  ontem: string;
  /** O que cada botão mostra, em dd/mm. */
  rotuloHoje: string;
  rotuloOntem: string;
  /** A data escolhida em dd/mm quando não é hoje nem ontem; senão `null`. */
  rotuloOutra: string | null;
  /** Qual botão está aceso. */
  qual: QualData;
}

export function opcoesDaData(hoje: string, escolhida: string): OpcoesDaData {
  const ontem = iso(addDays(paraData(hoje), -1));
  const qual: QualData = escolhida === hoje ? "hoje" : escolhida === ontem ? "ontem" : "outra";
  return {
    hoje,
    ontem,
    rotuloHoje: formatarData(hoje),
    rotuloOntem: formatarData(ontem),
    rotuloOutra: qual === "outra" ? formatarData(escolhida) : null,
    qual,
  };
}

/**
 * O valor que o seletor do aparelho devolveu vale? Vazio (o "limpar" do
 * seletor), fora do formato ou depois de hoje não trocam a data.
 */
export function dataValida(valor: string, hoje: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && valor <= hoje;
}

/**
 * A escolha do campo de data (SPEC §22.19 item 6, "a escolha acompanha o
 * dia"). O campo guarda a ESCOLHA, não a data: `null` é "Hoje", que segue o
 * relógio do aparelho; um toque em Ontem ou em Outra data guarda a data e o
 * dia (`em`) em que foi feito.
 *
 * Antes era `useState(hoje)`, lido só na montagem: com o Corpo aberto na
 * virada do dia, "Registrar" sem tocar na data gravava na véspera e
 * sobrescrevia a pesagem de ontem (a gravação é por usuário e data).
 */
export interface EscolhaDaData {
  /** `aaaa-mm-dd` escolhido. */
  data: string;
  /** O hoje do aparelho no momento do toque. */
  em: string;
}

/** O que guardar quando a pessoa toca numa data: hoje é o mesmo que não tocar. */
export function escolherData(data: string, hoje: string): EscolhaDaData | null {
  return data === hoje ? null : { data, em: hoje };
}

/**
 * A data que o registro usa agora. Sem escolha: hoje (o de agora, não o da
 * montagem). Uma escolha feita em outro dia (a tela ficou aberta na virada)
 * não vale mais: volta para hoje.
 */
export function dataDaEscolha(escolha: EscolhaDaData | null, hoje: string): string {
  if (!escolha || escolha.em !== hoje) return hoje;
  return escolha.data;
}

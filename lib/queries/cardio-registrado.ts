import type { QueryClient } from "@tanstack/react-query";
import { bd, temIndexedDB } from "@/lib/db";
import { aplicarAlteracoesDoCardio, atualizarCardiosConciliados, CARDIOS_RECENTES, revisaoDoCardio } from "@/lib/espelhos-dos-saltos";
import { lerConsultaGuardadaComData, VALIDADE_MS } from "@/lib/persistencia-query";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { aplicarPendentes, chaveDaLista, escritasPendentes } from "@/lib/queries/lista-do-relatorio";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import type { LinhaSessaoCardio } from "@/lib/types";

export { CARDIOS_RECENTES };
type Linha = LinhaSessaoCardio;
const conferirConta = (conta: string) => confirmarContaDoTreino(conta, "O login mudou. Reabra a atividade de cardio.");

function recortar(linhas: Linha[], chave: readonly string[], conta: string) {
  const [grupo, inicio, fim] = chave;
  if (grupo === "cardio-sessao") return linhas.filter(l => l.user_id === conta && l.id === inicio);
  const doPeriodo = linhas.filter(l => l.user_id === conta && l.data >= inicio! && (grupo === "cardio-desde" || l.data <= fim!))
    .sort((a, b) => b.data.localeCompare(a.data));
  return grupo === "cardio-desde" ? doPeriodo.slice(0, CARDIOS_RECENTES) : doPeriodo;
}

// O calendário pode ser a única tela visitada antes de perder a rede. Guarde cada
// período confirmado separadamente do histórico completo, sem esperar o debounce da tela.
const prefixoDoPeriodo = (conta: string) => "periodo-de-cardio:" + conta + ":";
const chaveDoRecorte = (conta: string, chave: readonly string[]) => chave[0] === "cardio"
  ? prefixoDoPeriodo(conta) + chave[1] + ":" + chave[2] : "resumo-de-cardio:" + conta + ":" + chave[1];

async function guardarRecorte(conta: string, chave: readonly string[], linhas: Linha[], inicio: number, sinal: AbortSignal) {
  if (!temIndexedDB() || chave[0] === "cardio-desde") return;
  const banco = bd(), id = chaveDoRecorte(conta, chave);
  await banco.transaction("rw", banco.cache, async () => {
    const anterior = await banco.cache.get(id);
    sinal.throwIfAborted();
    if (!anterior || anterior.atualizadoEm <= inicio) {
      await banco.cache.put({ chave: id, valor: linhas, atualizadoEm: inicio });
    }
  });
}

/** Recortes do calendário e o registro individual compartilham o histórico guardado pela própria conta. */
export async function lerCardioRegistrado(cliente: QueryClient, conta: string, chave: readonly string[], consultar: () => Promise<Linha[]>, sinal: AbortSignal): Promise<Linha[]> {
  await conferirConta(conta);
  sinal.throwIfAborted();
  const lerFila = () => escritasPendentes("cardio", conta).catch(() => []);
  const revisao = temIndexedDB() ? await revisaoDoCardio(conta).catch(() => undefined) : undefined;
  const mudou = async () => revisao !== undefined && revisao !== await revisaoDoCardio(conta).catch(() => revisao);
  if (navigator.onLine !== false) {
    try {
      const inicio = Date.now();
      const antes = await lerFila();
      const remotas = await consultar();
      if (!remotas.every(l => l.user_id === conta && typeof l.id === "string")) throw new Error("A atividade não corresponde à conta do treino.");
      const fila = [...antes, ...await lerFila()];
      await conferirConta(conta);
      sinal.throwIfAborted();
      await atualizarCardiosConciliados(conta, remotas, chave, revisao, sinal).catch(() => sinal.throwIfAborted());
      if (await mudou()) return lerCardioRegistrado(cliente, conta, chave, consultar, sinal);
      await guardarRecorte(conta, chave, remotas, inicio, sinal).catch(() => sinal.throwIfAborted());
      sinal.throwIfAborted();
      return recortar(aplicarPendentes(remotas, fila), chave, conta);
    } catch (erro) {
      sinal.throwIfAborted();
      if (!(erro instanceof FalhaDeRedeNaTabela)) throw erro;
    }
  }
  let linhas: Linha[] = [];
  let desde = 0;
  const aceitar = (valor: unknown, data: number, comDono: boolean) => {
    if (data < desde || Date.now() - data > VALIDADE_MS) return;
    const lista: Linha[] = Array.isArray(valor) ? valor : valor === null ? [] : [valor as Linha];
    if (!lista.every(l => l?.user_id === conta && typeof l.id === "string") || (!comDono && !lista.length)) return;
    linhas = lista;
    desde = data;
  };
  const copia = temIndexedDB() ? await bd().cache.get(chaveDaLista("cardio", conta)).catch(() => undefined) : undefined;
  if (copia && Array.isArray(copia.valor)) aceitar(copia.valor, copia.atualizadoEm, true);
  for (const consulta of [chave.slice(0, -1), chave]) {
    const daConta = consulta.length === chave.length;
    const memoria = cliente.getQueryState(consulta);
    if (memoria && memoria.data !== undefined) aceitar(memoria.data, memoria.dataUpdatedAt, daConta);
    const salva = temIndexedDB() ? await lerConsultaGuardadaComData(consulta).catch(() => undefined) : undefined;
    if (salva) aceitar(salva.valor, salva.atualizadoEm, daConta);
  }
  if (temIndexedDB() && chave[0] !== "cardio-desde") {
    const cache = bd().cache;
    const exata = await cache.get(chaveDoRecorte(conta, chave)).catch(() => undefined);
    if (exata) aceitar(exata.valor, exata.atualizadoEm, true);
    if (chave[0] === "cardio" && desde && (!exata || exata.atualizadoEm < desde)) {
      // No primeiro uso offline após atualizar, o mês pode vir apenas da consulta da versão anterior.
      await guardarRecorte(conta, chave, recortar(linhas, chave, conta), desde, sinal).catch(() => sinal.throwIfAborted());
    }
    if (chave[0] === "cardio-sessao") {
      const prefixo = prefixoDoPeriodo(conta);
      const periodos = await cache.where("chave").startsWith(prefixo).sortBy("atualizadoEm").catch(() => []);
      for (const periodo of periodos) {
        if (periodo.atualizadoEm < desde || !Array.isArray(periodo.valor)) continue;
        const [de, ate] = periodo.chave.slice(prefixo.length).split(":");
        const encontrada = periodo.valor.find(l => l?.id === chave[1] && l.user_id === conta);
        const conhecida = linhas.find(l => l.id === chave[1]);
        // Um mês pode atualizar o UUID ou confirmar que saiu do dia anteriormente conhecido.
        if (encontrada || (conhecida && de! <= conhecida.data && conhecida.data <= ate!)) {
          aceitar(encontrada ? [encontrada] : [], periodo.atualizadoEm, true);
        }
      }
    }
  }
  linhas = await aplicarAlteracoesDoCardio(conta, linhas, desde, ["cardio-todos", conta]);
  const resultado = recortar(aplicarPendentes(linhas, await lerFila(), true), chave, conta);
  await conferirConta(conta);
  sinal.throwIfAborted();
  return await mudou() ? lerCardioRegistrado(cliente, conta, chave, consultar, sinal) : resultado;
}

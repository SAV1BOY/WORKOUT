import type { QueryClient } from "@tanstack/react-query";
import { chaveDoHistorico, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import { bd, temIndexedDB, type ItemCache } from "@/lib/db";
import { lerConsultaGuardadaComData, VALIDADE_MS } from "@/lib/persistencia-query";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaSerie } from "@/lib/types";

export type UltimaSerie = Pick<LinhaSerie,
  "exercise_id" | "session_id" | "set_index" | "tipo" | "concluida" | "registrada_em" | "reps" | "carga_kg" | "tempo_s"
> & Partial<Pick<LinhaSerie, "id" | "user_id" | "ordem_ex" | "reps_lado2" | "tempo_s_lado2" | "passos" | "assistencia">>;

const COLUNAS = "id,user_id,exercise_id,session_id,ordem_ex,set_index,tipo,concluida,registrada_em,reps,reps_lado2,carga_kg,tempo_s,tempo_s_lado2,passos,assistencia";
const PAGINA = 120;

function pedir(conta: string, ids: string[], atual?: string, contar = false) {
  const consulta = clienteNavegador().from("session_sets").select(COLUNAS, contar ? { count: "exact" } : {})
    .eq("user_id", conta).in("exercise_id", ids).eq("tipo", "trabalho").eq("concluida", true);
  return atual ? consulta.neq("session_id", atual) : consulta;
}

async function pagina(consulta: ReturnType<typeof pedir>, conta: string, sinal: AbortSignal) {
  const { data, count, error, status } = await consulta.abortSignal(sinal);
  sinal.throwIfAborted();
  if (error) {
    const mensagem = `Não consegui carregar as séries do treino passado. ${error.message}`;
    throw status === 0 ? new FalhaDeRedeNaTabela(mensagem) : new Error(mensagem);
  }
  const linhas = (data ?? []) as UltimaSerie[];
  if (!linhas.every(l => l.user_id === conta && typeof l.id === "string")) throw new Error("As séries não correspondem à conta do treino.");
  return { linhas, count };
}

async function consultar(conta: string, ids: string[], atual: string | undefined, sinal: AbortSignal) {
  const anteriores = new Map<string, Set<string>>();
  const resultado: UltimaSerie[] = [];
  const segundaPorSessao = new Map<string, string[]>();
  async function localizar(pedidos: string[], ignorada: string | undefined, quantas: number) {
    let faltam = pedidos;
    // A cada página truncada os movimentos já encontrados saem da próxima busca.
    while (faltam.length) {
      const recentes = pedir(conta, faltam, ignorada, true).order("registrada_em", { ascending: false })
        .order("session_id", { ascending: false }).order("id", { ascending: false }).limit(PAGINA);
      const { linhas, count } = await pagina(recentes, conta, sinal);
      if (!linhas.length || (count === null ? linhas.length < PAGINA : linhas.length === count)) {
        resultado.push(...linhas);
        break;
      }
      const encontradas = new Map<string, Set<string>>();
      for (const l of linhas) {
        const sessoes = encontradas.get(l.exercise_id) ?? new Set<string>();
        if (sessoes.size < quantas) sessoes.add(l.session_id);
        encontradas.set(l.exercise_id, sessoes);
      }
      for (const [id, sessoes] of encontradas) {
        anteriores.set(id, new Set([...anteriores.get(id) ?? [], ...sessoes]));
        if (sessoes.size < quantas) {
          const primeira = [...sessoes][0]!;
          segundaPorSessao.set(primeira, [...segundaPorSessao.get(primeira) ?? [], id]);
        }
      }
      const restantes = faltam.filter(id => !encontradas.has(id));
      if (restantes.length === faltam.length) throw new Error("Não consegui identificar o exercício da sessão anterior.");
      faltam = restantes;
    }
  }
  // No preparo ainda não sabemos qual sessão vai abrir. Se for a mais recente,
  // a penúltima precisa estar completa para a primeira retomada sem rede.
  await localizar(ids, atual, atual ? 1 : 2);
  await Promise.all([...segundaPorSessao].map(([primeira, grupo]) => localizar(grupo, primeira, 1)));

  // Uma página truncada pode cortar várias sessões intercaladas. Complete todas
  // as sessões escolhidas por UUID, sem atribuir a última linha parcial à série de hoje.
  const movimentos = [...anteriores.keys()];
  for (let i = 0; i < movimentos.length; i += 30) {
    const grupo = movimentos.slice(i, i + 30);
    const sessoes = [...new Set(grupo.flatMap(id => [...anteriores.get(id)!]))];
    let cursor: string | undefined;
    let lidas = 0;
    let total: number | null = null;
    for (;;) {
      let consulta = pedir(conta, grupo, atual, cursor === undefined).in("session_id", sessoes).order("id").limit(1000);
      if (cursor) consulta = consulta.gt("id", cursor);
      const { linhas, count } = await pagina(consulta, conta, sinal);
      if (!linhas.length) break;
      resultado.push(...linhas.filter(l => anteriores.get(l.exercise_id)?.has(l.session_id)));
      lidas += linhas.length;
      if (cursor === undefined) total = count;
      if (lidas === total) break;
      const seguinte = linhas.at(-1)!.id!;
      if (seguinte === cursor) throw new Error("Não consegui completar as séries do treino passado.");
      cursor = seguinte;
    }
  }
  return resultado;
}

interface Copia { ignorada: string | null; linhas: UltimaSerie[] }
const chave = (conta: string, id: string, noPlayer: boolean) =>
  `series-anteriores-do-player:${conta}:${id}:${noPlayer ? "sessao" : "preparo"}`;

function copiaDoExercicio(item: ItemCache | undefined, conta: string, id: string, atual?: string): Copia | undefined {
  if (!item || Date.now() - item.atualizadoEm > VALIDADE_MS) return undefined;
  const copia = item.valor as Copia | null;
  if (!copia || (copia.ignorada !== null && copia.ignorada !== atual) || !Array.isArray(copia.linhas)) return undefined;
  return copia.linhas.every(l => l?.user_id === conta && l.exercise_id === id) ? copia : undefined;
}

async function guardar(conta: string, ids: string[], atual: string | undefined, linhas: UltimaSerie[], inicio: number, sinal: AbortSignal) {
  if (!temIndexedDB()) return;
  const banco = bd();
  const chaves = ids.map(id => chave(conta, id, Boolean(atual)));
  await banco.transaction("rw", banco.cache, async () => {
    const existentes = await banco.cache.bulkGet(chaves);
    sinal.throwIfAborted();
    const novas = ids.flatMap((id, i) => {
      if ((existentes[i]?.atualizadoEm ?? 0) > inicio) return [];
      return [{ chave: chaves[i]!, atualizadoEm: inicio,
        valor: { ignorada: atual ?? null, linhas: linhas.filter(l => l.exercise_id === id) } satisfies Copia }];
    });
    await banco.cache.bulkPut(novas);
  }).catch(() => { sinal.throwIfAborted(); }); // A quota não impede a leitura online.
}

async function consultaAntiga<T>(cliente: QueryClient, chave: readonly string[]) {
  const memoria = cliente.getQueryState<T>(chave);
  if (memoria?.data !== undefined && Date.now() - memoria.dataUpdatedAt <= VALIDADE_MS) {
    return { valor: memoria.data, atualizadoEm: memoria.dataUpdatedAt };
  }
  if (temIndexedDB()) {
    const guardada = await lerConsultaGuardadaComData<T>(chave).catch(() => undefined);
    if (guardada && Date.now() - guardada.atualizadoEm <= VALIDADE_MS) return guardada;
  }
}

async function doLegado(cliente: QueryClient, conta: string, ids: readonly string[], faltam: Set<string>) {
  // O #48 já guardava o arquivo completo do Relatório com posição, medidas dos lados e dono.
  const [antiga, arquivo] = await Promise.all([
    consultaAntiga<UltimaSerie[]>(cliente, ["ultimas-series", [...ids].sort().join(",")]),
    temIndexedDB() ? bd().cache.get(`series-do-historico-v2:${conta}`).catch(() => undefined) : undefined,
  ]);
  const completo: UltimaSerie[] | undefined = arquivo && Date.now() - arquivo.atualizadoEm <= VALIDADE_MS &&
    Array.isArray(arquivo.valor) && arquivo.valor.every(s => s?.user_id === conta)
    ? arquivo.valor.filter(s => faltam.has(s.exercise_id)) : undefined;
  // O recorte antigo de 120 não comprova que as séries de uma sessão estão todas presentes.
  if (!Array.isArray(antiga?.valor) || antiga.valor.length >= PAGINA ||
    (completo && arquivo!.atualizadoEm >= antiga.atualizadoEm)) {
    return { linhas: completo ?? [], atualizadoEm: arquivo?.atualizadoEm ?? 0 };
  }

  type Dono = { id: string; user_id?: string };
  const candidatas = antiga.valor.filter(s => s && faltam.has(s.exercise_id));
  const sessoes = new Set<string>((completo ?? []).map(s => s.session_id));
  const reconhecer = (lista: Dono[] | undefined) => {
    if (Array.isArray(lista)) for (const s of lista) if (s?.user_id === conta) sessoes.add(s.id);
  };
  reconhecer((await consultaAntiga<Dono[]>(cliente, ["sessoes"]))?.valor);
  if (candidatas.some(s => s.user_id === undefined && !sessoes.has(s.session_id))) {
    const disco = temIndexedDB() ? await bd().cache.get(chaveDoHistoricoNoDisco(conta)).catch(() => undefined) : undefined;
    if (disco && Date.now() - disco.atualizadoEm <= VALIDADE_MS) reconhecer(disco.valor as Dono[]);
    reconhecer((await consultaAntiga<Dono[]>(cliente, chaveDoHistorico(conta)))?.valor);
    reconhecer((await consultaAntiga<Dono[]>(cliente, ["progresso", "sessoes"]))?.valor);
  }
  const proprias = candidatas.filter(s => s.user_id === undefined ? sessoes.has(s.session_id) : s.user_id === conta);
  if (!completo) return { linhas: proprias, atualizadoEm: antiga.atualizadoEm };
  // Uma consulta curta mais nova pode ter outra sessão ou uma correção. Aproveite
  // posição/lados do arquivo somente se a identidade da mesma série for inequívoca.
  const exerciciosLidos = new Set(proprias.map(s => s.exercise_id));
  const enriquecer = (s: UltimaSerie) => {
    const iguais = completo.filter(c => c.exercise_id === s.exercise_id && c.session_id === s.session_id &&
      c.set_index === s.set_index && c.registrada_em === s.registrada_em &&
      c.reps === s.reps && c.tempo_s === s.tempo_s && c.carga_kg === s.carga_kg && c.concluida === s.concluida && c.tipo === s.tipo);
    return iguais.length === 1 ? { ...iguais[0], ...s } : s;
  };
  return { linhas: [...proprias.map(enriquecer), ...completo.filter(s => !exerciciosLidos.has(s.exercise_id))],
    atualizadoEm: Math.min(antiga.atualizadoEm, arquivo!.atualizadoEm) };
}

export async function lerSeriesDoTreinoPassado(
  cliente: QueryClient, conta: string, idsDaTela: readonly string[], atual: string | undefined, sinal: AbortSignal,
): Promise<UltimaSerie[]> {
  sinal.throwIfAborted();
  const inicio = Date.now();
  const ids = [...new Set(idsDaTela)];
  if (!conta || !ids.length) return [];
  if (typeof navigator === "undefined" || navigator.onLine !== false) {
    try {
      const linhas = await consultar(conta, ids, atual, sinal);
      await confirmarContaDoTreino(conta, "A conta do treino mudou. Reabra o player.");
      sinal.throwIfAborted();
      await guardar(conta, ids, atual, linhas, inicio, sinal);
      sinal.throwIfAborted();
      return linhas;
    } catch (erro) {
      sinal.throwIfAborted();
      if (!(erro instanceof FalhaDeRedeNaTabela)) throw erro;
    }
  }
  await confirmarContaDoTreino(conta, "A conta do treino mudou. Reabra o player.");
  const chaves = ids.flatMap(id => [chave(conta, id, false), chave(conta, id, true)]);
  const copias = temIndexedDB() ? await bd().cache.bulkGet(chaves).catch(() => []) : [];
  const faltam = new Set<string>();
  const linhas: UltimaSerie[] = [];
  for (const [i, id] of ids.entries()) {
    const candidatas = copias.slice(2 * i, 2 * i + 2).sort((a, b) => (b?.atualizadoEm ?? 0) - (a?.atualizadoEm ?? 0));
    const salva = candidatas.map(item => copiaDoExercicio(item, conta, id, atual)).find(Boolean);
    if (salva) linhas.push(...salva.linhas);
    else faltam.add(id);
  }
  if (faltam.size) {
    const legado = await doLegado(cliente, conta, idsDaTela, faltam);
    const verificadas = legado.linhas.map(l => ({ ...l, user_id: conta }));
    if (verificadas.length) {
      // Depois da primeira abertura o React Query pode descartar a chave do #48.
      // Preserve as linhas reconhecidas com a data da leitura que as originou.
      await guardar(conta, [...new Set(verificadas.map(l => l.exercise_id))], atual, verificadas, legado.atualizadoEm, sinal);
      linhas.push(...verificadas);
    }
  }
  sinal.throwIfAborted();
  return linhas.filter(l => l.session_id !== atual && l.tipo === "trabalho" && l.concluida);
}

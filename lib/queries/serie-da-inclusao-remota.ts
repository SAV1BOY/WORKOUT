import { replaceEqualDeep } from "@tanstack/react-query";
import { sessaoLocalComExercicioDesconhecido } from "@/lib/compatibilidade-da-sessao";
import { bd, lerCache } from "@/lib/db";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { bloquearDesfazerSeIniciado, serieLocalDaLinha, type SerieLocal, type SessaoLocal } from "@/lib/sessao";
import type { LinhaSerie } from "@/lib/types";
import { lerIdsDaSessaoProtegida } from "./compatibilidade-da-sessao";

interface SeriesDaInclusao {
  token: string;
  ordem: number;
  exercicio: string;
  originais: SerieLocal[];
}

function chave(conta: string, id: string) {
  return `series-da-inclusao-recebida:${encodeURIComponent(conta)}:${id}`;
}

/** Dentro da transação que de fato acrescentou o bloco recebido do outro aparelho. */
export async function guardarSeriesDaInclusaoRecebida(antes: SessaoLocal, nova: SessaoLocal): Promise<void> {
  const inc = nova.plano?.ultima_inclusao;
  if (antes.id !== nova.id || antes.userId !== nova.userId || nova.workoutId !== "livre" || nova.status !== "em_andamento" ||
      !inc || inc.estado === "desfeita" || inc.sessao_id !== nova.id || inc.ordem <= antes.blocos.length) return;
  const bloco = nova.blocos.find(b => b.ordem === inc.ordem);
  if (!bloco || bloco.originalId !== inc.exercicio_id) return;
  const originais = bloco.series.filter(s => !s.concluida && s.registradaEm === null);
  if (!originais.length) return;
  const valor: SeriesDaInclusao = { token: inc.id, ordem: bloco.ordem, exercicio: bloco.exercicioId, originais };
  await bd().cache.put({ chave: chave(nova.userId, nova.id), valor, atualizadoEm: Date.now() });
}

export async function haSeriesDaInclusaoRecebida(conta: string, id: string, token: string): Promise<boolean> {
  const origem = await lerCache<SeriesDaInclusao>(chave(conta, id));
  return origem?.token === token;
}

interface RegistroRecebido { anterior: SerieLocal; nova: SerieLocal }

/** Só troca um placeholder intocado. Os outros objetos do player, inclusive o relógio, mantêm a identidade. */
export function incorporarSeriesQueChegaram(
  sessao: SessaoLocal, token: string, ordem: number, exercicio: string, registros: RegistroRecebido[],
): SessaoLocal {
  const inc = sessao.plano?.ultima_inclusao;
  if (sessao.workoutId !== "livre" || sessao.status !== "em_andamento" || inc?.id !== token || inc.sessao_id !== sessao.id ||
      inc.estado === "desfeita" || inc.ordem !== ordem || !registros.length) return sessao;
  const bloco = sessao.blocos.find(b => b.ordem === ordem);
  if (bloco?.originalId !== inc.exercicio_id || bloco.exercicioId !== exercicio) return sessao;
  let mudou = false;
  const series = bloco.series.map(serie => {
    const registro = registros.find(r => r.anterior.id === serie.id);
    if (!registro || replaceEqualDeep(serie, registro.anterior) !== serie) return serie;
    // Se o timer/correção está neste UUID, substituir a chave deslocaria o passo atual.
    if (registro.nova.id !== serie.id && [sessao.player, sessao.player?.descansoAoCorrigir].some(p => p?.chave.includes(serie.id))) return serie;
    mudou = true;
    return registro.nova;
  });
  return mudou ? bloquearDesfazerSeIniciado({ ...sessao, blocos: sessao.blocos.map(b => b === bloco ? { ...bloco, series } : b) }) : sessao;
}

export async function guardarSeriesQueChegaram(
  conta: string, id: string, token: string, linhas: readonly LinhaSerie[], naTela: () => SessaoLocal | null | undefined,
) {
  const candidatas = linhas.filter(r => r.session_id === id && r.user_id === conta && r.concluida && r.registrada_em);
  if (!candidatas.length) return;
  const banco = bd();
  return banco.transaction("rw", banco.sessaoAtiva, banco.outbox, banco.cache, async () => {
    const origem = await lerCache<SeriesDaInclusao>(chave(conta, id));
    if (!origem || origem.token !== token || (await lerIdsDaSessaoProtegida(conta, id)).length) return;
    const local = (await banco.sessaoAtiva.get(id))?.dados as SessaoLocal | undefined;
    const tela = naTela();
    if (local?.id !== id || local.userId !== conta || tela?.id !== id || tela.userId !== conta ||
        sessaoLocalComExercicioDesconhecido(local) || sessaoLocalComExercicioDesconhecido(tela)) return;
    const pendentes = await banco.outbox.where("tipo").equals("serie").filter(item => item.alvo === `sessions:${id}`).toArray();
    const registros: RegistroRecebido[] = [];
    for (const anterior of origem.originais) {
      const mesmoSlot = (r: Record<string, unknown> | LinhaSerie) => r.ordem_ex === origem.ordem &&
        r.exercise_id === origem.exercicio && r.tipo === anterior.tipo && r.set_index === anterior.setIndex;
      const recebidas = candidatas.filter(mesmoSlot);
      if (recebidas.length !== 1) continue;
      const recebida = recebidas[0]!;
      if (pendentes.some(item => {
        const escrita = item.payload as EscritaTabela;
        return escrita.tabela === "session_sets" && [escrita.filtro, ...(escrita.linhas ?? [escrita.linha])].some(r =>
          r && (!r.user_id || r.user_id === conta) && (!r.session_id || r.session_id === id) &&
          (r.id === anterior.id || r.id === recebida.id || mesmoSlot(r)));
      })) continue;
      registros.push({ anterior, nova: serieLocalDaLinha(recebida) });
    }
    // O valor visível pode ter um toque que ainda não chegou ao debounce do IndexedDB.
    const visivel = incorporarSeriesQueChegaram(tela, token, origem.ordem, origem.exercicio, registros);
    if (visivel === tela) return;
    const aceitas = registros.filter(r => visivel.blocos.some(b => b.ordem === origem.ordem && b.series.includes(r.nova)));
    const salva = incorporarSeriesQueChegaram(local, token, origem.ordem, origem.exercicio, aceitas);
    if (salva === local) return;
    await banco.sessaoAtiva.put({ id, dados: salva, atualizadoEm: Date.now() });
    const gravadas = aceitas.filter(r => salva.blocos.some(b => b.ordem === origem.ordem && b.series.includes(r.nova)));
    const restantes = origem.originais.filter(s => !gravadas.some(r => r.anterior.id === s.id));
    if (restantes.length) {
      await banco.cache.put({ chave: chave(conta, id), valor: { ...origem, originais: restantes }, atualizadoEm: Date.now() });
    } else await banco.cache.delete(chave(conta, id));
    return { ordem: origem.ordem, exercicio: origem.exercicio, registros: gravadas };
  });
}

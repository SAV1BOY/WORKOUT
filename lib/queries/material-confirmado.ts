import { bd, lerCache, type ItemSaida } from "@/lib/db";
import { planoComExercicioDesconhecido, sessaoLocalComExercicioDesconhecido } from "@/lib/compatibilidade-da-sessao";
import { estadosPorExercicio } from "@/lib/hoje";
import { itensDoPlano } from "@/lib/livre";
import type { SessaoComMaterialConfirmado } from "@/lib/material-pendente";
import type { EquipamentoTag } from "@/lib/schemas";
import { reconstruirSessao, type SessaoLocal } from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaEstadoExercicio, LinhaSerie, PlanoDaSessao } from "@/lib/types";
import { confirmarCatalogoLido, lerIdsDaSessaoProtegida } from "./compatibilidade-da-sessao";
import { lerLista, lerTabelaCompleta } from "./ler";
import { confirmarContaDoTreino } from "./conta-do-treino";
import { planoAposArquivar } from "./plano-apos-arquivar";
import { guardarSeriesDaInclusaoRecebida } from "./serie-da-inclusao-remota";

interface MaterialConfirmado {
  revisao: string | null;
  revisaoBase: string | null;
  equipamento: EquipamentoTag[] | null;
  atualizadoEm: number;
  edicaoArquivada?: boolean;
}

function chaveDaConfirmacao(conta: string, id: string) {
  return `material-confirmado:${encodeURIComponent(conta)}:${id}`;
}

export async function lerMaterialConfirmado(conta: string, id: string): Promise<MaterialConfirmado | undefined> {
  return (await lerCache<MaterialConfirmado>(chaveDaConfirmacao(conta, id))) ?? undefined;
}

/** Só acrescenta posições que seguem exatamente os exercícios físicos já presentes. */
export function haInclusaoRemota(local: SessaoLocal, plano: PlanoDaSessao | null) {
  const inclusao = plano?.ultima_inclusao;
  if (local.workoutId !== "livre" || !inclusao || inclusao.sessao_id !== local.id || inclusao.estado === "desfeita" ||
    !Array.isArray(plano.itens) || plano.itens.length <= local.blocos.length || inclusao.ordem !== plano.itens.length ||
    plano.itens.at(-1)?.exercicio_id !== inclusao.exercicio_id) return false;
  const anterior = local.plano?.ultima_inclusao;
  if (anterior?.id === inclusao.id && anterior.estado === "desfeita") return false;
  return local.blocos.every((bloco, i) => plano.itens[i]?.exercicio_id === bloco.originalId &&
    plano.itens[i]?.inclusao_id === local.plano?.itens[i]?.inclusao_id);
}

type DadosDaInclusao = { series: LinhaSerie[]; estados: LinhaEstadoExercicio[] };

/** Conserva os objetos dos blocos já usados no aparelho, inclusive o toque ainda fora do servidor. */
export function incorporarMaterialConfirmado(
  local: SessaoLocal, remota: SessaoComMaterialConfirmado, manterMaterialLocal: boolean, dados?: DadosDaInclusao,
): SessaoLocal {
  if (local.userId !== remota.user_id || local.id !== remota.id || local.status !== "em_andamento" ||
    remota.status !== "em_andamento" || sessaoLocalComExercicioDesconhecido(local) ||
    planoComExercicioDesconhecido(remota.plano)) return local;
  let blocos = local.blocos;
  let plano = local.plano;
  const recebido = remota.plano;
  if (dados && recebido && haInclusaoRemota(local, recebido)) {
    const itens = itensDoPlano(recebido);
    if (itens?.length !== recebido.itens.length) return local;
    const estados = dados.estados.filter(e => e.user_id === local.userId);
    const series = dados.series.filter(s => s.session_id === local.id && s.user_id === local.userId);
    const reconstruida = reconstruirSessao({
      id: local.id, user_id: local.userId, data: local.data, workout_id: local.workoutId, fase: local.fase,
      status: local.status, iniciada_em: local.iniciadaEm, plano: recebido,
    }, series, { itens, opcoesMontagem: local.opcoesMontagem, estados: estadosPorExercicio(estados) });
    if (reconstruida) {
      const anteriores = blocos.length;
      blocos = [...blocos, ...reconstruida.blocos.slice(anteriores)];
      const itensLocais = plano?.itens.length === anteriores ? plano.itens : recebido.itens.slice(0, anteriores);
      plano = { ...recebido, ...plano, itens: [...itensLocais, ...recebido.itens.slice(anteriores)], ultima_inclusao: recebido.ultima_inclusao };
      // As notas, trocas e descansos das posições já abertas pertencem à cópia que a pessoa está editando.
      for (const bloco of blocos.slice(anteriores)) {
        const troca = recebido.trocas?.[bloco.ordem];
        if (troca) plano.trocas = { ...plano.trocas, [bloco.ordem]: troca };
        for (const registro of [bloco, ...(bloco.trocados ?? [])]) {
          const descanso = recebido.descansos_por_exercicio?.[registro.exercicioId];
          if (descanso !== undefined) plano.descansos_por_exercicio = { ...plano.descansos_por_exercicio, [registro.exercicioId]: descanso };
        }
      }
    }
  }
  const material = (manterMaterialLocal ? local.plano : recebido)?.equipamento_disponivel;
  if (JSON.stringify(plano?.equipamento_disponivel) !== JSON.stringify(material)) {
    const base = plano ?? recebido;
    if (base) {
      plano = { ...base };
      if (material) plano.equipamento_disponivel = material;
      else delete plano.equipamento_disponivel;
    }
  }
  const revisaoEquipamento = manterMaterialLocal ? local.revisaoEquipamento : remota.revisao_equipamento;
  return plano === local.plano && blocos === local.blocos && revisaoEquipamento === local.revisaoEquipamento
    ? local : { ...local, blocos, plano, revisaoEquipamento };
}

async function dadosDaInclusao(local: SessaoLocal | undefined, remota: SessaoComMaterialConfirmado, planoCompleto: boolean): Promise<DadosDaInclusao | undefined> {
  const plano = remota.plano;
  if (!local || local.userId !== remota.user_id || (!planoCompleto && !haInclusaoRemota(local, plano)) || planoComExercicioDesconhecido(plano)) return;
  const inicio = planoCompleto ? 0 : local.blocos.length;
  const novosIds = plano?.itens.slice(inicio).flatMap((item, i) =>
    [item.exercicio_id, ...(plano.trocas?.[inicio + i + 1] ?? []).map(t => t.exercicio_id)]) ?? local.blocos.map(b => b.exercicioId);
  const [series, estados] = await Promise.all([
    lerTabelaCompleta<LinhaSerie>("session_sets", "*", "as séries deste treino", remota.user_id, undefined, remota.id),
    lerLista<LinhaEstadoExercicio>(clienteNavegador().from("exercise_state").select("*")
      .eq("user_id", remota.user_id).in("exercise_id", [...new Set(novosIds)]), "as cargas dos exercícios acrescentados"),
  ]);
  return { series, estados };
}

interface DadosDaSaida {
  filtro?: { id?: string; user_id?: string };
  equipamentoDaSessao?: { revisaoBase: string | null };
  conciliacaoDeMaterial?: { remota?: SessaoComMaterialConfirmado; escolha?: string; original?: { linha?: { plano?: PlanoDaSessao | null } } };
  linha?: { plano?: PlanoDaSessao | null };
}

type ConfirmarArquivo = (original: SessaoLocal | undefined) => Promise<void>;

async function guardarConfirmacao(
  conta: string, remota: SessaoComMaterialConfirmado, item?: ItemSaida, leitura?: { base: SessaoLocal; sinal: AbortSignal }, confirmarArquivo?: ConfirmarArquivo,
) {
  const alvo = `sessions:${remota.id}`;
  if (remota.user_id !== conta || (item && item.alvo !== alvo)) throw new Error("Aguardando a conta que alterou o treino.");
  if (remota.status !== "em_andamento" && !confirmarArquivo) return;
  const banco = bd();
  const inicial = (await banco.sessaoAtiva.get(remota.id))?.dados as SessaoLocal | undefined;
  const dados = remota.status === "em_andamento" ? await dadosDaInclusao(inicial, remota, !!confirmarArquivo) : undefined;
  if (leitura?.sinal.aborted) return;
  await confirmarContaDoTreino(conta, "Aguardando a conta que alterou o treino.");
  await confirmarCatalogoLido(conta, remota.id, remota.plano, dados?.series);

  await banco.transaction("rw", banco.cache, banco.sessaoAtiva, banco.outbox, async () => {
    const salvo = (await banco.sessaoAtiva.get(remota.id))?.dados as SessaoLocal | undefined;
    if (leitura && (leitura.sinal.aborted || !salvo || salvo.userId !== conta || salvo.status !== "em_andamento" ||
      salvo.revisaoEquipamento !== leitura.base.revisaoEquipamento ||
      salvo.plano?.ultima_inclusao?.id !== leitura.base.plano?.ultima_inclusao?.id)) return;
    const posterior = await banco.outbox.where("tipo").equals("sessao").filter(outro => {
      if (outro.alvo !== alvo || (item?.id !== undefined && (outro.id ?? 0) <= item.id)) return false;
      const p = outro.payload as DadosDaSaida | null;
      return p?.filtro?.user_id === conta && !!(p.equipamentoDaSessao || p.conciliacaoDeMaterial || p.linha?.plano);
    }).first();
    if (leitura && posterior) return;
    const escrita = item?.payload as DadosDaSaida | undefined;
    await confirmarArquivo?.(salvo?.userId === conta ? salvo : undefined);
    if (remota.status !== "em_andamento") return;
    const anterior = await lerMaterialConfirmado(conta, remota.id);
    const atualizadoEm = Math.max(Date.now(), (anterior?.atualizadoEm ?? 0) + 1);
    const valor: MaterialConfirmado = {
      revisao: remota.revisao_equipamento, equipamento: remota.plano?.equipamento_disponivel ?? null, atualizadoEm,
      ...(confirmarArquivo && { edicaoArquivada: true }),
      revisaoBase: escrita?.equipamentoDaSessao?.revisaoBase ?? escrita?.conciliacaoDeMaterial?.remota?.revisao_equipamento ?? leitura?.base.revisaoEquipamento ?? null,
    };
    await banco.cache.put({ chave: chaveDaConfirmacao(conta, remota.id), valor, atualizadoEm });
    if (!salvo || salvo.userId !== conta || salvo.status !== "em_andamento" || (await lerIdsDaSessaoProtegida(conta, remota.id)).length) return;
    let base = salvo;
    const conflito = escrita?.conciliacaoDeMaterial;
    if (confirmarArquivo && dados && !sessaoLocalComExercicioDesconhecido(salvo) && !planoComExercicioDesconhecido(remota.plano)) {
      // A transação de arquivamento já retirou as séries que perderam a posição.
      const restantes = await banco.outbox.where("tipo").equals("serie").filter(saida => saida.alvo === alvo).toArray();
      const series = restantes.flatMap(saida => {
        const p = saida.payload as { tabela?: string; linha?: LinhaSerie };
        return p.tabela === "session_sets" && p.linha?.session_id === salvo.id && p.linha.user_id === conta ? [p.linha] : [];
      });
      base = planoAposArquivar(salvo, conflito?.original?.linha?.plano ?? salvo.plano, remota.plano, dados, series);
    }
    const nova = incorporarMaterialConfirmado(base, remota, !!posterior, dados);
    if (nova !== salvo) {
      if (haInclusaoRemota(salvo, nova.plano)) await guardarSeriesDaInclusaoRecebida(salvo, nova);
      await banco.sessaoAtiva.put({ id: nova.id, dados: nova, atualizadoEm });
    }
  });
}

/** Recebe o plano enquanto o comando ainda ocupa seu lugar na fila. */
export function guardarMaterialConfirmadoNoAparelho(conta: string, remota: SessaoComMaterialConfirmado, item: ItemSaida, confirmarArquivo?: ConfirmarArquivo) {
  return guardarConfirmacao(conta, remota, item, undefined, confirmarArquivo);
}

/** Uma leitura que começou antes da última edição pode terminar depois da confirmação. */
export async function conferirMudancaDeOutroAparelho(base: SessaoLocal, sinal: AbortSignal) {
  const { data, error } = await clienteNavegador().from("sessions").select("id,user_id,status,plano,revisao_equipamento")
    .eq("id", base.id).eq("user_id", base.userId).eq("status", "em_andamento").abortSignal(sinal).maybeSingle();
  if (error) throw new Error(error.message);
  if (sinal.aborted || !data || data.id !== base.id || data.user_id !== base.userId) return;
  const remota = data as SessaoComMaterialConfirmado;
  if (!haInclusaoRemota(base, remota.plano) && (base.revisaoEquipamento ?? null) === remota.revisao_equipamento) return;
  await guardarConfirmacao(base.userId, remota, undefined, { base, sinal });
}

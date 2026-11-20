import { replaceEqualDeep } from "@tanstack/react-query";
import { sessaoLocalComExercicioDesconhecido } from "@/lib/compatibilidade-da-sessao";
import { bd, lerCache } from "@/lib/db";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { bloquearDesfazerSeIniciado, MAX_SERIES_DA_SESSAO, serieLocalDaLinha, type SerieLocal, type SessaoLocal } from "@/lib/sessao";
import type { LinhaSerie } from "@/lib/types";
import { lerIdsDaSessaoProtegida } from "./compatibilidade-da-sessao";

interface SeriesDaInclusao {
  token: string;
  ordem: number;
  exercicio: string;
  originais: SerieLocal[];
  incorporadas?: RegistroRecebido[];
  semVaga?: SerieLocal[];
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
  return origem?.token === token && origem.originais.length > 0;
}

interface RegistroRecebido {
  anterior: SerieLocal;
  nova: SerieLocal;
  livres: SerieLocal[];
  ultimoIndice: number;
  rascunho?: SerieLocal;
}

export function rascunhoDoRegistro(serie: SerieLocal | undefined, r: RegistroRecebido) {
  if (serie?.id === r.anterior.id && serie.tipo === "trabalho" && serie.setIndex === r.anterior.setIndex &&
      !serie.concluida && !serie.registradaEm && replaceEqualDeep(serie, r.anterior) !== serie) return serie;
}

function rascunhoNoPasso(sessao: SessaoLocal, serie: SerieLocal | undefined, r: RegistroRecebido) {
  return rascunhoDoRegistro(serie, r) ?? (serie && !serie.concluida && !serie.registradaEm && serie.tipo === "trabalho" &&
    sessao.player?.chave === `serie:${r.anterior.id}` ? serie : undefined);
}

/** Uma posição só recebe o rascunho se continua exatamente como chegou ao aparelho. */
export function incorporarSeriesQueChegaram(
  sessao: SessaoLocal, token: string, ordem: number, exercicio: string, registros: RegistroRecebido[],
): SessaoLocal {
  const inc = sessao.plano?.ultima_inclusao;
  if (sessao.workoutId !== "livre" || sessao.status !== "em_andamento" || inc?.id !== token || inc.sessao_id !== sessao.id ||
      inc.estado === "desfeita" || inc.ordem !== ordem || !registros.length) return sessao;
  const bloco = sessao.blocos.find(b => b.ordem === ordem);
  if (bloco?.originalId !== inc.exercicio_id || bloco.exercicioId !== exercicio) return sessao;
  const series = bloco.series.slice();
  let player = sessao.player;
  const noPlayer = (id: string) => [sessao.player, sessao.player?.descansoAoCorrigir].some(p => p?.chave.includes(id));
  let mudou = false;
  for (const r of registros) {
    const i = series.findIndex(s => s.id === r.anterior.id);
    const anterior = series[i];
    const rascunho = rascunhoNoPasso(sessao, anterior, r) ?? r.rascunho;
    if (anterior) {
      if (anterior.setIndex !== r.anterior.setIndex || (!rascunho && (replaceEqualDeep(anterior, r.anterior) !== anterior || noPlayer(anterior.id)))) continue;
      // Um registro confirmado ou corrigido aqui não é mais a sugestão recebida na inclusão.
      if (anterior.concluida || anterior.registradaEm) continue;
      series[i] = r.nova;
      mudou = true;
    } else if (!rascunho || !series.some(s => s.id === r.nova.id && replaceEqualDeep(s, r.nova) === s)) continue;
    if (!rascunho) continue;
    const livre = (s: SerieLocal) => s.tipo === "trabalho" && !noPlayer(s.id) &&
      r.livres.some(padrao => padrao.id === s.id && replaceEqualDeep(padrao, s) === padrao);
    const seguinte = series.findIndex(s => s.setIndex > r.anterior.setIndex && livre(s));
    const destino = seguinte >= 0 ? seguinte : series.findIndex(livre);
    if (destino >= 0) {
      series[destino] = { ...rascunho, setIndex: series[destino]!.setIndex };
      mudou = true;
    } else {
      const indice = Math.max(r.ultimoIndice, ...series.filter(s => s.tipo === "trabalho").map(s => s.setIndex)) + 1;
      if (indice <= MAX_SERIES_DA_SESSAO) {
        series.push({ ...rascunho, setIndex: indice });
        mudou = true;
      } else if (player && noPlayer(r.anterior.id)) {
        const descanso = player.descansoAoCorrigir;
        player = { ...player, chave: player.chave.replace(r.anterior.id, r.nova.id),
          ...(descanso && { descansoAoCorrigir: { ...descanso, chave: descanso.chave.replace(r.anterior.id, r.nova.id) } }) };
      }
    }
  }
  if (!mudou) return sessao;
  const prescricao = series.length === bloco.series.length ? bloco.prescricao : { ...bloco.prescricao, series: series.filter(s => s.tipo === "trabalho").length };
  return bloquearDesfazerSeIniciado({ ...sessao, player, blocos: sessao.blocos.map(b => b === bloco ? { ...b, prescricao, series } : b) });
}

function rascunhosSemVaga(bloco: SessaoLocal["blocos"][number], registros: RegistroRecebido[]) {
  return registros.flatMap(r => r.rascunho && !bloco.series.some(s => s.id === r.rascunho!.id) ? [r.rascunho] : []);
}

function acompanharRascunhosMovidos(originais: SerieLocal[], series: SerieLocal[], registros: RegistroRecebido[]) {
  const pendentes = originais.slice();
  for (const r of registros) {
    const movida = series.find(s => s.id === r.anterior.id && s.setIndex !== r.anterior.setIndex);
    if (!movida) continue;
    const i = pendentes.findIndex(s => s.tipo === movida.tipo && s.setIndex === movida.setIndex);
    // Outra série do mesmo aparelho também pode chegar depois. Guardamos a sugestão anterior à digitação.
    const sugestao = { ...(pendentes[i] ?? r.anterior), id: movida.id, setIndex: movida.setIndex };
    if (i < 0) pendentes.push(sugestao);
    else pendentes[i] = sugestao;
  }
  return pendentes;
}

function guardarOrigem(conta: string, id: string, origem: SeriesDaInclusao, semVaga: SerieLocal[]) {
  const resgates = [...(origem.semVaga ?? []).filter(s => !semVaga.some(r => r.id === s.id)), ...semVaga];
  return bd().cache.put({ chave: chave(conta, id), atualizadoEm: Date.now(), valor: { ...origem, semVaga: resgates } });
}

export function avisoSemVaga(serie: SerieLocal): string {
  const campos = [
    serie.reps !== null && `${serie.reps} repetições`, serie.repsLado2 !== null && `${serie.repsLado2} do outro lado`,
    serie.tempoS !== null && `${serie.tempoS} s`, serie.tempoSLado2 !== null && `${serie.tempoSLado2} s do outro lado`,
    serie.passos !== null && `${serie.passos} passos`, serie.cargaKg !== null && `${serie.cargaKg} kg`, serie.assistencia,
  ].filter(Boolean);
  return `A série ${serie.setIndex} foi registrada em outro aparelho. As 10 séries estão ocupadas. Seu ajuste está salvo neste aparelho (${campos.join(", ")}). Use esses valores ao corrigir uma série na Visão geral.`;
}

export async function avisoGuardadoDaInclusao(conta: string, id: string, token: string) {
  const origem = await lerCache<SeriesDaInclusao>(chave(conta, id));
  return origem?.token === token ? origem.semVaga?.map(avisoSemVaga).join(" ") || null : null;
}

/** O toque pode chegar entre o commit da série recebida e a atualização do campo na tela. */
export async function conservarRascunhoDaInclusao(salva: SessaoLocal, antes: SessaoLocal, editada: SessaoLocal): Promise<SessaoLocal> {
  const inc = salva.plano?.ultima_inclusao;
  if (!inc || inc.id !== antes.plano?.ultima_inclusao?.id || inc.id !== editada.plano?.ultima_inclusao?.id ||
      salva.id !== antes.id || salva.userId !== antes.userId || salva.id !== editada.id || salva.userId !== editada.userId) return salva;
  const base = antes.blocos.find(b => b.ordem === inc.ordem);
  const tela = editada.blocos.find(b => b.ordem === inc.ordem);
  const disco = salva.blocos.find(b => b.ordem === inc.ordem);
  if (!base || !tela || !disco || (base.series === tela.series && antes.player?.chave === editada.player?.chave) ||
      base.exercicioId !== tela.exercicioId || base.exercicioId !== disco.exercicioId) return salva;
  if (!tela.series.some(s => !s.concluida && !disco.series.some(d => d.id === s.id))) return salva;
  const origem = await lerCache<SeriesDaInclusao>(chave(salva.userId, salva.id));
  if (origem?.token !== inc.id || !origem.incorporadas?.length) return salva;
  const registros = origem.incorporadas.flatMap(r => {
    const rascunho = rascunhoNoPasso(editada, tela.series.find(s => s.id === r.anterior.id), r);
    return rascunho && base.series.some(s => s.id === r.anterior.id) ? [{ ...r, rascunho }] : [];
  });
  const nova = incorporarSeriesQueChegaram(salva, inc.id, inc.ordem, origem.exercicio, registros);
  const atualizado = nova.blocos.find(b => b.ordem === inc.ordem)!;
  const semVaga = rascunhosSemVaga(atualizado, registros);
  if (nova !== salva || semVaga.length) {
    const originais = acompanharRascunhosMovidos(origem.originais, atualizado.series, registros);
    await guardarOrigem(salva.userId, salva.id, { ...origem, originais }, semVaga);
  }
  return nova;
}

export async function guardarSeriesQueChegaram(
  conta: string, id: string, token: string, linhas: readonly LinhaSerie[], naTela: () => SessaoLocal | null | undefined,
) {
  const candidatas = linhas.filter(r => r.session_id === id && r.user_id === conta && r.concluida && r.registrada_em);
  if (!candidatas.length) return;
  const banco = bd();
  return banco.transaction("rw", banco.sessaoAtiva, banco.outbox, banco.cache, async () => {
    const origem = await lerCache<SeriesDaInclusao>(chave(conta, id));
    if (!origem?.originais.length || origem.token !== token || (await lerIdsDaSessaoProtegida(conta, id)).length) return;
    const local = (await banco.sessaoAtiva.get(id))?.dados as SessaoLocal | undefined;
    if (local?.id !== id || local.userId !== conta || sessaoLocalComExercicioDesconhecido(local)) return;
    const pendentes = await banco.outbox.where("tipo").equals("serie").filter(item => item.alvo === `sessions:${id}`).toArray();
    const registros: RegistroRecebido[] = [];
    const livres: SerieLocal[] = [];
    for (const anterior of origem.originais) {
      const mesmoSlot = (r: Record<string, unknown> | LinhaSerie) => r.ordem_ex === origem.ordem &&
        r.exercise_id === origem.exercicio && r.tipo === anterior.tipo && r.set_index === anterior.setIndex;
      const recebidas = candidatas.filter(mesmoSlot);
      if (pendentes.some(item => {
        const escrita = item.payload as EscritaTabela;
        return escrita.tabela === "session_sets" && [escrita.filtro, ...(escrita.linhas ?? [escrita.linha])].some(r =>
          r && (!r.user_id || r.user_id === conta) && (!r.session_id || r.session_id === id) &&
          (r.id === anterior.id || recebidas.some(s => s.id === r.id) || mesmoSlot(r)));
      })) continue;
      if (!recebidas.length) livres.push(anterior);
      else if (recebidas.length === 1) registros.push({ anterior, nova: serieLocalDaLinha(recebidas[0]!), livres, ultimoIndice: 0 });
    }
    const tela = naTela();
    if (tela?.id !== id || tela.userId !== conta || sessaoLocalComExercicioDesconhecido(tela)) return;
    const posicoes = [tela, local].map(s => s.blocos.find(b => b.ordem === origem.ordem)?.series ?? []);
    const livresNasDuas = livres.filter(s => posicoes.every(series => series.some(t => t.id === s.id && replaceEqualDeep(s, t) === s)) &&
      [tela, local].every(copia => ![copia.player, copia.player?.descansoAoCorrigir].some(p => p?.chave.includes(s.id))));
    const ultimoIndice = Math.max(0, ...posicoes.flat().filter(s => s.tipo === "trabalho").map(s => s.setIndex));
    for (const r of registros) {
      const naPosicao = (s: SessaoLocal) => s.blocos.find(b => b.ordem === origem.ordem)?.series.find(s => s.id === r.anterior.id);
      r.rascunho = rascunhoNoPasso(tela, naPosicao(tela), r) ?? rascunhoNoPasso(local, naPosicao(local), r);
      r.livres = livresNasDuas;
      r.ultimoIndice = ultimoIndice;
    }
    const visivel = incorporarSeriesQueChegaram(tela, token, origem.ordem, origem.exercicio, registros);
    if (visivel === tela) return;
    const aceitas = registros.filter(r => visivel.blocos.some(b => b.ordem === origem.ordem && b.series.includes(r.nova)));
    const salva = incorporarSeriesQueChegaram(local, token, origem.ordem, origem.exercicio, aceitas);
    if (salva === local) return;
    await banco.sessaoAtiva.put({ id, dados: salva, atualizadoEm: Date.now() });
    const gravadas = aceitas.filter(r => salva.blocos.some(b => b.ordem === origem.ordem && b.series.includes(r.nova)));
    const restantes = origem.originais.filter(s => !gravadas.some(r => r.anterior.id === s.id));
    const bloco = salva.blocos.find(b => b.ordem === origem.ordem)!;
    await guardarOrigem(conta, id, {
      ...origem, originais: acompanharRascunhosMovidos(restantes, bloco.series, gravadas),
      incorporadas: [...(origem.incorporadas ?? []), ...gravadas.map(r => ({ ...r, rascunho: undefined }))],
    }, rascunhosSemVaga(bloco, gravadas));
    return { ordem: origem.ordem, exercicio: origem.exercicio, registros: gravadas };
  });
}

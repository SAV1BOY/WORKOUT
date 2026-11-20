import { exercicioPorId } from "@/lib/dados";
import { formatarKg, formatarNumero, rotuloDaCarga } from "@/lib/formato";
import { ehSessaoLivre } from "@/lib/livre";
import { ordensDeExecucao } from "@/lib/ordem-da-sessao";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import type { Exercicio } from "@/lib/schemas";
import { nomeDaAssistencia, rotulosDaSerie } from "@/lib/sessao";

export interface GrupoDeSeriesDoTreino {
  chave: string;
  ordem: number | null;
  posicaoAmbigua: boolean;
  exercicioId: string;
  nome: string;
  series: { chave: string; rotulo: string; valores: string }[];
}

function indiceValido(valor: number | undefined): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0;
}

/** O cache antigo guardava o movimento, mas não a posição que ocupava no treino. */
function ordensConhecidas(sessao: SessaoBruta, series: readonly SerieBruta[]) {
  const ordens = new Map<string, number | null>();
  function associar(id: string | undefined, ordem: number | undefined) {
    if (!id || !indiceValido(ordem)) return;
    const anterior = ordens.get(id);
    // O mesmo movimento em dois blocos não identifica a posição de uma série legada.
    ordens.set(id, anterior === undefined || anterior === ordem ? ordem : null);
  }
  const plano = sessao.plano;
  if (Array.isArray(plano?.itens)) {
    plano.itens.forEach((item, i) => associar(item?.exercicio_id, i + 1));
    for (const [posicao, trocas] of Object.entries(plano.trocas ?? {})) {
      const ordem = Number(posicao);
      if (Array.isArray(trocas) && ordem <= plano.itens.length) {
        for (const troca of trocas) associar(troca?.exercicio_id, ordem);
      }
    }
  }
  // Uma linha posicionada pode revelar ambiguidade no plano. Sozinha não prova
  // que outra linha sem posição pertence ao mesmo bloco.
  for (const s of series) {
    if (ordens.has(s.exercise_id)) associar(s.exercise_id, s.ordem_ex);
  }
  return ordens;
}

function textoDaMedida(valor: number, singular: string, plural: string) {
  return `${formatarNumero(valor)} ${valor === 1 ? singular : plural}`;
}

// As leituras antigas do player não guardavam o segundo lado, os passos ou a assistência.
type MedidasRegistradas = Pick<SerieBruta, "exercise_id" | "reps" | "carga_kg" | "tempo_s"> &
  Partial<Pick<SerieBruta, "reps_lado2" | "tempo_s_lado2" | "passos" | "assistencia">> & { tipo: string };

function medidaRegistrada(valor: number | null | undefined): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function medidasPorLado(
  direito: number | null, esquerdo: number | null | undefined, unilateral: boolean, singular: string, plural: string,
): string[] {
  const lados: string[] = [];
  if (medidaRegistrada(direito)) {
    lados.push(textoDaMedida(direito, singular, plural) + (unilateral || medidaRegistrada(esquerdo) ? " à direita" : ""));
  }
  if (medidaRegistrada(esquerdo)) lados.push(`${textoDaMedida(esquerdo, singular, plural)} à esquerda`);
  return lados;
}

function cargaDaSerie(carga: number, exercicio: Exercicio | undefined): string {
  const kg = formatarKg(carga);
  if (!exercicio) return kg;
  const rotulo = rotuloDaCarga(exercicio.implemento);
  return rotulo === "peso do corpo" ? `${kg} de carga adicional` : `${kg} ${rotulo}`;
}

/** As medidas vêm da série registrada. O catálogo fornece a convenção da carga e dos lados. */
export function valoresDaSerieRegistrada(
  serie: MedidasRegistradas,
  exercicio = exercicioPorId.get(serie.exercise_id),
  prescricaoUnilateral = exercicio?.prescricao_padrao.unilateral ?? false,
): string {
  const unilateral = serie.tipo === "trabalho" && prescricaoUnilateral;
  const valores = [
    ...medidasPorLado(serie.reps, serie.reps_lado2, unilateral, "repetição", "repetições"),
    ...medidasPorLado(serie.tempo_s, serie.tempo_s_lado2, unilateral, "s", "s"),
  ];
  if (medidaRegistrada(serie.passos)) valores.push(textoDaMedida(serie.passos, "passo", "passos"));
  if (medidaRegistrada(serie.carga_kg)) {
    valores.push(cargaDaSerie(serie.carga_kg, exercicio));
  } else if (exercicio?.progressao.tipo === "carga") {
    valores.push("carga não registrada");
  }
  if (serie.assistencia) {
    const apoio = nomeDaAssistencia(serie.assistencia);
    valores.push(serie.assistencia === "sem" ? apoio : `elástico no ${apoio}`);
  }
  return valores.join(" · ") || "Sem valores registrados";
}

/** No player, uma série simples continua cabendo ao lado do botão Montagem. */
export function valoresDaSerieAnterior(serie: MedidasRegistradas): string {
  const exercicio = exercicioPorId.get(serie.exercise_id);
  const reps = serie.reps;
  const soRepeticoes = medidaRegistrada(reps) && !exercicio?.prescricao_padrao.unilateral &&
    serie.reps_lado2 == null && serie.tempo_s == null && serie.tempo_s_lado2 == null &&
    serie.passos == null && serie.assistencia == null;
  if (!soRepeticoes) return valoresDaSerieRegistrada(serie, exercicio);
  const carga = medidaRegistrada(serie.carga_kg) ? cargaDaSerie(serie.carga_kg, exercicio) + " " : "";
  return `${carga}× ${formatarNumero(reps)}`;
}

function instante(serie: SerieBruta) {
  const data = Date.parse(serie.registrada_em);
  return Number.isFinite(data) ? data : Infinity;
}

function movimentoOriginal(sessao: SessaoBruta, ordem: number | null, id: string) {
  return ordem !== null && sessao.plano?.itens?.[ordem - 1]?.exercicio_id === id;
}

/** Mostra cada série do exercício que a pessoa efetivamente fez naquela posição, inclusive após uma troca. */
export function detalharSeriesDoTreino(
  sessao: SessaoBruta, series: readonly SerieBruta[], conta: string,
): GrupoDeSeriesDoTreino[] {
  if (!conta || sessao.status !== "concluida" || (sessao.user_id !== undefined && sessao.user_id !== conta)) return [];
  const feitas = series.filter(s => s.concluida === true && s.session_id === sessao.id &&
    (s.user_id === undefined || s.user_id === conta));
  const ordens = ordensConhecidas(sessao, feitas);
  const grupos = new Map<string, { ordem: number | null; exercicioId: string; primeiroRegistro: number; linhas: SerieBruta[] }>();
  for (const s of feitas) {
    const ordem = indiceValido(s.ordem_ex) ? s.ordem_ex : ordens.get(s.exercise_id) ?? null;
    const chave = `${ordem ?? "?"}:${s.exercise_id}`;
    const existente = grupos.get(chave);
    if (existente) {
      existente.linhas.push(s);
      existente.primeiroRegistro = Math.min(existente.primeiroRegistro, instante(s));
    } else {
      grupos.set(chave, { ordem, exercicioId: s.exercise_id, primeiroRegistro: instante(s), linhas: [s] });
    }
  }
  const sequencia = ehSessaoLivre(sessao.workout_id) ? ordensDeExecucao(sessao.plano, sessao.ordem_execucao) : [];
  const posicoes = new Map(sequencia.map((ordem, i) => [ordem, i + 1]));
  const posicaoNoPlano = (ordem: number | null) => ordem === null ? Infinity : posicoes.get(ordem) ?? ordem;
  return [...grupos.entries()].sort(([, a], [, b]) => posicaoNoPlano(a.ordem) - posicaoNoPlano(b.ordem) ||
    a.primeiroRegistro - b.primeiroRegistro ||
    Number(movimentoOriginal(sessao, b.ordem, b.exercicioId)) - Number(movimentoOriginal(sessao, a.ordem, a.exercicioId)) ||
    a.exercicioId.localeCompare(b.exercicioId))
    .map(([chave, { ordem, exercicioId, linhas }]) => {
      const exercicio = exercicioPorId.get(exercicioId);
      const nome = exercicio?.nome ?? (exercicioId || "Exercício desconhecido");
      const item = ordem !== null ? sessao.plano?.itens?.[ordem - 1] : undefined;
      const unilateral = (item?.exercicio_id === exercicioId ? item.unilateral : undefined) ??
        exercicio?.prescricao_padrao.unilateral ?? false;
      linhas.sort((a, b) => Number(b.tipo === "aquecimento") - Number(a.tipo === "aquecimento") ||
        a.set_index - b.set_index || instante(a) - instante(b) || (a.id ?? "").localeCompare(b.id ?? ""));
      // Sem posição, duas "Série 1" não podem ser atribuídas a blocos distintos com segurança.
      const posicaoAmbigua = ordem === null && linhas.some((s, i) => {
        const anterior = linhas[i - 1];
        return indiceValido(s.set_index) && anterior?.tipo === s.tipo && anterior.set_index === s.set_index;
      });
      return { ordem, posicaoAmbigua, exercicioId, chave, nome, series: linhas.map((s, i) => ({
        chave: s.id ?? `legado:${chave}:${i}`,
        rotulo: indiceValido(s.set_index) ? rotulosDaSerie(s.tipo, s.set_index, nome).nome :
          s.tipo === "aquecimento" ? "Aquecimento" : "Série",
        valores: valoresDaSerieRegistrada(s, exercicio, unilateral),
      })) };
    });
}

import { describe, expect, it } from "vitest";
import { lerBackup, linhasParaImportar, montarBackup, textoDoBackup } from "@/lib/backup";
import { equipamentoDisponivel } from "@/lib/dados";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { composicaoDoModeloDaSessao } from "@/lib/modelo-da-sessao";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import { ajustarPrescricaoDaSessao, concluirSessao, escritaDaSessao, marcarSerie, montarSessaoAvulsa, substituirExercicio } from "@/lib/sessao";

const SUPINO = "supino-reto-com-barra", FLEXAO = "flexao-de-braco", ROSCA = "rosca-com-elastico";
const concluida = (plano: unknown) => ({ workout_id: "livre", status: "concluida", plano });
const itens = itensDeIds([SUPINO, ROSCA], { [SUPINO]: 3, [ROSCA]: 5 });
const inicial = planoDaSessao(itens);
const agora = "2026-11-20T10:00:00.000Z";
const conta = "11111111-1111-4111-8111-111111111111";
const outra = "22222222-2222-4222-8222-222222222222";

function aberta() {
  return montarSessaoAvulsa({
    id: "12345678-1234-4234-8234-123456789abc", data: "2026-11-20", userId: conta,
    workoutId: "livre", fase: "fase1", itens, plano: inicial, agora,
  });
}

describe("salvar a composição de uma sessão livre", () => {
  it("conserva a ordem, o movimento final, seu trabalho e descanso, mesmo com aquecimentos e notas do original", () => {
    const origem = {
      ...concluida({ ...inicial, equipamento_disponivel: ["super-band", "tatame"],
        trocas: { 1: [
          { exercicio_id: FLEXAO, trabalho: [1, 3], aquecimento: [1, 2], nota: "dia de ombro", ultima_firme: false },
          { exercicio_id: SUPINO, trabalho: [1], aquecimento: [1, 2, 3], nota: "só hoje" },
        ] },
        descansos_por_exercicio: { [SUPINO]: 120, [FLEXAO]: 85, [ROSCA]: 901 },
      }),
      user_id: conta, id: "original", ordem_execucao: [ROSCA, SUPINO], nota_geral: "senti o ombro", peso_corporal: 82.4,
    };
    const anterior = structuredClone(origem);
    expect(composicaoDoModeloDaSessao(origem)).toEqual({
      exercicios: [ROSCA, FLEXAO], equipamento_disponivel: ["tatame", "super-band"],
      series_por_exercicio: { [ROSCA]: 5, [FLEXAO]: 2 }, descansos_por_exercicio: { [FLEXAO]: 85 },
    });
    expect(origem).toEqual(anterior);
  });

  it("o encerramento guarda quatro séries configuradas com uma só marcada; o backup e Repetir mantêm seus próprios dados", () => {
    const ajustada = ajustarPrescricaoDaSessao(aberta(), 1, { series: 4 });
    const bloco = ajustada.blocos[0]!;
    const primeira = bloco.series.find(serie => serie.tipo === "trabalho")!;
    const marcada = marcarSerie(ajustada, 1, primeira.id, true, agora);
    expect(marcada.blocos[0]!.series.filter(s => s.concluida)).toHaveLength(1);
    const fechamento = concluirSessao({ sessao: { ...marcada, status: "concluida" }, agora }).escritas[0]!.linha!;
    expect(fechamento.plano).toMatchObject({ series_de_trabalho_ao_concluir: { [SUPINO]: 4 } });
    expect(marcada.plano).not.toHaveProperty("series_de_trabalho_ao_concluir");
    const backup = montarBackup({ userId: conta, exportadoEm: agora, tabelas: { sessions: [fechamento] } });
    const [escrita] = linhasParaImportar(lerBackup(textoDoBackup(backup)), outra);
    const restaurada = escrita!.linhas[0]!;
    expect(restaurada.user_id).toBe(outra);
    for (const linha of [fechamento, restaurada]) {
      const origem = concluida(linha.plano);
      expect(composicaoDoModeloDaSessao(origem)?.series_por_exercicio).toEqual({ [SUPINO]: 4, [ROSCA]: 5 });
      expect(montarRepeticaoDoTreinoLivre(origem)?.itens.map(item => item.prescricao.series)).toEqual([3, 5]);
    }
    expect(escritaDaSessao(marcada).linha?.plano).not.toHaveProperty("series_de_trabalho_ao_concluir");
    for (const status of ["abandonada", "concluida"] as const) {
      const sessao = status === "abandonada" ? marcada : aberta();
      expect(concluirSessao({ sessao: { ...sessao, status }, agora }).escritas[0]!.linha?.plano)
        .not.toHaveProperty("series_de_trabalho_ao_concluir");
    }
  });

  it("o fechamento da troca após a primeira série conserva as duas restantes no substituto", () => {
    const anterior = aberta();
    const feita = anterior.blocos[0]!.series.find(s => s.tipo === "trabalho")!;
    const trocada = substituirExercicio(marcarSerie(anterior, 1, feita.id, true, agora), 1, FLEXAO);
    const linha = concluirSessao({ sessao: { ...trocada, status: "concluida" }, agora }).escritas[0]!.linha!;
    expect(linha.plano).not.toHaveProperty("series_de_trabalho_ao_concluir");
    expect(composicaoDoModeloDaSessao(concluida(linha.plano))).toMatchObject({
      exercicios: [FLEXAO, ROSCA], series_por_exercicio: { [FLEXAO]: 2, [ROSCA]: 5 },
    });
  });

  it("usa Padrão para uma prescrição ausente ou inválida; uma troca antiga sem índices não herda as séries do original", () => {
    for (const trabalho of [undefined, [], [1, 1], [0, 1], [-1], "tres", Array.from({ length: 11 }, (_, i) => i + 1)]) {
      const modelo = composicaoDoModeloDaSessao(concluida({
        itens: [{ exercicio_id: SUPINO, series: 8, descanso_s: 150 }, { exercicio_id: ROSCA, series: -1 }],
        trocas: { 1: [{ exercicio_id: FLEXAO, trabalho }] }, descansos_por_exercicio: [],
      }));
      expect(modelo).toEqual({ exercicios: [FLEXAO, ROSCA], equipamento_disponivel: null,
        series_por_exercicio: null, descansos_por_exercicio: null });
    }
    expect(composicaoDoModeloDaSessao(concluida({ itens: [{ exercicio_id: ROSCA, series: 5 }],
      series_de_trabalho_ao_concluir: { [ROSCA]: 200 }, descansos_por_exercicio: { [ROSCA]: 4 },
    }))).toMatchObject({ series_por_exercicio: { [ROSCA]: 5 }, descansos_por_exercicio: null });
  });

  it("distingue inventário padrão e só peso corporal inclusive nos planos antigos", () => {
    for (const material of [undefined, null, [...equipamentoDisponivel()]]) {
      expect(composicaoDoModeloDaSessao(concluida({ ...inicial, equipamento_disponivel: material }))?.equipamento_disponivel).toBeNull();
    }
    expect(composicaoDoModeloDaSessao(concluida({ ...inicial, equipamento_disponivel: [] }))?.equipamento_disponivel).toEqual([]);
    for (const material of [["tatame", "outra-maquina"], [123], "tatame"]) {
      expect(composicaoDoModeloDaSessao(concluida({ ...inicial, equipamento_disponivel: material }))).toBeNull();
    }
  });

  it("exige uma sessão livre concluída com todos os movimentos finais identificados", () => {
    for (const origem of [
      { ...concluida(inicial), workout_id: "A1" }, { ...concluida(inicial), status: "em_andamento" },
      { ...concluida(inicial), status: "abandonada" }, concluida(null), concluida({ itens: [] }),
      concluida({ itens: [{ exercicio_id: "desconhecido" }] }),
      concluida({ ...inicial, trocas: { 1: [{ exercicio_id: ROSCA }] } }),
    ]) expect(composicaoDoModeloDaSessao(origem)).toBeNull();
    const legado = { itens: [null, { exercicio_id: ROSCA }], trocas: { 1: [{ exercicio_id: FLEXAO, trabalho: [1] }] } };
    expect(composicaoDoModeloDaSessao(concluida(legado))).toMatchObject({ exercicios: [FLEXAO, ROSCA], series_por_exercicio: { [FLEXAO]: 1 } });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import type { SerieBruta } from "@/lib/progresso";
import { lerFechamentoDoDetalhe, selecionarSeriesDoDetalhe } from "./series-do-detalhe";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ bd: () => ({ cache: { get } }) }));

const serie: SerieBruta = {
  id: "registrada", user_id: "ana", session_id: "livre", exercise_id: "supino", ordem_ex: 3,
  tipo: "trabalho", set_index: 1, reps: 8, reps_lado2: null, carga_kg: 42.5,
  tempo_s: null, tempo_s_lado2: null, passos: null, assistencia: null, concluida: true, registrada_em: "2026-11-19T12:00:00Z",
};
const fechamento = { linhas: [serie], atualizadoEm: 180 };
beforeEach(() => get.mockReset());

describe("fontes das séries de um treino concluído", () => {
  it("usa o fechamento do treino quando a fonte paginada ou a cópia parcial da conta ainda não o alcançou", () => {
    for (const instante of [170, 180, undefined]) {
      expect(selecionarSeriesDoDetalhe("ana", "livre", [], true, instante, fechamento)).toEqual({ linhas: [serie], completa: true });
    }
    expect(selecionarSeriesDoDetalhe("ana", "livre", [], false, 190, fechamento)).toEqual({ linhas: [serie], completa: true });
    expect(selecionarSeriesDoDetalhe("ana", "livre", [serie], false, undefined, { linhas: [], atualizadoEm: 180 }))
      .toEqual({ linhas: [], completa: true });
  });

  it("a confirmação posterior do servidor vence, inclusive carga corrigida, série desmarcada ou treino vazio", () => {
    const corrigida = { ...serie, carga_kg: 18, concluida: false };
    expect(selecionarSeriesDoDetalhe("ana", "livre", [
      corrigida, { ...serie, user_id: "bia" }, { ...serie, session_id: "outro-no-mesmo-dia" },
    ], true, 181, fechamento)).toEqual({ linhas: [corrigida], completa: true });
    expect(selecionarSeriesDoDetalhe("ana", "livre", [], true, 181, fechamento)).toEqual({ linhas: [], completa: true });
  });

  it("conserva os valores da linha legada atribuída à sessão logada sem inventar posição ou total", () => {
    const antiga = { ...serie, ordem_ex: undefined, user_id: undefined, id: undefined };
    expect(selecionarSeriesDoDetalhe("ana", "livre", [antiga], false, undefined, null)).toEqual({ linhas: [antiga], completa: false });
  });

  it("confere o dono e o UUID da sessão em cada linha da cópia local, inclusive após trocar de conta", async () => {
    const ler = () => lerFechamentoDoDetalhe("ana", "livre");
    get.mockResolvedValue({ atualizadoEm: 180, valor: [serie] });
    expect(await ler()).toEqual(fechamento);
    expect(get).toHaveBeenCalledWith(chaveDoDetalheDaSessao("ana", "livre"));
    for (const outra of [{ ...serie, session_id: "outra" }, { ...serie, user_id: "bia" }, { ...serie, id: undefined }]) {
      get.mockResolvedValue({ atualizadoEm: 180, valor: [serie, outra] });
      expect(await ler()).toBeNull();
    }
    get.mockResolvedValue({ atualizadoEm: 180, valor: [] });
    expect(await ler()).toEqual({ linhas: [], atualizadoEm: 180 });
    get.mockResolvedValue(undefined);
    expect(await ler()).toBeNull();
  });
});

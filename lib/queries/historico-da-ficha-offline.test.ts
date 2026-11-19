import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoDetalheDaSessao, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import { bd } from "@/lib/db";
import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import { chaveDaLista } from "@/lib/queries/lista-do-relatorio";
import { lerHistoricoDaFichaOffline } from "./historico-da-ficha-offline";

vi.mock("@/lib/player-sem-rede", () => ({ vinculoDoLoginAtual: vi.fn() }));
const vinculo = { conta: "ana", url: "", chave: "", impressao: "" };
const sessao: SessaoBruta = { id: "treino", user_id: "ana", data: "2026-11-19", workout_id: "livre", status: "concluida" };
const serie: SerieBruta = {
  id: "serie", user_id: "ana", session_id: sessao.id, exercise_id: "agachamento", set_index: 1,
  tipo: "trabalho", concluida: true, registrada_em: "2026-11-19T12:30:00Z", reps: 8,
  reps_lado2: null, passos: null, assistencia: null, carga_kg: 30, tempo_s: null, tempo_s_lado2: null,
};

beforeEach(async () => {
  await bd().cache.clear();
  await bd().outbox.clear();
  vi.mocked(vinculoDoLoginAtual).mockReset().mockResolvedValue(vinculo);
});

describe("Últimas sessões sem as consultas auxiliares da ficha", () => {
  it("reabre pela fonte do Relatório e prioriza a correção recente da série em outra aba", async () => {
    const agora = Date.now();
    const outraSessao = { ...sessao, id: "treino-bia", user_id: "bia" };
    await bd().cache.bulkPut([
      { chave: chaveDoHistoricoNoDisco("ana"), valor: [sessao, outraSessao], atualizadoEm: agora },
      { chave: chaveDaLista("series", "ana"), valor: [{ ...serie, reps: 8.5 }], atualizadoEm: agora - 10 },
      { chave: chaveDoDetalheDaSessao("bia", outraSessao.id), valor: [
        { ...serie, session_id: outraSessao.id, user_id: "bia" },
      ], atualizadoEm: agora },
    ]);
    expect((await lerHistoricoDaFichaOffline("agachamento"))?.series[0]?.reps).toBe(8.5);
    await bd().cache.put({ chave: chaveDoDetalheDaSessao("ana", sessao.id), valor: [serie], atualizadoEm: agora });
    expect(await lerHistoricoDaFichaOffline("agachamento")).toEqual({ conta: "ana", sessoes: [sessao], series: [serie] });
  });

  it("ignora a série de outra conta e abandona o resultado se o login mudar durante a leitura", async () => {
    const deOutraConta = { ...serie, user_id: "bia" };
    const antigaSemDono = { ...serie, user_id: undefined };
    const ler = () => lerHistoricoDaFichaOffline("agachamento", [deOutraConta, antigaSemDono]);
    expect((await ler())?.series).toEqual([]);
    await bd().cache.put({ chave: chaveDoHistoricoNoDisco("ana"), valor: [sessao], atualizadoEm: Date.now() });
    expect((await ler())?.series).toEqual([antigaSemDono]);
    vi.mocked(vinculoDoLoginAtual).mockResolvedValueOnce(vinculo).mockResolvedValueOnce({ ...vinculo, conta: "bia" });
    expect(await ler()).toBeNull();
  });
});

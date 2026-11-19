import { beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import type { ItemCache } from "@/lib/db";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { guardarNaFila, processar } from "@/lib/outbox";
import { enfileirarSeriesDoBackup, retirarDetalhesCobertos } from "./cache-do-detalhe";

const disco = new Map<string, ItemCache>();
const fila: EscritaTabela[] = [];
const guardar = vi.fn(async (item: ItemCache) => { disco.set(item.chave, item); });
vi.mock("@/lib/db", () => ({
  bd: () => ({
    cache: {
      put: guardar, delete: (chave: string) => disco.delete(chave),
      update: (chave: string, alteracao: Partial<ItemCache>) => disco.set(chave, { ...disco.get(chave)!, ...alteracao }),
      bulkDelete: async (chaves: string[]) => { for (const chave of chaves) disco.delete(chave); },
      where: () => ({ startsWith: (prefixo: string) => {
        const itens = [...disco.values()].filter(item => item.chave.startsWith(prefixo));
        return {
          toArray: async () => itens,
          filter: (aceita: (item: ItemCache) => boolean) => ({
            primaryKeys: async () => itens.filter(aceita).map(item => item.chave),
          }),
        };
      } }),
    },
    outbox: { where: () => ({ equals: () => ({ toArray: async () => fila.map(payload => ({ payload })) }) }) },
    transaction: (_modo: string, ...args: unknown[]) => (args.at(-1) as () => Promise<void>)(),
  }),
}));
vi.mock("@/lib/outbox", () => ({ guardarNaFila: vi.fn(), processar: vi.fn() }));

const serie = (id: string, session_id = "treino", user_id = "ana") => ({
  id, session_id, user_id, exercise_id: "remada", tipo: "trabalho", set_index: 1,
  reps: 8, carga_kg: 12, concluida: true,
});
function semear(conta: string, sessao: string, valor: unknown[], atualizadoEm = 5) {
  const chave = chaveDoDetalheDaSessao(conta, sessao);
  disco.set(chave, { chave, valor, atualizadoEm });
  return chave;
}

describe("cópia do detalhe do fechamento no aparelho", () => {
  beforeEach(() => { disco.clear(); fila.length = 0; vi.clearAllMocks(); });

  it("a primeira releitura completa substitui apenas detalhes anteriores da conta", async () => {
    const antiga = semear("ana", "antiga", []);
    const simultanea = semear("ana", "simultanea", [], 7);
    const recente = semear("ana", "recente", [], 10);
    const outra = semear("ana:outra", "antiga", []);
    const pendente = semear("ana", "na-fila", []);
    fila.push({ tabela: "sessions", op: "upsert", linha: { id: "na-fila", user_id: "ana", status: "concluida" } });
    await retirarDetalhesCobertos("ana", 7);
    expect([...disco.keys()]).toEqual([simultanea, recente, outra, pendente]);
    expect(disco.has(antiga)).toBe(false);
    expect(disco.get(pendente)?.atualizadoEm).toBe(7);
    fila.length = 0;
    await retirarDetalhesCobertos("ana", 8);
    expect(disco.has(pendente)).toBe(false);
  });

  it("a restauração parcial atualiza a série existente, respeita desmarcações, mudança de treino e outra conta", async () => {
    const s = serie("a"), b = serie("b"), muda = serie("muda"), intacta = serie("preservada");
    const origem = semear("ana", "treino", [s, b, muda, intacta]);
    const destino = semear("ana", "destino", []);
    const deBia = semear("bia", "treino", [serie("a", "treino", "bia")]);
    const lote = [
      { id: "a", session_id: "treino", user_id: "ana", carga_kg: 17.5 },
      { ...b, concluida: false }, { ...muda, session_id: "destino" }, serie("nova", "sem-fechamento"),
    ];
    await enfileirarSeriesDoBackup("ana", lote, "id");
    expect(guardarNaFila).toHaveBeenCalledWith("serie", { tabela: "session_sets", op: "upsert", linhas: lote, onConflict: "id" }, "sessions:lote");
    expect(disco.get(origem)?.valor).toEqual([{ ...s, carga_kg: 17.5 }, intacta]);
    expect(disco.get(destino)?.valor).toEqual([{ ...muda, session_id: "destino" }]);
    expect(disco.get(deBia)?.valor).toEqual([serie("a", "treino", "bia")]);
    expect(disco.has(chaveDoDetalheDaSessao("ana", "sem-fechamento"))).toBe(false);
    expect(processar).toHaveBeenCalledTimes(1);
  });

  it("uma falha ao enfileirar conserva a cópia, e uma conta incorreta não grava", async () => {
    const s = serie("a"), chave = semear("ana", "treino", [s]);
    vi.mocked(guardarNaFila).mockRejectedValueOnce(new Error("quota"));
    await expect(enfileirarSeriesDoBackup("ana", [{ ...s, carga_kg: 20 }], "id")).rejects.toThrow("quota");
    await expect(enfileirarSeriesDoBackup("bia", [s], "id")).rejects.toThrow("conta");
    expect(disco.get(chave)?.valor).toEqual([s]);
    expect(guardarNaFila).toHaveBeenCalledTimes(1);
    expect(processar).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { trocasParaComecar } from "@/lib/queries/comecar";

const original = "agachamento-livre";
const lembrada = "agachamento-frontal";
const deHoje = "agachamento-goblet";
const semCopia = async () => ({});

describe("começar com ou sem escolhas lembradas", () => {
  it("começa com o programa original na instalação antiga offline, mesmo sem a chave nova de cache", async () => {
    const refetch = vi.fn().mockRejectedValue(new Error("sem rede"));
    expect(await trocasParaComecar({ treinoId: "A1", lembradas: { data: undefined, refetch } }, semCopia)).toEqual({});
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("usa o último mapa offline e mantém o rascunho de hoje em uma falha da leitura opcional", async () => {
    const refetch = vi.fn().mockRejectedValue(new Error("sem rede"));
    expect(await trocasParaComecar({ treinoId: "A1", lembradas: { data: { [original]: lembrada }, refetch } }, semCopia))
      .toEqual({ [original]: lembrada });
    expect(refetch).not.toHaveBeenCalled();
    expect(await trocasParaComecar({ treinoId: "A1", lembradas: { data: undefined, refetch }, trocas: { [original]: deHoje } }, semCopia))
      .toEqual({ [original]: deHoje });
  });

  it("a falha HTTP sem cache em memória ainda aproveita a cópia do aparelho e as escritas pendentes", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: undefined });
    const lerCopia = vi.fn().mockResolvedValue({ [original]: lembrada });
    expect(await trocasParaComecar({ treinoId: "A1", lembradas: { data: undefined, refetch } }, lerCopia))
      .toEqual({ [original]: lembrada });
    expect(lerCopia).toHaveBeenCalledOnce();
    lerCopia.mockRejectedValue(new Error("IndexedDB indisponível"));
    expect(await trocasParaComecar({ treinoId: "A1", lembradas: { data: undefined, refetch } }, lerCopia))
      .toEqual({});
  });

  it("ao tocar antes de a leitura terminar, aplica a lembrança do A1 manual e desconsidera o rascunho de outro dia", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { [original]: lembrada } });
    expect(await trocasParaComecar({
      treinoId: "A1", lembradas: { data: undefined, refetch }, trocas: { [original]: deHoje }, doDia: false,
    }, semCopia)).toEqual({ [original]: lembrada });
    expect(refetch).toHaveBeenCalledOnce();
  });
});

import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { trocasParaComecar } from "@/lib/queries/comecar";
import { listarAbertasComCriacaoPendente } from "@/lib/queries/criacao-pendente-da-sessao";
import { chaves } from "@/lib/queries/dados";
import { criarSessao, finalizarSessao, sessaoLocalComCriacaoPendente } from "@/lib/queries/sessao";
import { escritaDaSessao } from "@/lib/sessao";

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

describe("começar pelo card enquanto a criação ainda está na fila", () => {
  const banco = bd();
  const entrada = { userId: "ana", data: "2026-11-20", treinoId: "A1", fase: "fase1" } as const;
  function aba() {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.sessoesAbertas(), []);
    return cliente;
  }

  beforeEach(async () => {
    await Promise.all([banco.sessaoAtiva.clear(), banco.outbox.clear(), banco.cache.clear()]);
  });

  const remota = { id: "outra-aberta", user_id: "ana", data: entrada.data, workout_id: "A1",
    fase: "fase1", status: "em_andamento", concluida_em: null } as const;

  it("uma cópia antiga e uma criação de outra conta durante o GET conservam somente a resposta do servidor", async () => {
    await criarSessao({ ...entrada, cliente: aba() });
    await banco.outbox.clear();
    const ler = vi.fn(async () => {
      await criarSessao({ ...entrada, userId: "bia", cliente: aba() });
      return [remota];
    });
    expect(await listarAbertasComCriacaoPendente("ana", ler)).toEqual([remota]);
    expect(ler).toHaveBeenCalledTimes(1);
  });

  it("enquanto o POST aguarda, a primeira leitura preserva a criação da conta e as sessões que já estão no servidor", async () => {
    const minha = await criarSessao({ ...entrada, cliente: aba() });
    await criarSessao({ ...entrada, userId: "bia", cliente: aba() });
    const ler = vi.fn(async () => [remota]);
    expect(await listarAbertasComCriacaoPendente("ana", ler)).toEqual([{ ...remota, id: minha.id }, remota]);
    expect(ler).toHaveBeenCalledTimes(1);
  });

  it("relê o servidor se a lista vazia chegar depois da confirmação do POST", async () => {
    const minha = await criarSessao({ ...entrada, cliente: aba() });
    const [criacao] = await banco.outbox.toCollection().primaryKeys();
    const confirmada = { ...remota, id: minha.id };
    const ler = vi.fn(async () => [confirmada]).mockImplementationOnce(async () => {
      // O primeiro GET encontrou a tabela vazia. O POST se confirma antes de a resposta chegar.
      await banco.outbox.delete(criacao!);
      return [];
    });
    expect(await listarAbertasComCriacaoPendente("ana", ler)).toEqual([confirmada]);
    expect(ler).toHaveBeenCalledTimes(2);
  });

  it.each(["pendente", "confirmada"] as const)("a criação de outra aba durante o primeiro GET continua visível quando %s", async estado => {
    const id = crypto.randomUUID();
    const esperada = { ...remota, id };
    const ler = vi.fn(async () => [esperada]).mockImplementationOnce(async () => {
      await criarSessao({ ...entrada, id, cliente: aba() });
      if (estado === "confirmada") await banco.outbox.clear();
      return [];
    });
    expect(await listarAbertasComCriacaoPendente("ana", ler)).toEqual([esperada]);
    expect(ler).toHaveBeenCalledTimes(estado === "confirmada" ? 2 : 1);
  });

  it("uma segunda resposta vazia vale mesmo que o aparelho ainda tenha a cópia criada durante a primeira leitura", async () => {
    const ler = vi.fn(async () => []).mockImplementationOnce(async () => {
      await criarSessao({ ...entrada, cliente: aba() });
      await banco.outbox.clear();
      return [];
    });
    expect(await listarAbertasComCriacaoPendente("ana", ler)).toEqual([]);
    expect(ler).toHaveBeenCalledTimes(2);
  });

  it("também reconhece outra criação enquanto aguarda a releitura do servidor", async () => {
    const primeira = await criarSessao({ ...entrada, cliente: aba() });
    const segundaId = crypto.randomUUID();
    const confirmadas = [segundaId, primeira.id].map(id => ({ ...remota, id }));
    const ler = vi.fn(async () => confirmadas)
      .mockImplementationOnce(async () => {
        await banco.outbox.clear();
        return [];
      })
      .mockImplementationOnce(async () => {
        await criarSessao({ ...entrada, id: segundaId, cliente: aba() });
        await banco.outbox.clear();
        return [{ ...remota, id: primeira.id }];
      });
    expect(await listarAbertasComCriacaoPendente("ana", ler)).toEqual(confirmadas);
    expect(ler).toHaveBeenCalledTimes(3);
  });

  it("duas abas com a lista vazia abrem o mesmo A1 e gravam uma única criação", async () => {
    const tocar = () => criarSessao({ ...entrada, cliente: aba(), retomarCriacaoPendente: true });
    const [primeira, segunda] = await Promise.all([tocar(), tocar()]);
    expect(segunda.id).toBe(primeira.id);
    expect(await sessaoLocalComCriacaoPendente("ana")).toEqual(primeira);
    expect((await tocar()).id).toBe(primeira.id);
    expect(await banco.sessaoAtiva.toCollection().primaryKeys()).toEqual([primeira.id]);
    expect(await banco.outbox.toArray()).toMatchObject([{
      tipo: "sessao", payload: { tabela: "sessions", op: "upsert", linha: { id: primeira.id, user_id: "ana", status: "em_andamento" } },
    }]);
  });

  it("começar outro treino por escolha explícita cria outro UUID mesmo com o primeiro na fila", async () => {
    const primeira = await criarSessao({ ...entrada, cliente: aba(), retomarCriacaoPendente: true });
    const segunda = await criarSessao({ ...entrada, cliente: aba() });
    expect(segunda.id).not.toBe(primeira.id);
    expect(await banco.outbox.toArray()).toMatchObject([primeira, segunda].map(({ id }) => ({
      payload: { linha: { id, workout_id: "A1", status: "em_andamento" } },
    })));
  });

  it("a criação e a cópia local precisam pertencer à conta que pede a retomada", async () => {
    const daBia = await criarSessao({ ...entrada, userId: "bia", cliente: aba() });
    expect(await sessaoLocalComCriacaoPendente("ana")).toBeNull();
    await banco.sessaoAtiva.update(daBia.id, { dados: { ...daBia, userId: "ana" } });
    expect(await sessaoLocalComCriacaoPendente("bia")).toBeNull();
    expect(await sessaoLocalComCriacaoPendente("ana")).toBeNull();
    const daAna = await criarSessao({ ...entrada, cliente: aba(), retomarCriacaoPendente: true });
    expect(daAna.userId).toBe("ana");
    expect(daAna.id).not.toBe(daBia.id);
  });

  it("uma criação pendente não reabre um UUID já encerrado no histórico ou na cópia local", async () => {
    const cliente = aba();
    const antiga = await criarSessao({ ...entrada, cliente });
    expect(await sessaoLocalComCriacaoPendente("ana", new Set([antiga.id]))).toBeNull();
    cliente.setQueryData(chaves.sessoes(), [{ id: antiga.id, user_id: "ana", status: "concluida" }]);
    const nova = await criarSessao({ ...entrada, cliente, retomarCriacaoPendente: true });
    expect(nova.id).not.toBe(antiga.id);
    await banco.sessaoAtiva.update(antiga.id, { dados: { ...antiga, status: "concluida" } });
    expect(await sessaoLocalComCriacaoPendente("ana", new Set([nova.id]))).toBeNull();
  });

  it.each(["concluida", "abandonada"] as const)("o fechamento %s na fila prevalece sobre uma cópia antiga ainda aberta", async status => {
    const cliente = aba();
    const sessao = await criarSessao({ ...entrada, cliente });
    await finalizarSessao({ cliente, sessao, status });
    await banco.sessaoAtiva.put({ id: sessao.id, dados: sessao, atualizadoEm: Date.now() });
    expect(await sessaoLocalComCriacaoPendente("ana")).toBeNull();
    expect((await criarSessao({ ...entrada, cliente: aba(), retomarCriacaoPendente: true })).id).not.toBe(sessao.id);
  });

  it("uma cópia cujo único envio pendente é um backup ou uma edição do plano permite iniciar um novo treino", async () => {
    const antiga = await criarSessao({ ...entrada, cliente: aba() });
    await banco.outbox.clear(); // A criação daquela sessão já chegou ao servidor.
    expect(await sessaoLocalComCriacaoPendente("ana")).toBeNull();
    await enfileirarEscrita("sessao", {
      tabela: "sessions", op: "upsert", onConflict: "id", linhas: [escritaDaSessao(antiga).linha!],
    });
    expect(await sessaoLocalComCriacaoPendente("ana")).toBeNull();
    await enfileirarEscrita("sessao", {
      tabela: "sessions", op: "update", filtro: { id: antiga.id, user_id: "ana", status: "em_andamento" },
      linha: { plano: antiga.plano },
    });
    expect(await sessaoLocalComCriacaoPendente("ana")).toBeNull();
    expect((await criarSessao({ ...entrada, cliente: aba(), retomarCriacaoPendente: true })).id).not.toBe(antiga.id);
  });
});

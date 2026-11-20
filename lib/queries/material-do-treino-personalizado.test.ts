import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { acharExercicio, equipamentoDisponivel } from "@/lib/dados";
import { equipamentoDaSessao, guardarEquipamentoDoDia, lerEquipamentoDoDia } from "@/lib/equipamento-da-sessao";
import { estadoInicial } from "@/lib/progressao";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import type { EquipamentoTag } from "@/lib/schemas";
import { criarSessaoComEquipamentoDoDia } from "./comecar";
import { carregarSessaoLocal, criarSessaoLivre } from "./sessao";

const conta = "ana";
const data = "2026-11-20";
const kit = new Set<EquipamentoTag>(["super-band", "tatame"]);
const origem = { userId: conta, data, fase: "fase1" } as const;

beforeEach(async () => {
  vi.stubGlobal("navigator", { onLine: false });
  await bd().sessaoAtiva.clear();
  await bd().outbox.clear();
  await bd().cache.clear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([
  { caso: "tatame e elástico", material: kit, tags: ["tatame", "super-band"], exercicios: ["remada-com-elastico", "ponte-de-gluteos-no-tatame"] },
  { caso: "só peso do corpo", material: new Set<EquipamentoTag>(), tags: [], exercicios: ["escalador", "flexao-de-braco"] },
  { caso: "inventário completo", material: equipamentoDisponivel(), tags: undefined, exercicios: ["supino-reto-com-barra", "remada-com-elastico"] },
])("a primeira gravação offline contém a ordem escolhida e o material para $caso", async ({ material, tags, exercicios }) => {
  const sessao = await criarSessaoLivre({
    ...origem, cliente: new QueryClient(), titulo: "Treino personalizado", exercicios, equipamentosDisponiveis: material,
  });

  bd().close();
  await bd().open();
  const recarregada = await carregarSessaoLocal(sessao.id);
  expect(recarregada).toEqual(sessao);
  expect(equipamentoDaSessao(recarregada!)).toEqual(material);
  expect(sessao.blocos.map(b => b.exercicioId)).toEqual(exercicios);
  expect(sessao.plano?.itens.map(item => item.exercicio_id)).toEqual(exercicios);
  expect(sessao.plano?.equipamento_disponivel).toEqual(tags);
  expect(await bd().outbox.toArray()).toMatchObject([{
    tipo: "sessao", alvo: `sessions:${sessao.id}`, payload: {
      tabela: "sessions", op: "upsert", linha: { id: sessao.id, user_id: conta, workout_id: "livre", plano: sessao.plano },
    },
  }]);
});

it("o inventário restrito preserva a carga atual da conta na reabertura", async () => {
  const agachamento = "agachamento-livre";
  const estados = { [agachamento]: { ...estadoInicial(acharExercicio(agachamento)), carga_atual_kg: 43.5 } };
  const personalizada = await criarSessaoLivre({
    ...origem, cliente: new QueryClient(), exercicios: ["flexao-de-braco", agachamento],
    equipamentosDisponiveis: new Set(["anilhas", "barra-macica", "cavalete"]), estados,
  });
  const reaberta = await carregarSessaoLocal(personalizada.id);
  const bloco = reaberta?.blocos[1];
  expect(bloco?.exercicioId).toBe(agachamento);
  const cargas = bloco?.series.filter(s => s.tipo === "trabalho").map(s => s.cargaKg);
  expect(cargas).toHaveLength(3);
  expect(new Set(cargas)).toEqual(new Set([43.5]));
});

it("uma criação sem espaço não deixa sessão sem material, e a nova tentativa grava uma única saída", async () => {
  const criar = () => criarSessaoLivre({
    ...origem, id: "tentativa", cliente: new QueryClient(), exercicios: ["remada-com-elastico"], equipamentosDisponiveis: kit,
  });
  vi.spyOn(bd().outbox, "add").mockRejectedValueOnce(new DOMException("Sem espaço", "QuotaExceededError"));
  await expect(criar()).rejects.toThrow("Sem espaço");
  expect(await bd().sessaoAtiva.count()).toBe(0);
  expect(await bd().outbox.count()).toBe(0);
  const criada = await criar();
  expect(equipamentoDaSessao(criada)).toEqual(kit);
  expect(await bd().outbox.count()).toBe(1);
});

it("o kit personalizado não muda o rascunho do A1 nem o inventário de uma repetição ou outra livre", async () => {
  const memoria = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: {
    getItem: (chave: string) => memoria.get(chave) ?? null,
    setItem: (chave: string, valor: string) => memoria.set(chave, valor),
    removeItem: (chave: string) => memoria.delete(chave),
  } });
  const materialDoA1 = new Set<EquipamentoTag>(["banco", "halteres", "anilhas"]);
  guardarEquipamentoDoDia(conta, data, "A1", materialDoA1);
  const cliente = new QueryClient();
  const exercicios = ["remada-com-elastico", "flexao-de-braco"];
  const personalizada = await criarSessaoLivre({ ...origem, cliente, exercicios, equipamentosDisponiveis: kit });
  expect(lerEquipamentoDoDia(conta, data, "A1")).toEqual(materialDoA1);

  const modelo = montarRepeticaoDoTreinoLivre({ workout_id: "livre", status: "concluida", plano: personalizada.plano });
  expect(modelo).not.toBeNull();
  const repetida = await criarSessaoLivre({ ...origem, cliente, ...modelo! });
  const outra = await criarSessaoLivre({ ...origem, cliente, exercicios });
  for (const livre of [repetida, outra]) {
    expect(livre.id).not.toBe(personalizada.id);
    expect(livre.plano).not.toHaveProperty("equipamento_disponivel");
    expect(equipamentoDaSessao(livre)).toEqual(equipamentoDisponivel());
    expect(livre.blocos.map(b => b.exercicioId)).toEqual(exercicios);
  }

  const programada = await criarSessaoComEquipamentoDoDia({ ...origem, cliente, treinoId: "A1" });
  expect(equipamentoDaSessao(programada)).toEqual(materialDoA1);
  expect((await carregarSessaoLocal(personalizada.id))?.plano).toEqual(personalizada.plano);
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { equipamentoDisponivel } from "@/lib/dados";
import { planoDaSessao } from "@/lib/livre";
import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import { ehComandoDeMaterial } from "@/lib/material-pendente";
import { guardarMaterialConfirmadoNoAparelho } from "@/lib/queries/material-confirmado";
import {
  carregarSessaoLocal, confirmarToquesPendentes, gravarMaterialDaSessaoRemota, guardarMaterialDaSessao, salvarSessaoLocal,
} from "@/lib/queries/sessao";
import { definirEquipamentoDaSessao, itensDoTreino, marcarSerie, montarSessao, reconstruirSessao } from "@/lib/sessao";
import type { EquipamentoTag } from "@/lib/schemas";

vi.mock("@/lib/player-sem-rede", () => ({ vinculoDoLoginAtual: vi.fn() }));

const conta = "ana", id = "a1", data = "2026-11-20";
const linha = { id, user_id: conta, data, workout_id: "A1", status: "em_andamento", fase: "fase1", iniciada_em: data + "T09:00:00Z", plano: null } as const;
const prescricao = () => planoDaSessao(itensDoTreino("A1"));
const tatame = new Set<EquipamentoTag>(["tatame"]);
const semMaterial = new Set<EquipamentoTag>();

beforeEach(async () => {
  vi.stubGlobal("window", { indexedDB });
  vi.mocked(vinculoDoLoginAtual).mockResolvedValue({ conta, url: "http://localhost", chave: "simulada", impressao: "confirmada" });
  await bd().sessaoAtiva.clear();
  await bd().outbox.clear();
  await bd().cache.clear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function comandos() {
  const itens = await bd().outbox.orderBy("id").toArray();
  expect(itens.every(i => i.tipo === "sessao" && i.alvo === "sessions:a1")).toBe(true);
  const payloads = itens.map(i => i.payload);
  expect(payloads.every(ehComandoDeMaterial)).toBe(true);
  return payloads.filter(ehComandoDeMaterial).map(p => p.equipamentoDaSessao);
}

it("duas escolhas encadeiam revisões e uma gravação atrasada de série preserva o material confirmado", async () => {
  const antiga = montarSessao({ id, userId: conta, data, treinoId: "A1", fase: "fase1" });
  await bd().sessaoAtiva.put({ id, dados: antiga, atualizadoEm: 1 });
  const primeira = await guardarMaterialDaSessao(definirEquipamentoDaSessao(antiga, semMaterial));
  const segunda = await guardarMaterialDaSessao(definirEquipamentoDaSessao(antiga, tatame));
  const serie = antiga.blocos[0]!.series[0]!;
  salvarSessaoLocal(marcarSerie(antiga, 1, serie.id, true), antiga);
  await confirmarToquesPendentes();
  const salva = await carregarSessaoLocal(id);
  expect(salva?.revisaoEquipamento).toBe(segunda.revisaoEquipamento);
  expect(salva?.plano?.equipamento_disponivel).toEqual(["tatame"]);
  expect(salva?.blocos[0]?.series[0]).toMatchObject({ id: serie.id, concluida: true });

  const restaurada = await guardarMaterialDaSessao(definirEquipamentoDaSessao(salva!, equipamentoDisponivel()));
  expect(restaurada.plano).not.toHaveProperty("equipamento_disponivel");
  expect(await comandos()).toEqual([
    { comando: primeira.revisaoEquipamento, revisaoBase: null, de: null, para: [], planoInicial: prescricao() },
    { comando: segunda.revisaoEquipamento, revisaoBase: primeira.revisaoEquipamento, de: [], para: ["tatame"] },
    { comando: restaurada.revisaoEquipamento, revisaoBase: segunda.revisaoEquipamento, de: ["tatame"], para: null },
  ]);
  expect(new Set([primeira.revisaoEquipamento, segunda.revisaoEquipamento, restaurada.revisaoEquipamento]).size).toBe(3);
});

it("a quota na cópia local aborta também o comando que já entrou na transação", async () => {
  const antiga = montarSessao({ id, userId: conta, data, treinoId: "A1", fase: "fase1" });
  await bd().sessaoAtiva.put({ id, dados: antiga, atualizadoEm: 1 });
  const desejada = definirEquipamentoDaSessao(antiga, semMaterial);
  vi.spyOn(bd().sessaoAtiva, "put").mockRejectedValueOnce(new DOMException("Sem espaço", "QuotaExceededError"));
  await expect(guardarMaterialDaSessao(desejada)).rejects.toThrow("Sem espaço");
  expect(await carregarSessaoLocal(id)).toEqual(antiga);
  expect(await bd().outbox.count()).toBe(0);
  await guardarMaterialDaSessao(desejada);
  expect(await comandos()).toHaveLength(1);
});

it("a aba Treino encadeia o material do mesmo dono e treino quando uma recarga traz a linha anterior", async () => {
  const a = await gravarMaterialDaSessaoRemota(linha, semMaterial, prescricao);
  await expect(gravarMaterialDaSessaoRemota({ ...linha, user_id: "bia" }, tatame, prescricao)).rejects.toThrow("nesta conta");
  await expect(gravarMaterialDaSessaoRemota({ ...linha, status: "concluida" }, tatame, prescricao)).rejects.toThrow("encerrado");
  const b = await gravarMaterialDaSessaoRemota(linha, tatame, prescricao);
  expect(await bd().sessaoAtiva.count()).toBe(0); // ver o cartão não cria um player sem as séries do outro aparelho
  const [primeiro, segundo] = await comandos();
  expect(primeiro).toEqual({ comando: a.revisao_equipamento, revisaoBase: null, de: null, para: [], planoInicial: prescricao() });
  expect(segundo).toMatchObject({ comando: b.revisao_equipamento, revisaoBase: a.revisao_equipamento, de: [], para: ["tatame"] });
  expect(b.plano).toEqual({ ...prescricao(), equipamento_disponivel: ["tatame"] });
  expect(reconstruirSessao({ ...linha, ...b }, [])?.revisaoEquipamento).toBe(b.revisao_equipamento);
});

it("uma confirmação recebida antes de atualizar a tela serve de base, e um GET com revisão nova prevalece", async () => {
  const base = { ...linha, plano: { ...prescricao(), titulo: "Treino remoto" } };
  const a = await gravarMaterialDaSessaoRemota(base, semMaterial, prescricao);
  const [item] = await bd().outbox.toArray();
  await guardarMaterialConfirmadoNoAparelho(conta, { ...base, ...a, revisao_equipamento: a.revisao_equipamento! }, item!);
  await bd().outbox.clear();
  const b = await gravarMaterialDaSessaoRemota(base, tatame, prescricao);
  expect((await comandos())[0]).toEqual({ comando: b.revisao_equipamento, revisaoBase: a.revisao_equipamento, de: [], para: ["tatame"] });
  await bd().outbox.clear();
  const nova = { ...base, revisao_equipamento: crypto.randomUUID(), plano: { ...base.plano, equipamento_disponivel: ["super-band" as const] } };
  await gravarMaterialDaSessaoRemota(nova, semMaterial, prescricao);
  expect((await comandos())[0]).toMatchObject({ revisaoBase: nova.revisao_equipamento, de: ["super-band"], para: [] });
});

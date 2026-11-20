import { expect, it } from "vitest";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import type { SessaoComMaterialConfirmado } from "@/lib/material-pendente";
import {
  acrescentarExercicioNaSessao, atualizarSerie, definirEquipamentoDaSessao, definirNota, desfazerUltimaInclusao,
  escritaDaSerie, marcarSerie, montarSessaoAvulsa, planoParaGravar,
} from "@/lib/sessao";
import { haInclusaoRemota, incorporarMaterialConfirmado } from "./material-confirmado";
import { planoAposArquivar } from "./plano-apos-arquivar";

function doisAparelhos() {
  const itens = itensDeIds(["flexao-de-braco", "agachamento-livre"]);
  const base = montarSessaoAvulsa({
    id: "livre", workoutId: "livre", userId: "ana", data: "2026-11-20", fase: "fase1",
    itens, plano: planoDaSessao(itens),
  });
  const antes = { ...definirNota(base, 1, "Palmas no chão"), revisaoEquipamento: "escolha-local" };
  const primeira = base.blocos[0]!.series[0]!.id;
  const local = marcarSerie(atualizarSerie(antes, 1, primeira, { reps: 11 }), 1, primeira, true);
  const comPonte = acrescentarExercicioNaSessao(base, "ponte-de-gluteos-no-tatame", {});
  const bloco = comPonte.blocos[2]!;
  const id = bloco.series[0]!.id;
  const alheia = marcarSerie(atualizarSerie(comPonte, 3, id, { reps: 10 }), 3, id, true);
  const serie = escritaDaSerie(alheia, alheia.blocos[2]!, alheia.blocos[2]!.series[0]!).linha;
  const remota: SessaoComMaterialConfirmado = {
    id: base.id, user_id: base.userId, status: "em_andamento", revisao_equipamento: "confirmada",
    plano: planoParaGravar(definirEquipamentoDaSessao(alheia, new Set(["tatame"]))),
  };
  return { local, remota, serie, comPonte };
}

it("incorpora a ponte e suas dez repetições sem trocar o objeto da flexão já registrada", () => {
  const { local, remota, serie } = doisAparelhos();
  const nova = incorporarMaterialConfirmado(local, remota, false, { series: [serie], estados: [] });
  expect(nova.blocos).toHaveLength(3);
  expect(nova.blocos[0]).toBe(local.blocos[0]);
  expect(nova.blocos[0]!.series[0]).toMatchObject({ reps: 11, concluida: true });
  expect(nova.blocos[0]!.nota).toBe("Palmas no chão");
  expect(nova.blocos[2]!.series[0]).toMatchObject({ id: serie.id, reps: 10, concluida: true });
  expect(nova.plano?.equipamento_disponivel).toEqual(["tatame"]);
  expect(nova.revisaoEquipamento).toBe("confirmada");
  expect(nova.player).toBe(local.player);
});

it("a escolha mais recente no aparelho continua disponível ao receber o exercício do outro", () => {
  const { local, remota, serie } = doisAparelhos();
  const posterior = definirEquipamentoDaSessao(local, new Set());
  const nova = incorporarMaterialConfirmado(posterior, remota, true, { series: [serie], estados: [] });
  expect(nova.plano?.equipamento_disponivel).toEqual([]);
  expect(nova.revisaoEquipamento).toBe("escolha-local");
  expect(nova.blocos[2]!.series[0]!.id).toBe(serie.id);
});

it("uma inclusão já desfeita no aparelho não volta por uma resposta antiga", () => {
  const { comPonte, remota } = doisAparelhos();
  const removida = desfazerUltimaInclusao(comPonte, comPonte.plano!.ultima_inclusao!.id);
  expect(haInclusaoRemota(removida, remota.plano)).toBe(false);
});

it("protege conta, sessão encerrada e plano de um catálogo mais recente", () => {
  const { local, remota, serie } = doisAparelhos();
  const dados = { series: [serie], estados: [] };
  expect(incorporarMaterialConfirmado(local, { ...remota, user_id: "outra" }, false, dados)).toBe(local);
  expect(incorporarMaterialConfirmado(local, { ...remota, status: "concluida" }, false, dados)).toBe(local);
  const plano = remota.plano!;
  const estrangeiro = { ...plano, itens: [...plano.itens, { ...plano.itens[0]!, exercicio_id: "catalogo-futuro" }] };
  expect(incorporarMaterialConfirmado(local, { ...remota, plano: estrangeiro }, false, dados)).toBe(local);
});

it("aceitar o plano sincronizado arquiva apenas o descanso antigo e mantém a série do aparelho", () => {
  const { local, remota, serie } = doisAparelhos();
  const original = { ...local.plano!, descansos_por_exercicio: { "flexao-de-braco": 55, "agachamento-livre": 60 } };
  const alteradaDepois = { ...local, plano: { ...original, descansos_por_exercicio: {
    ...original.descansos_por_exercicio, "agachamento-livre": 95,
  } } };
  const escolhida = { ...remota.plano!, descansos_por_exercicio: { "flexao-de-braco": 75, "agachamento-livre": 60 } };
  const flexao = escritaDaSerie(local, local.blocos[0]!, local.blocos[0]!.series[0]!).linha;
  const resgatada = planoAposArquivar(alteradaDepois, original, escolhida, { series: [serie], estados: [] }, [flexao]);
  expect(resgatada.plano?.descansos_por_exercicio).toEqual({ "flexao-de-braco": 75, "agachamento-livre": 95 });
  expect(planoParaGravar(resgatada)?.descansos_por_exercicio).toEqual(resgatada.plano?.descansos_por_exercicio);
  expect(resgatada.blocos.map(b => b.originalId)).toEqual(escolhida.itens.map(i => i.exercicio_id));
  expect(resgatada.blocos[0]!.series[0]).toMatchObject({ id: flexao.id, reps: 11 });
  expect(resgatada.blocos[2]!.series[0]).toMatchObject({ id: serie.id, reps: 10 });
});

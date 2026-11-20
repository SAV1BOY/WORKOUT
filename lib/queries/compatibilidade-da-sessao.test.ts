import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { bd } from "@/lib/db";
import { confirmarCatalogoLido, confirmarIdsDaSessaoProtegida, lerIdsDaSessaoProtegida, lerRevisaoDaProtecao, liberarSessaoProtegida } from "./compatibilidade-da-sessao";

beforeEach(() => bd().cache.clear());

it("duas abas conservam os IDs diferentes do mesmo treino e uma leitura anterior não libera o posterior", async () => {
  await Promise.all([
    confirmarIdsDaSessaoProtegida("ana", "a1", ["novo-a"]),
    confirmarIdsDaSessaoProtegida("ana", "a1", ["novo-b"]),
  ]);
  const revisao = (await lerRevisaoDaProtecao("ana", "a1"))!;
  expect((await lerIdsDaSessaoProtegida("ana", "a1")).sort()).toEqual(["novo-a", "novo-b"]);
  expect(await lerIdsDaSessaoProtegida("bia", "a1")).toEqual([]);
  expect(await lerIdsDaSessaoProtegida("ana", "outro")).toEqual([]);
  await liberarSessaoProtegida("ana", "a1", revisao);
  expect(await lerIdsDaSessaoProtegida("ana", "a1")).toEqual([]);
});

it.each(["novo-a", "novo-b"])("não libera com revisão antiga quando outra resposta confirma %s na mesma sessão", async id => {
  await confirmarCatalogoLido("ana", "a1", { itens: [{ exercicio_id: "novo-a" }] });
  const antesDaReleitura = (await lerRevisaoDaProtecao("ana", "a1"))!;
  await confirmarCatalogoLido("ana", "a1", null, [{ user_id: "ana", session_id: "a1", exercise_id: id }]);
  await liberarSessaoProtegida("ana", "a1", antesDaReleitura);
  expect(await lerIdsDaSessaoProtegida("ana", "a1")).toEqual([...new Set(["novo-a", id])]);
  const atual = (await lerRevisaoDaProtecao("ana", "a1"))!;
  expect(atual).not.toBe(antesDaReleitura);
  await liberarSessaoProtegida("ana", "a1", atual);
  expect(await lerIdsDaSessaoProtegida("ana", "a1")).toEqual([]);
});

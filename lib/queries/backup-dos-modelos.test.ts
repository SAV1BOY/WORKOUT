import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lerBackup, previaDaImportacao, textoDoBackup } from "@/lib/backup";
import { bd } from "@/lib/db";
import type { ModeloDeTreino } from "@/lib/modelo-de-treino";
import { FalhaDeRedeNaTabela, lerTabelaCompleta } from "@/lib/queries/ler";
import { exportarBackup, importarBackup, lerChavesExistentes } from "@/lib/queries/mais";
import { excluirModeloDeTreino, lerModelosDeTreino, salvarModeloDeTreino } from "@/lib/queries/modelos-de-treino";

vi.mock("@/lib/queries/ler", async original => ({
  ...(await original<typeof import("@/lib/queries/ler")>()),
  lerTabelaCompleta: vi.fn(),
}));

const modelo: ModeloDeTreino = {
  user_id: "ana", id: "aaaaaaaa-1234-4000-8000-000000000001", nome: "Treino da manhã",
  exercicios: ["prancha", "flexao-de-braco"], equipamento_disponivel: [],
};
const segundo = { ...modelo, id: "bbbbbbbb-1234-4000-8000-000000000002" };
const dia = "2026-11-20";

beforeEach(async () => {
  await bd().cache.clear();
  await bd().outbox.clear();
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

it("exporta o que ficou salvo se a fila sincronizar durante a leitura e restaura pela conta escolhida", async () => {
  const cliente = new QueryClient();
  const outraAba = new QueryClient();
  await salvarModeloDeTreino(cliente, segundo);
  await salvarModeloDeTreino(outraAba, { ...segundo, user_id: "bia", nome: "Antes de importar" });

  // O servidor tirou a foto da conta antes de a remoção em outra aba chegar.
  const resposta = Promise.withResolvers<ModeloDeTreino[]>();
  const pedido = Promise.withResolvers<void>();
  vi.mocked(lerTabelaCompleta).mockImplementation(async (tabela, _colunas, _nome, conta) => {
    if (tabela === "modelos_de_treino") {
      expect(conta).toBe("ana");
      pedido.resolve();
      return resposta.promise;
    }
    return [];
  });
  const exportacao = exportarBackup({ userId: "ana", agora: dia, cliente });
  await pedido.promise;
  await excluirModeloDeTreino(outraAba, "ana", modelo.id);
  await bd().outbox.clear();
  resposta.resolve([modelo]);
  const arquivo = lerBackup(textoDoBackup(await exportacao));
  expect(arquivo.tabelas.modelos_de_treino).toEqual([segundo]);
  expect(arquivo.tabelas.sessions).toEqual([]);

  // A prévia vê o modelo gravado no destino enquanto aguarda a rede.
  const local = { ...segundo, user_id: "bia", nome: "Antes de importar" };
  await salvarModeloDeTreino(outraAba, local);
  vi.mocked(lerTabelaCompleta).mockResolvedValue([]);
  const existentes = await lerChavesExistentes("bia", cliente, arquivo);
  expect(existentes).toEqual({ modelos_de_treino: [{ id: segundo.id, user_id: "bia" }] });
  expect(previaDaImportacao(arquivo, existentes, "bia")).toMatchObject({ novas: 0, atualizadas: 1 });
  vi.stubGlobal("navigator", { onLine: false });
  for (let i = 0; i < 2; i++) {
    expect(await importarBackup({ backup: arquivo, userId: "bia", cliente })).toBe(1);
    expect(await lerModelosDeTreino(new QueryClient(), "bia")).toEqual([{ ...segundo, user_id: "bia" }]);
  }
  expect(await lerModelosDeTreino(outraAba, "ana")).toEqual([segundo]);
  const tipos = (await bd().outbox.toArray()).map(item => item.tipo);
  expect(new Set(tipos)).toEqual(new Set(["modelo_de_treino"]));
  expect(await bd().sessaoAtiva.count()).toBe(0);
});

it("reexporta os modelos atuais e os de outra versão, com a ordem e o material originais", async () => {
  const cliente = new QueryClient();
  const futuro = { ...segundo, nome: "Salvo em outro aparelho",
    exercicios: ["flexao-de-braco", "movimento-de-outra-versao", "prancha"],
    equipamento_disponivel: ["material-de-outra-versao", "tatame"],
    series_por_exercicio: { "movimento-de-outra-versao": 1, prancha: 4 },
  };
  const modelos = [modelo, futuro];
  vi.mocked(lerTabelaCompleta).mockImplementation(async (tabela, _colunas, _nome, conta) =>
    tabela === "modelos_de_treino" && conta === "ana" ? modelos : [],
  );
  const arquivo = lerBackup(textoDoBackup(await exportarBackup({ userId: "ana", agora: dia, cliente })));
  expect(arquivo.versao).toBe(1);
  expect(arquivo.tabelas.modelos_de_treino).toEqual(modelos);
  const destino = modelos.map(linha => ({ ...linha, user_id: "bia" }));
  const chaves = await lerChavesExistentes("bia", cliente, arquivo);
  expect(previaDaImportacao(arquivo, chaves, "bia")).toMatchObject({ novas: 2, atualizadas: 0, invalidas: 0 });
  vi.stubGlobal("navigator", { onLine: false });
  expect(await importarBackup({ backup: arquivo, userId: "bia", cliente })).toBe(2);
  expect(await lerModelosDeTreino(new QueryClient(), "bia")).toEqual(destino);
  expect((await bd().outbox.toArray()).map(item => item.payload)).toEqual(destino.map(linha => ({
    tabela: "modelos_de_treino", op: "upsert", onConflict: "user_id,id", linha,
  })));
  vi.stubGlobal("navigator", { onLine: true });
  const reexportado = await exportarBackup({ userId: "bia", agora: dia, cliente });
  expect(reexportado.tabelas.modelos_de_treino).toEqual(destino);
  expect(reexportado.tabelas.sessions).toEqual([]);
  expect(reexportado.tabelas.session_sets).toEqual([]);
});

it("uma leitura incompleta interrompe a exportação, mesmo com um modelo guardado no aparelho", async () => {
  const cliente = new QueryClient();
  await salvarModeloDeTreino(cliente, modelo);
  vi.mocked(lerTabelaCompleta).mockImplementation(async tabela => {
    if (tabela === "modelos_de_treino") throw new FalhaDeRedeNaTabela("leitura interrompida");
    return [];
  });
  await expect(exportarBackup({ userId: "ana", agora: dia, cliente })).rejects.toThrow("leitura interrompida");
});

import { describe, expect, it } from "vitest";
import {
  APP_BACKUP,
  CHAVE_DA_TABELA,
  TABELAS_BACKUP,
  VERSAO_BACKUP,
  chaveDaLinha,
  contarLinhas,
  emLotes,
  lerBackup,
  linhasParaImportar,
  montarBackup,
  nomeDoArquivoBackup,
  previaDaImportacao,
  textoDoBackup,
  type Backup,
} from "@/lib/backup";

import { equipamentoDisponivel } from "@/lib/dados";
import { equipamentoDaSessao } from "@/lib/equipamento-da-sessao";
import { itensDeIds, itensDoPlano, planoDaSessao } from "@/lib/livre";
import { descansoPersonalizadoDaSessao, reconstruirSessao } from "@/lib/sessao";
import type { PlanoDaSessao } from "@/lib/types";

const AGORA = "2026-09-15T10:00:00.000Z";
const EU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

function backupDeExemplo(): Backup {
  return montarBackup({
    userId: EU,
    exportadoEm: AGORA,
    tabelas: {
      profiles: [{ user_id: EU, nome: "Miguel", altura_cm: 190 }],
      sessions: [
        { id: "s1", user_id: EU, data: "2026-09-14", workout_id: "A1", fase: "fase1" },
      ],
      session_sets: [
        { id: "x1", session_id: "s1", user_id: EU, exercise_id: "supino-reto-com-barra", reps: 8 },
      ],
      body_weights: [{ id: "p1", user_id: EU, data: "2026-09-14", peso_kg: 82.4 }],
    },
  });
}

describe("exportar (SPEC §9)", () => {
  it("as tabelas do schema aparecem, mesmo vazias", () => {
    const backup = backupDeExemplo();
    expect(Object.keys(backup.tabelas).sort()).toEqual([...TABELAS_BACKUP].sort());
    expect(backup.tabelas.pullup_singles).toEqual([]);
    expect(backup.app).toBe(APP_BACKUP);
    expect(backup.versao).toBe(VERSAO_BACKUP);
    expect(contarLinhas(backup)).toBe(4);
  });

  it("o nome do arquivo leva a data (§3.9)", () => {
    expect(nomeDoArquivoBackup(AGORA)).toBe("treino-terraco-2026-09-15.json");
    expect(nomeDoArquivoBackup("2026-12-01")).toBe("treino-terraco-2026-12-01.json");
  });

  it("o texto exportado volta a ser o mesmo backup", () => {
    const backup = backupDeExemplo();
    const lido = lerBackup(textoDoBackup(backup));
    expect(lido.tabelas.sessions).toEqual(backup.tabelas.sessions);
    expect(lido.user_id).toBe(EU);
  });
});

describe("ler o arquivo", () => {
  it("recusa o que não é JSON, o que é de outro app e o do futuro", () => {
    expect(() => lerBackup("isto não é json")).toThrow(/JSON/);
    expect(() => lerBackup(JSON.stringify({ oi: 1 }))).toThrow(/backup/i);
    expect(() =>
      lerBackup(
        JSON.stringify({ app: "outro", versao: 1, exportado_em: AGORA, tabelas: {} }),
      ),
    ).toThrow(/outro app/);
    expect(() =>
      lerBackup(
        JSON.stringify({
          app: APP_BACKUP,
          versao: VERSAO_BACKUP + 1,
          exportado_em: AGORA,
          tabelas: {},
        }),
      ),
    ).toThrow(/versão/);
  });

  it("descarta tabela que não é do schema", () => {
    const lido = lerBackup(
      JSON.stringify({
        app: APP_BACKUP,
        versao: 1,
        exportado_em: AGORA,
        tabelas: { sessions: [{ id: "s1" }], segredos: [{ id: "x" }] },
      }),
    );
    expect(lido.tabelas.sessions).toHaveLength(1);
    expect("segredos" in lido.tabelas).toBe(false);
  });
});

describe("chave das linhas", () => {
  it("é a chave primária real de cada tabela", () => {
    expect(CHAVE_DA_TABELA.profiles).toEqual(["user_id"]);
    expect(CHAVE_DA_TABELA.exercise_state).toEqual(["user_id", "exercise_id"]);
    expect(chaveDaLinha("sessions", { id: "s1" })).toBe("s1");
    expect(
      chaveDaLinha("exercise_state", { user_id: EU, exercise_id: "supino" }),
    ).toBe(`${EU}|supino`);
  });

  it("linha sem chave não tem identidade", () => {
    expect(chaveDaLinha("sessions", { data: "2026-09-14" })).toBeNull();
    expect(chaveDaLinha("exercise_state", { user_id: EU })).toBeNull();
  });
});

describe("prévia da importação (SPEC §3.9)", () => {
  it("num banco zerado tudo é novo", () => {
    const previa = previaDaImportacao(backupDeExemplo(), {});
    expect(previa.total).toBe(4);
    expect(previa.novas).toBe(4);
    expect(previa.atualizadas).toBe(0);
    expect(previa.itens.map((i) => i.tabela)).toEqual([
      "profiles",
      "sessions",
      "session_sets",
      "body_weights",
    ]);
  });

  it("o que já está lá conta como atualização, não como linha nova", () => {
    const previa = previaDaImportacao(backupDeExemplo(), {
      sessions: [{ id: "s1" }],
      profiles: [{ user_id: EU }],
    });
    expect(previa.novas).toBe(2);
    expect(previa.atualizadas).toBe(2);
  });

  it("linha repetida no arquivo entra uma vez; sem chave é ignorada", () => {
    const backup = montarBackup({
      userId: EU,
      exportadoEm: AGORA,
      tabelas: {
        sessions: [{ id: "s1" }, { id: "s1" }, { data: "2026-09-14" }],
      },
    });
    const previa = previaDaImportacao(backup, {});
    expect(previa.total).toBe(1);
    expect(previa.invalidas).toBe(1);
  });
});

describe("trocas lembradas no programa", () => {
  const supino = "supino-reto-com-barra";
  const troca = { user_id: OUTRO, workout_id: "A1", exercicio_original_id: supino, substituto_id: "flexao-de-braco" };
  const outraNoMesmoExercicio = { ...troca, workout_id: "SA" };
  const tabela = "trocas_do_programa";

  it("exporta e restaura cada posição com a chave e o dono de destino", () => {
    const backup = montarBackup({ userId: OUTRO, exportadoEm: AGORA, tabelas: {
      trocas_do_programa: [troca, outraNoMesmoExercicio],
    } });
    const lido = lerBackup(textoDoBackup(backup));
    expect(lido.tabelas.trocas_do_programa).toEqual([troca, outraNoMesmoExercicio]);
    lido.tabelas.trocas_do_programa!.push({ ...troca, user_id: EU, extra: true });
    const destino = [troca, outraNoMesmoExercicio].map((l) => ({ ...l, user_id: EU }));
    const previa = previaDaImportacao(lido, { trocas_do_programa: [destino[0]!] }, EU);
    expect(previa).toMatchObject({ novas: 1, atualizadas: 1, invalidas: 0, total: 2 });
    expect(linhasParaImportar(lido, EU)).toEqual([{
      tabela, onConflict: "user_id,workout_id,exercicio_original_id", linhas: destino,
    }]);
  });

  it("descarta treino fora do programa, exercício na posição errada e substituto inválido", () => {
    const invalidas = [
      { ...troca, workout_id: "livre" }, { ...troca, workout_id: "B1" },
      { ...troca, exercicio_original_id: {} }, { ...troca, substituto_id: null },
      { ...troca, substituto_id: "inventado" }, { ...troca, substituto_id: supino },
      { ...troca, substituto_id: "elevacao-de-panturrilha-em-pe" },
    ];
    const backup = montarBackup({ userId: OUTRO, exportadoEm: AGORA, tabelas: {
      trocas_do_programa: [...invalidas, { ...troca, is_admin: true }],
    } });
    expect(previaDaImportacao(backup, {}, EU)).toMatchObject({ total: 1, invalidas: invalidas.length });
    expect(linhasParaImportar(backup, EU)[0]?.linhas).toEqual([{ ...troca, user_id: EU }]);
  });

  it("restaura um arquivo antigo ou uma tabela vazia sem apagar as trocas do destino", () => {
    const antigo = lerBackup(JSON.stringify({ app: APP_BACKUP, versao: 1, exportado_em: AGORA, tabelas: {} }));
    expect(antigo.tabelas).not.toHaveProperty(tabela);
    for (const backup of [antigo, { ...antigo, tabelas: { trocas_do_programa: [] } }]) {
      expect(previaDaImportacao(backup, { trocas_do_programa: [troca] }, EU).total).toBe(0);
      expect(linhasParaImportar(backup, EU)).toEqual([]);
    }
  });
});

describe("equipamento e descansos da sessão no backup v1", () => {
  const titulo = "Treino reordenado";
  const plano = planoDaSessao(itensDeIds(["supino-reto-com-barra", "agachamento-livre"]), { titulo });
  const linha = {
    id: "sessao-exportada", user_id: OUTRO, data: "2026-09-14", workout_id: "A1", fase: "fase1",
    status: "em_andamento", iniciada_em: AGORA,
  } as const;

  it.each([
    { caso: "sem coluna plano", campos: {}, esperado: equipamentoDisponivel() },
    { caso: "plano nulo", campos: { plano: null }, esperado: equipamentoDisponivel() },
    { caso: "plano legado", campos: { plano }, esperado: equipamentoDisponivel() },
    { caso: "só o corpo", campos: { plano: { ...plano, equipamento_disponivel: [] } }, esperado: new Set() },
    { caso: "equipamento selecionado", campos: { plano: { ...plano, equipamento_disponivel: ["tatame", "super-band"] } }, esperado: new Set(["tatame", "super-band"]) },
    {
      caso: "equipamento e intervalo próprio do supino",
      campos: { plano: { ...plano, equipamento_disponivel: ["tatame"], descansos_por_exercicio: { "supino-reto-com-barra": 75 } } },
      esperado: new Set(["tatame"]),
      descansoSupino: 75,
    },
  ])("restaura na conta de destino e retoma a sessão com $caso", ({ campos, esperado, descansoSupino }) => {
    const backup = montarBackup({ userId: OUTRO, exportadoEm: AGORA, tabelas: { sessions: [{ ...linha, ...campos }] } });
    const arquivo = lerBackup(textoDoBackup(backup));
    const escritas = linhasParaImportar(arquivo, EU);
    expect(escritas).toEqual([{ tabela: "sessions", onConflict: "id", linhas: [{ ...linha, ...campos, user_id: EU }] }]);

    const restaurado = escritas[0]!.linhas[0]!.plano as PlanoDaSessao | null | undefined;
    const sessao = reconstruirSessao({ ...linha, user_id: EU, plano: restaurado }, [], {
      itens: itensDoPlano(restaurado) ?? undefined,
    });
    expect(sessao).not.toBeNull();
    expect(equipamentoDaSessao(sessao!)).toEqual(esperado);
    expect(descansoPersonalizadoDaSessao(sessao!, "supino-reto-com-barra")).toBe(descansoSupino ?? null);
    expect(descansoPersonalizadoDaSessao(sessao!, "agachamento-livre")).toBeNull();
    if (restaurado) expect(sessao!.blocos.map((b) => b.exercicioId)).toEqual(["supino-reto-com-barra", "agachamento-livre"]);
  });
});

describe("escritas da importação (SPEC §9)", () => {
  it("cada tabela vira um upsert pela chave primária, na ordem das dependências", () => {
    const escritas = linhasParaImportar(backupDeExemplo(), EU);
    expect(escritas.map((e) => e.tabela)).toEqual([
      "profiles",
      "sessions",
      "session_sets",
      "body_weights",
    ]);
    expect(escritas[1]?.onConflict).toBe("id");
    expect(escritas[0]?.onConflict).toBe("user_id");
  });

  /** §9: a RLS só aceita linha do dono — o backup pode vir de outra conta. */
  it("carimba o user_id de quem está importando", () => {
    const backup = montarBackup({
      userId: OUTRO,
      exportadoEm: AGORA,
      tabelas: { sessions: [{ id: "s1", user_id: OUTRO, data: "2026-09-14" }] },
    });
    const linhas = linhasParaImportar(backup, EU)[0]?.linhas ?? [];
    expect(linhas[0]?.user_id).toBe(EU);
    expect(linhas[0]?.id).toBe("s1");
  });

  it("descarta coluna que não existe no schema", () => {
    const backup = montarBackup({
      userId: EU,
      exportadoEm: AGORA,
      tabelas: {
        sessions: [{ id: "s1", data: "2026-09-14", inventada: "x", is_admin: true }],
      },
    });
    const linha = linhasParaImportar(backup, EU)[0]?.linhas[0] ?? {};
    expect("inventada" in linha).toBe(false);
    expect("is_admin" in linha).toBe(false);
    expect(linha.data).toBe("2026-09-14");
  });

  /** Idempotência (§9): o mesmo arquivo duas vezes dá as mesmas escritas. */
  it("importar duas vezes produz exatamente as mesmas linhas", () => {
    const backup = backupDeExemplo();
    expect(linhasParaImportar(backup, EU)).toEqual(linhasParaImportar(backup, EU));
  });

  it("linha sem chave não vira escrita", () => {
    const backup = montarBackup({
      userId: EU,
      exportadoEm: AGORA,
      tabelas: { sessions: [{ data: "2026-09-14" }] },
    });
    expect(linhasParaImportar(backup, EU)).toEqual([]);
  });

  /*
   * Auditoria final: a importação forçava `user_id`, mas copiava do arquivo
   * dois campos que apontam para fora do usuário.
   */
  it("reescreve o storage_path da foto com o user_id de quem importa", () => {
    const backup = montarBackup({
      userId: OUTRO,
      exportadoEm: AGORA,
      tabelas: {
        progress_photos: [
          {
            id: "f1",
            user_id: OUTRO,
            data: "2026-01-01",
            angulo: "frente",
            storage_path: `${OUTRO}/2026-01-01-frente.jpg`,
          },
        ],
      },
    });
    const linha = linhasParaImportar(backup, EU)[0]?.linhas[0] ?? {};
    expect(linha.storage_path).toBe(`${EU}/2026-01-01-frente.jpg`);
    expect(String(linha.storage_path)).not.toContain(OUTRO);
  });

  it("foto sem data ou com ângulo inventado não entra", () => {
    const backup = montarBackup({
      userId: EU,
      exportadoEm: AGORA,
      tabelas: {
        progress_photos: [
          { id: "f1", data: "2026-01-01", angulo: "perfil-esquerdo" },
          { id: "f2", angulo: "frente" },
          { id: "f3", data: "2026-01-02", angulo: "costas" },
        ],
      },
    });
    const linhas = linhasParaImportar(backup, EU)[0]?.linhas ?? [];
    expect(linhas.map((l) => l.id)).toEqual(["f3"]);
  });

  it("série cuja sessão não vem no arquivo é descartada", () => {
    const backup = montarBackup({
      userId: EU,
      exportadoEm: AGORA,
      tabelas: {
        sessions: [{ id: "s1", data: "2026-09-14" }],
        session_sets: [
          { id: "x1", session_id: "s1", exercise_id: "supino-reto-com-barra" },
          // a sessão de outra conta: a FK do Postgres não passa por RLS
          { id: "x2", session_id: "sessao-de-outro", exercise_id: "agachamento-livre" },
          { id: "x3", exercise_id: "remada-curvada" },
        ],
      },
    });
    const series = linhasParaImportar(backup, EU).find((e) => e.tabela === "session_sets");
    expect(series?.linhas.map((l) => l.id)).toEqual(["x1"]);
  });

  it("os lotes cobrem tudo sem repetir", () => {
    const lista = Array.from({ length: 450 }, (_, i) => i);
    const lotes = emLotes(lista, 200);
    expect(lotes.map((l) => l.length)).toEqual([200, 200, 50]);
    expect(lotes.flat()).toEqual(lista);
  });
});

it("restaura notas fixas e preserva campos desconhecidos em backups anteriores", () => {
  const backup = montarBackup({ userId: EU, exportadoEm: AGORA, tabelas: { exercise_state: [
    { exercise_id: "supino", notas: "antiga", nota_pessoal: null },
    { exercise_id: "remada", notas: "barco", nota_pessoal: "banco" },
    { exercise_id: "agachamento", notas: "suporte 3" },
    { exercise_id: "terra", notas: null },
  ] } });
  const lotes = linhasParaImportar(lerBackup(textoDoBackup(backup)), OUTRO);
  expect(lotes.map((l) => l.linhas.map((linha) => linha.exercise_id))).toEqual([["supino", "remada", "agachamento"], ["terra"]]);
  expect(lotes[0]?.linhas.map((linha) => linha.nota_pessoal)).toEqual([null, "banco", "suporte 3"]);
  expect(lotes[1]?.linhas[0]).not.toHaveProperty("nota_pessoal");
});

it("o backup v1 preserva as notas dos blocos e distingue a nota geral apagada da ausente", () => {
  const antigas = "Supino: ajustar banco · Remada: trocar pegada";
  const contexto = "Treino no terraço\nTempo curto hoje.";
  const sessoes = [
    { id: "legada", notas: antigas },
    { id: "anotada", notas: antigas, nota_geral: contexto },
    { id: "apagada", notas: null, nota_geral: null },
  ];
  const backup = montarBackup({ userId: EU, exportadoEm: AGORA, tabelas: { sessions: sessoes } });
  const arquivo = lerBackup(textoDoBackup(backup));
  expect(arquivo.versao).toBe(1);
  expect(arquivo.tabelas.sessions).toEqual(sessoes);
  const lotes = linhasParaImportar(arquivo, OUTRO);
  expect(lotes.map((lote) => lote.linhas)).toEqual([
    [{ ...sessoes[1], user_id: OUTRO }, { ...sessoes[2], user_id: OUTRO }],
    [{ ...sessoes[0], user_id: OUTRO }],
  ]);
  expect(lotes[1]!.linhas[0]).not.toHaveProperty("nota_geral");
});

it("separa no backup v1 as quatro combinações de nota geral e ordem da sessão", () => {
  const ordem = ["c", "a", "b"];
  const plano = { itens: [], ordem_execucao: ordem };
  const sessoes = [
    { id: "legada", plano },
    { id: "com-nota", plano, nota_geral: null },
    { id: "com-ordem", plano, ordem_execucao: ordem },
    { id: "ambas", plano, nota_geral: "Treino leve", ordem_execucao: [] },
    { id: "coluna-nula", plano, ordem_execucao: null },
  ];
  const arquivo = lerBackup(textoDoBackup(montarBackup({
    userId: OUTRO, exportadoEm: AGORA, tabelas: { sessions: sessoes },
  })));
  const lotes = linhasParaImportar(arquivo, EU);
  expect(arquivo.versao).toBe(1);
  expect(lotes).toHaveLength(4);
  for (const lote of lotes) {
    expect(lote.tabela).toBe("sessions");
    expect(lote.onConflict).toBe("id");
    const primeira = lote.linhas[0]!;
    for (const linha of lote.linhas) {
      expect("nota_geral" in linha).toBe("nota_geral" in primeira);
      expect("ordem_execucao" in linha).toBe("ordem_execucao" in primeira);
    }
  }
  const linhas = lotes.flatMap((lote) => lote.linhas);
  expect(linhas).toHaveLength(sessoes.length);
  for (const original of sessoes) {
    expect(linhas.find((linha) => linha.id === original.id)).toStrictEqual({ ...original, user_id: EU });
  }
});

it.each([
  { caso: "escolha após o cliente antigo regravar o plano", ordem: ["flexao-de-braco", "supino-reto-com-barra"], espelhoAntigo: {} },
  { caso: "retorno ao padrão com espelho desatualizado", ordem: [], espelhoAntigo: { ordem_execucao: ["flexao-de-braco", "supino-reto-com-barra"] } },
])("exporta para um cliente anterior — $caso", ({ ordem, espelhoAntigo }) => {
  const plano = {
    ...planoDaSessao(itensDeIds(["supino-reto-com-barra", "flexao-de-braco"])),
    ...espelhoAntigo,
    equipamento_disponivel: ["tatame"],
  };
  const sessao = { id: "s1", workout_id: "livre", plano, nota_geral: "No terraço", ordem_execucao: ordem };
  const original = structuredClone(sessao);
  const backup = montarBackup({ userId: EU, exportadoEm: AGORA, tabelas: { sessions: [sessao] } });
  const arquivo = lerBackup(textoDoBackup(backup));
  expect(arquivo.tabelas.sessions).toStrictEqual([{ ...sessao, plano: { ...plano, ordem_execucao: ordem } }]);
  expect(sessao).toStrictEqual(original);
});

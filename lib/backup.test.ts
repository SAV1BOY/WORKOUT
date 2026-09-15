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
  it("as 11 tabelas do schema aparecem, mesmo vazias", () => {
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

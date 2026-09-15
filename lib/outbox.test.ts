import { describe, expect, it } from "vitest";
import { atrasoDaTentativa, venceu } from "@/lib/outbox";
import { alvoDaEscrita, enviarItem } from "@/lib/outbox-supabase";

describe("retry da fila de saída", () => {
  it("cresce exponencialmente", () => {
    expect(atrasoDaTentativa(0)).toBe(2_000);
    expect(atrasoDaTentativa(1)).toBe(4_000);
    expect(atrasoDaTentativa(3)).toBe(16_000);
  });
  it("não passa de 5 minutos", () => {
    expect(atrasoDaTentativa(20)).toBe(5 * 60_000);
  });
});

describe("quando um item da fila vence (SPEC §8)", () => {
  const agora = 1_800_000_000_000;

  it("vence quando a hora chega", () => {
    expect(venceu({ proximaTentativa: agora - 1 }, agora)).toBe(true);
    expect(venceu({ proximaTentativa: agora }, agora)).toBe(true);
    expect(venceu({ proximaTentativa: agora + 4_000 }, agora)).toBe(false);
    expect(venceu({ proximaTentativa: agora + 5 * 60_000 }, agora)).toBe(false);
  });

  it("o relógio do aparelho andando para trás não prende a fila", () => {
    // o celular voltou uma hora: sem isto a série esperaria uma hora para subir
    expect(venceu({ proximaTentativa: agora + 60 * 60_000 }, agora)).toBe(true);
  });
});

describe("ordem da fila: quem espera por quem (SPEC §8)", () => {
  it("as escritas de sessão ficam amarradas à linha de `sessions`", () => {
    expect(
      alvoDaEscrita({
        tabela: "sessions",
        op: "upsert",
        linha: { id: "sess-1", user_id: "u1" },
      }),
    ).toBe("sessions:sess-1");

    // a conclusão e o descarte olham o filtro
    expect(
      alvoDaEscrita({
        tabela: "sessions",
        op: "update",
        linha: { status: "abandonada" },
        filtro: { id: "sess-1" },
      }),
    ).toBe("sessions:sess-1");

    // a série e o evento dependem da sessão existir no banco (FK do schema)
    expect(
      alvoDaEscrita({
        tabela: "session_sets",
        op: "upsert",
        linha: { id: "serie-1", session_id: "sess-1" },
      }),
    ).toBe("sessions:sess-1");
    expect(
      alvoDaEscrita({
        tabela: "session_sets",
        op: "delete",
        filtro: { session_id: "sess-1", exercise_id: "agachamento-livre" },
      }),
    ).toBe("sessions:sess-1");
    expect(
      alvoDaEscrita({
        tabela: "progression_events",
        op: "upsert",
        linha: { id: "ev-1", session_id: "sess-1" },
      }),
    ).toBe("sessions:sess-1");
  });

  it("o que não depende de sessão nenhuma não espera por ninguém", () => {
    expect(
      alvoDaEscrita({ tabela: "body_weights", op: "upsert", linha: { id: "p1" } }),
    ).toBeUndefined();
    expect(
      alvoDaEscrita({ tabela: "pullup_singles", op: "upsert", linha: { id: "s1" } }),
    ).toBeUndefined();
    // evento do programa inteiro (troca de fase, §5.1): não tem sessão
    expect(
      alvoDaEscrita({
        tabela: "progression_events",
        op: "upsert",
        linha: { id: "ev-1", exercise_id: null },
      }),
    ).toBeUndefined();
  });

  it("os lotes de um backup importado vão na ordem em que foram enfileirados (§9)", () => {
    expect(
      alvoDaEscrita({
        tabela: "sessions",
        op: "upsert",
        linhas: [{ id: "sess-1" }, { id: "sess-2" }],
      }),
    ).toBe("sessions:lote");
    expect(
      alvoDaEscrita({
        tabela: "session_sets",
        op: "upsert",
        linhas: [{ id: "serie-1", session_id: "sess-2" }],
      }),
    ).toBe("sessions:lote");
    expect(
      alvoDaEscrita({
        tabela: "body_measurements",
        op: "upsert",
        linhas: [{ id: "m1" }],
      }),
    ).toBeUndefined();
  });
});

describe("escrita sem filtro (SPEC §8)", () => {
  /** Um item da fila, do jeito que ele sai do Dexie. */
  function item(payload: unknown) {
    return { tipo: "agenda" as const, payload, tentativas: 0, proximaTentativa: 0, criadoEm: 0 };
  }

  it("um update ou delete sem filtro é recusado, não aplicado na tabela inteira", async () => {
    await expect(
      enviarItem(item({ tabela: "schedule_overrides", op: "delete" })),
    ).rejects.toThrow(/sem filtro/);
    await expect(
      enviarItem(item({ tabela: "sessions", op: "update", linha: { status: "abandonada" } })),
    ).rejects.toThrow(/sem filtro/);
    await expect(
      enviarItem(item({ tabela: "sessions", op: "update", linha: {}, filtro: {} })),
    ).rejects.toThrow(/sem filtro/);
  });

  it("um item sem tabela nem operação também não passa", async () => {
    await expect(enviarItem(item({ nada: true }))).rejects.toThrow(/sem tabela/);
  });
});

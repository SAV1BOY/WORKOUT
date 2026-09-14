import { describe, expect, it } from "vitest";
import { atrasoDaTentativa } from "@/lib/outbox";

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

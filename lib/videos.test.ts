import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { idsComVideo, idsComVideoEm, urlDoVideo } from "@/lib/videos";

const base = mkdtempSync(join(tmpdir(), "videos-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("vídeo opcional (SPEC §13.1)", () => {
  it("pasta ausente é lista vazia (o caso do kit, sem vídeo nenhum)", () => {
    expect(idsComVideoEm(join(base, "nao-existe"))).toEqual([]);
  });

  it("lê os ids dos .mp4 e ignora o resto", () => {
    const pasta = join(base, "videos");
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, "agachamento-livre.mp4"), "");
    writeFileSync(join(pasta, "supino-reto-com-barra.MP4"), "");
    writeFileSync(join(pasta, "leia-me.txt"), "");
    expect(idsComVideoEm(pasta)).toEqual([
      "agachamento-livre",
      "supino-reto-com-barra",
    ]);
  });

  it("a url é /videos/<id>.mp4", () => {
    expect(urlDoVideo("agachamento-livre")).toBe("/videos/agachamento-livre.mp4");
  });

  it("sem a pasta em public/, o app roda sem vídeo nenhum", () => {
    expect(Array.isArray(idsComVideo())).toBe(true);
  });
});

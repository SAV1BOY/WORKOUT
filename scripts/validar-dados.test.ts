import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ilustracoes } from "@/lib/dados";

const raiz = resolve(__dirname, "..");

/** Roda `npm run validar` e devolve o que saiu, sem estourar o teste. */
function validar(): { ok: boolean; saida: string } {
  try {
    const saida = execFileSync("npx", ["tsx", "scripts/validar-dados.ts"], {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, saida };
  } catch (e) {
    const erro = e as { stdout?: string; stderr?: string };
    return { ok: false, saida: `${erro.stdout ?? ""}${erro.stderr ?? ""}` };
  }
}

/** O primeiro arquivo listado em data/ilustracoes.json. */
const ALVO = resolve(raiz, ilustracoes[0]!.arquivos[0]!.arquivo);
const ESCONDIDO = `${ALVO}.escondido-pelo-teste`;
let escondido = false;

afterEach(() => {
  if (escondido) {
    renameSync(ESCONDIDO, ALVO);
    escondido = false;
  }
});

describe("npm run validar (marco Mídia)", () => {
  it("passa com os dados e os assets como estão", () => {
    const r = validar();
    expect(r.saida).toContain("ilustrações");
    expect(r.ok, r.saida).toBe(true);
  });

  it("falha quando um arquivo de ilustração some", () => {
    renameSync(ALVO, ESCONDIDO);
    escondido = true;

    const r = validar();
    expect(r.ok, "validar deveria ter falhado com a ilustração ausente").toBe(
      false,
    );
    expect(r.saida).toContain("ilustração ausente");
    expect(r.saida).toContain(ilustracoes[0]!.exercicio_id);
  });
});

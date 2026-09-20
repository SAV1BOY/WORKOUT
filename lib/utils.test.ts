/**
 * O mesclador de classes (SPEC §22.3 item 6). `text-rotulo` e `text-micro`
 * são tamanhos de fonte do `@theme`, não cores: se o `cn` não souber disso,
 * ele descarta o tamanho quando a mesma chamada traz uma cor de texto — foi
 * assim que a faixa da semana e a barra de abas voltaram para 16 px e a faixa
 * vazou os 360 px. Este teste prende a configuração.
 */
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn — os tamanhos de texto do projeto", () => {
  it("mantém text-rotulo ao lado de uma cor de texto", () => {
    expect(cn("text-rotulo leading-none", "text-muted-foreground")).toContain(
      "text-rotulo",
    );
    expect(cn("numero text-micro", "text-primary")).toContain("text-micro");
  });

  it("continua resolvendo conflito de verdade entre tamanhos", () => {
    expect(cn("text-rotulo", "text-micro")).toBe("text-micro");
    expect(cn("text-sm", "text-rotulo")).toBe("text-rotulo");
    expect(cn("text-rotulo", "text-sm")).toBe("text-sm");
  });

  it("continua resolvendo conflito entre cores", () => {
    expect(cn("text-muted-foreground", "text-primary")).toBe("text-primary");
  });

  it("segue juntando classes condicionais como o clsx", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});

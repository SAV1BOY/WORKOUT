import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { equipamentos } from "@/lib/dados";
import {
  anilhasDoKit,
  barrasDoTerraco,
  fotoDoItem,
  itensDoTerraco,
  notaDasAnilhas,
  oQueFalta,
  presilhas,
  totalDeAnilhasKg,
} from "@/lib/equipamento";
import { comPesoDaBarra } from "@/lib/preferencias";

describe("itens do terraço (SPEC §3.9)", () => {
  it("lista todos os itens do JSON, com nome e specs de lá", () => {
    const itens = itensDoTerraco();
    expect(itens).toHaveLength(equipamentos.itens.length);
    for (const [i, item] of itens.entries()) {
      const doJson = equipamentos.itens[i];
      expect(item.nome).toBe(doJson?.nome);
      expect(item.specs).toBe(doJson?.specs);
    }
  });

  it("a foto de cada item existe mesmo em assets/", () => {
    for (const item of itensDoTerraco()) {
      const caminho = join(process.cwd(), "assets", item.foto.replace(/^\//, ""));
      expect(existsSync(caminho), `falta ${item.foto}`).toBe(true);
    }
  });

  /*
   * SPEC §15.3: a exceção das fotos dos itens só vale escrita. A procedência
   * mora no JSON (como a condição 2 da §15.1 exige das imagens que entram por
   * licença livre), com `licenca: null` dizendo em letra que não há licença
   * livre aqui — é isso que Mais → Créditos e o README mostram.
   */
  it("a procedência das fotos dos itens está no JSON, sem licença livre", () => {
    const fotos = equipamentos.fotos_dos_itens;
    expect(fotos.pasta).toBe("assets/itens/");
    expect(fotos.origem).toContain("anúncios");
    expect(fotos.licenca).toBeNull();
    expect(fotos.uso).toContain("Equipamento");
  });

  it("a pasta do JSON vira a URL pública da primeira foto", () => {
    expect(fotoDoItem("banco", "assets/itens/banco/")).toBe(
      "/itens/banco/banco_01.jpg",
    );
    // sem a barra no fim também
    expect(fotoDoItem("corda", "assets/itens/corda")).toBe(
      "/itens/corda/corda_01.jpg",
    );
  });
});

describe("barras (SPEC §3.9 e §6.4)", () => {
  it("sem nada medido, o peso vem do JSON e a que falta fica 'a pesar'", () => {
    const barras = barrasDoTerraco({});
    const macica = barras.find((b) => b.id === "barra-macica");
    const w = barras.find((b) => b.id === "barra-w");

    expect(macica?.pesoKg).toBe(7.5);
    expect(macica?.origem).toBe("json");
    // a barra W vem com peso_kg null no JSON: vale o provisório
    expect(w?.pesoDoJson).toBeNull();
    expect(w?.pesoKg).toBe(2);
    expect(w?.origem).toBe("provisorio");
    expect(w?.capacidadeKg).toBe(50);
  });

  it("depois de pesar, o peso é o do perfil", () => {
    const prefs = comPesoDaBarra({}, "barra-w", 4.8);
    const w = barrasDoTerraco(prefs).find((b) => b.id === "barra-w");
    expect(w?.pesoKg).toBe(4.8);
    expect(w?.pesoDoPerfil).toBe(4.8);
    expect(w?.origem).toBe("perfil");
  });

  it("dá para corrigir até a barra que o JSON já traz", () => {
    const prefs = comPesoDaBarra({}, "barra-macica", 7.2);
    const macica = barrasDoTerraco(prefs).find((b) => b.id === "barra-macica");
    expect(macica?.pesoKg).toBe(7.2);
    expect(macica?.origem).toBe("perfil");
  });
});

describe("anilhas e o que falta", () => {
  it("do maior para o menor, com o estoque do JSON", () => {
    const anilhas = anilhasDoKit();
    expect(anilhas[0]?.kg).toBe(10);
    expect(anilhas.at(-1)?.kg).toBe(1);
    const soma = anilhas.reduce((s, a) => s + a.kg * a.qtd, 0);
    expect(soma).toBe(totalDeAnilhasKg());
  });

  it("nota, presilhas e a lista do que falta vêm do JSON", () => {
    expect(notaDasAnilhas()).toBe(equipamentos.anilhas.nota);
    expect(presilhas()).toBe(equipamentos.presilhas);
    expect(oQueFalta()).toEqual(equipamentos.faltam);
  });
});

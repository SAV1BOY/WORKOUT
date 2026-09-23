import { describe, expect, it } from "vitest";
import { treinosDoExercicio } from "@/lib/catalogo";
import { acharColecao, colecoesPorAparelho, hrefDaColecao } from "@/lib/colecoes";
import { exercicios, tutorialPorExercicio } from "@/lib/dados";
import {
  ROTULO_DA_ABA,
  SEM_HISTORICO,
  abasDaFicha,
  historicoVazio,
  hrefDoEquipamento,
  linksDosTreinos,
  nivelDosTitulos,
  tagsDoEquipamento,
} from "@/lib/ficha";

describe("as abas da ficha (SPEC §22.14 item 4)", () => {
  it("sem tutorial no JSON, só Vídeo e Músculos", () => {
    expect(abasDaFicha(false)).toEqual(["video", "musculos"]);
    expect(abasDaFicha(true)).toEqual(["video", "musculos", "tutorial"]);
  });

  it("os 81 exercícios têm tutorial hoje: todos oferecem a aba", () => {
    expect(exercicios).toHaveLength(81);
    for (const e of exercicios) {
      expect(abasDaFicha(tutorialPorExercicio(e.id) !== null), e.id).toContain("tutorial");
    }
  });

  it("o rótulo diz que o tutorial é no YouTube", () => {
    expect(ROTULO_DA_ABA.tutorial).toBe("Tutorial no YouTube");
  });
});

describe("nível dos títulos por contexto (SPEC §22.14 item 3e)", () => {
  it("página: H1 é o nome, seções H2; folha: título H2, seções H3", () => {
    expect(nivelDosTitulos(true)).toBe(2);
    expect(nivelDosTitulos(false)).toBe(3);
  });
});

describe("tags de equipamento levam à coleção do aparelho (SPEC §22.14 item 3c)", () => {
  const comColecao = new Set(colecoesPorAparelho().map((c) => c.id.replace("aparelho:", "")));

  it("em todos os 81 exercícios, tag com coleção vira link; sem coleção, texto", () => {
    let links = 0;
    let texto = 0;
    for (const e of exercicios) {
      for (const t of tagsDoEquipamento(e.equipamento)) {
        if (comColecao.has(t.tag)) {
          links += 1;
          expect(t.href, `${e.id} ${t.tag}`).toBe(`/explorar/aparelho/${t.tag}`);
          // a rota existe: a coleção é achada pelo id e contém o exercício
          const colecao = acharColecao(`aparelho:${t.tag}`);
          expect(colecao?.exercicios, `${e.id} ${t.tag}`).toContain(e.id);
        } else {
          texto += 1;
          expect(t.href, `${e.id} ${t.tag}`).toBeNull();
        }
        expect(t.rotulo.length).toBeGreaterThan(0);
      }
    }
    expect(links).toBeGreaterThan(0);
    expect(texto).toBeGreaterThan(0);
  });

  it("anilhas, halteres e barra W não têm coleção de aparelho", () => {
    expect(hrefDoEquipamento("anilhas")).toBeNull();
    expect(hrefDoEquipamento("halteres")).toBeNull();
    expect(hrefDoEquipamento("barra-w")).toBeNull();
    expect(hrefDoEquipamento("cross-over")).toBe("/explorar/aparelho/cross-over");
  });
});

describe("'Aparece em:' leva à coleção do treino (SPEC §22.14 item 3d)", () => {
  it("todo treino de todo exercício vira /explorar/treino/<id>", () => {
    let total = 0;
    for (const e of exercicios) {
      for (const t of linksDosTreinos(treinosDoExercicio(e.id))) {
        total += 1;
        expect(t.href).toBe(hrefDaColecao({ id: `treino:${t.id}` }));
        expect(t.href.startsWith("/explorar/treino/")).toBe(true);
        expect(acharColecao(`treino:${t.id}`)?.exercicios).toContain(e.id);
        expect(t.nome.length).toBeGreaterThan(0);
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});

describe("histórico vazio vira um cartão (SPEC §22.14 item 2)", () => {
  const vazio = { temRecorde: false, pontos: 0, sessoes: 0, eventos: 0 };

  it("só com os quatro vazios", () => {
    expect(historicoVazio(vazio)).toBe(true);
    expect(historicoVazio({ ...vazio, temRecorde: true })).toBe(false);
    expect(historicoVazio({ ...vazio, pontos: 1 })).toBe(false);
    expect(historicoVazio({ ...vazio, sessoes: 1 })).toBe(false);
    expect(historicoVazio({ ...vazio, eventos: 1 })).toBe(false);
  });

  it("o texto diz quando o histórico começa", () => {
    expect(`${SEM_HISTORICO.titulo} — ${SEM_HISTORICO.frase}`).toBe(
      "Ainda sem histórico deste exercício — Ele começa na primeira série registrada.",
    );
  });
});

/**
 * SPEC §22.13 item 2 (correção da auditoria 3): os três exercícios que só têm
 * foto (escalador, salto básico e corrida no lugar com a corda) aparecem com a
 * foto na faixa do player (`h-36` desde a §22.16) e na capa do bloco da Visão geral
 * (`h-36 rounded-none`) — e nas duas ela vai em `object-contain`, inteira, não
 * cortada. O e2e de object-fit cobre só a ficha e as miniaturas; aqui é o
 * `<img>` que o componente desenha, renderizado no servidor.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaGrande } from "@/components/exercicio/media-grande";
import { midiaGrande } from "@/lib/midia";

const SO_FOTO = ["escalador", "salto-basico", "corrida-no-lugar-com-a-corda"] as const;
const FAIXAS = [
  { onde: "faixa do player", className: "h-36" },
  { onde: "capa do bloco na Visão geral", className: "h-36 rounded-none" },
] as const;

function classesDoImg(html: string): string[] {
  const img = /<img\b[^>]*>/.exec(html)?.[0] ?? "";
  const classe = /\bclass="([^"]*)"/.exec(img)?.[1] ?? "";
  return classe.split(/\s+/).filter(Boolean);
}

describe("faixa com foto: object-contain (§22.13 item 2)", () => {
  for (const id of SO_FOTO) {
    it(`${id} só tem foto`, () => {
      expect(midiaGrande(id, {})?.tipo).toBe("foto");
    });
    for (const { onde, className } of FAIXAS) {
      it(`${id} — ${onde}: a foto vai inteira (object-contain)`, () => {
        const html = renderToStaticMarkup(
          createElement(MediaGrande, { exercicioId: id, className, aoAbrir: () => {} }),
        );
        const classes = classesDoImg(html);
        expect(classes, html).toContain("object-contain");
        expect(classes).not.toContain("object-cover");
        // a altura da faixa continua a de quem chama
        for (const c of className.split(" ")) expect(classes).toContain(c);
      });
    }
  }
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { acharExercicio, exercicios, ilustracoes, ilustracaoPorExercicio } from "@/lib/dados";
import {
  VIEWBOX_MAPA_ANATOMICO,
  PROPORCAO_MAPA_ANATOMICO,
} from "@/lib/mapa-anatomico";
import {
  ilustracaoDoExercicio,
  midiaDaMiniatura,
  midiaGrande,
  opcoesDeMidia,
  posicoesDaIlustracao,
  urlsDaIlustracao,
} from "@/lib/midia";
import { ilustracoesSchema } from "@/lib/schemas";

/** Um exercício com ilustração de duas posições, para os casos concretos. */
const SUPINO = "supino-reto-com-barra";
/** Um dos quatro que seguem com a figura animada do kit. */
const SEM_ILUSTRACAO = "farmer-s-walk";

describe("data/ilustracoes.json (marco Mídia)", () => {
  it("passa no schema e não repete exercício", () => {
    const bruto = JSON.parse(
      readFileSync(resolve(__dirname, "../data/ilustracoes.json"), "utf8"),
    );
    const lista = ilustracoesSchema.parse(bruto);
    expect(lista.length).toBeGreaterThan(0);
    expect(new Set(lista.map((i) => i.exercicio_id)).size).toBe(lista.length);
  });

  it("todo exercício listado existe no catálogo", () => {
    const ids = new Set(exercicios.map((e) => e.id));
    for (const i of ilustracoes) expect(ids.has(i.exercicio_id)).toBe(true);
  });

  it("toda entrada tem autor, licença e link da fonte — a CC BY-SA exige", () => {
    for (const i of ilustracoes) {
      expect(i.autor.trim()).not.toBe("");
      expect(i.licenca).toMatch(/^CC BY-SA \d\.\d$/);
      expect(i.url_fonte).toMatch(/^https:\/\//);
      expect(i.titulo_fonte.trim()).not.toBe("");
    }
  });

  it("só arquivos de assets/ilustracoes, em WebP ou SVG", () => {
    for (const i of ilustracoes) {
      for (const a of i.arquivos) {
        expect(a.arquivo).toMatch(/^assets\/ilustracoes\/.+\.(webp|svg)$/);
        expect(a.largura).toBeGreaterThan(0);
        expect(a.altura).toBeGreaterThan(0);
      }
      // o nome do arquivo segue o id do exercício e a posição
      expect(i.arquivos[0]!.arquivo).toContain(`${i.exercicio_id}-1.`);
    }
  });

  it("a largura máxima é 640 px (o que o celular precisa)", () => {
    for (const i of ilustracoes) {
      for (const a of i.arquivos) {
        if (a.arquivo.endsWith(".webp")) expect(a.largura).toBeLessThanOrEqual(640);
      }
    }
  });

  it("sem ilustração o exercício continua com a figura animada", () => {
    const exercicio = acharExercicio(SEM_ILUSTRACAO);
    expect(ilustracaoPorExercicio(SEM_ILUSTRACAO)).toBeNull();
    expect(exercicio.figura).not.toBeNull();
  });
});

describe("ilustracaoDoExercicio", () => {
  it("devolve as URLs públicas e o crédito montado", () => {
    const i = ilustracaoDoExercicio(SUPINO);
    expect(i).not.toBeNull();
    expect(i!.urls[0]).toMatch(/^\/ilustracoes\/supino-reto-com-barra-1\./);
    expect(i!.credito.texto).toBe(
      `Ilustração: ${i!.credito.autor}, ${i!.credito.licenca}`,
    );
    expect(i!.credito.url_fonte).toMatch(/^https:\/\//);
  });

  it("é `null` para quem não tem", () => {
    expect(ilustracaoDoExercicio(SEM_ILUSTRACAO)).toBeNull();
    expect(urlsDaIlustracao(SEM_ILUSTRACAO)).toEqual([]);
  });

  it("nunca passa de duas posições", () => {
    for (const e of exercicios) {
      expect(posicoesDaIlustracao(e.id)).toBeLessThanOrEqual(2);
    }
  });
});

describe("opcoesDeMidia (o segmento Ilustração · Figura · Fotos)", () => {
  it("põe a ilustração na frente da figura e da foto", () => {
    expect(opcoesDeMidia(SUPINO)).toEqual(["ilustracao", "figura", "foto"]);
  });

  it("o vídeo local vem antes de tudo quando existe (§13.1)", () => {
    expect(opcoesDeMidia(SUPINO, { temVideo: true })[0]).toBe("video");
  });

  it("sem ilustração sobram figura e foto", () => {
    expect(opcoesDeMidia(SEM_ILUSTRACAO)).toEqual(["figura", "foto"]);
  });

  it("todo exercício do catálogo tem pelo menos uma opção", () => {
    for (const e of exercicios) {
      expect(opcoesDeMidia(e.id).length).toBeGreaterThan(0);
    }
  });
});

describe("midiaGrande", () => {
  it("escolhe a ilustração e leva o crédito junto", () => {
    const m = midiaGrande(SUPINO)!;
    expect(m.tipo).toBe("ilustracao");
    expect(m.urls.length).toBe(2);
    expect(m.credito?.licenca).toMatch(/^CC BY-SA/);
  });

  it("`tipo` força a opção do segmento", () => {
    expect(midiaGrande(SUPINO, { tipo: "figura" })!.tipo).toBe("figura");
    expect(midiaGrande(SUPINO, { tipo: "foto" })!.tipo).toBe("foto");
    // pedir uma opção que o exercício não tem cai na preferência
    expect(midiaGrande(SUPINO, { tipo: "video" })!.tipo).toBe("ilustracao");
  });

  it("`semFoto` não deixa a página inteira repetir a foto de cima", () => {
    const so = exercicios.find(
      (e) => !e.figura && !ilustracaoPorExercicio(e.id) && e.fotos.length > 0,
    );
    if (so) expect(midiaGrande(so.id, { semFoto: true })).toBeNull();
    expect(midiaGrande(SUPINO, { semFoto: true })!.tipo).toBe("ilustracao");
  });

  it("figura e foto não têm crédito (são do próprio kit)", () => {
    expect(midiaGrande(SUPINO, { tipo: "figura" })!.credito).toBeNull();
    expect(midiaGrande(SUPINO, { tipo: "foto" })!.credito).toBeNull();
  });
});

describe("midiaDaMiniatura", () => {
  it("usa a primeira posição da ilustração quando há uma", () => {
    const m = midiaDaMiniatura(SUPINO);
    expect(m.tipo).toBe("ilustracao");
    expect(m.url).toBe(ilustracaoDoExercicio(SUPINO)!.urls[0]);
    expect(m.alt).toBe(acharExercicio(SUPINO).nome);
  });

  it("cai na figura quando não há ilustração", () => {
    const m = midiaDaMiniatura(SEM_ILUSTRACAO);
    expect(m.tipo).toBe("figura");
    expect(m.url).toBe(`/figuras/${SEM_ILUSTRACAO}.svg`);
  });

  it("todo exercício do catálogo tem miniatura", () => {
    for (const e of exercicios) {
      expect(midiaDaMiniatura(e.id).url).not.toBeNull();
    }
  });
});

describe("mapa anatômico (geometria MuscleMap, MIT)", () => {
  const svg = readFileSync(
    resolve(__dirname, "../assets/mapa-muscular/mapa-anatomico.svg"),
    "utf8",
  );

  it("o viewBox do arquivo é o que o componente desenha", () => {
    expect(svg).toContain(`viewBox="${VIEWBOX_MAPA_ANATOMICO}"`);
    const [, , largura, altura] = VIEWBOX_MAPA_ANATOMICO.split(" ");
    expect(PROPORCAO_MAPA_ANATOMICO).toBe(`${largura} / ${altura}`);
  });

  it("tem um grupo por músculo do catálogo, lendo a variável CSS", () => {
    const musculos = new Set(
      exercicios.flatMap((e) => [
        ...e.musculos_primarios,
        ...e.musculos_secundarios,
      ]),
    );
    for (const m of musculos) {
      expect(svg).toContain(`id="m-${m}"`);
      expect(svg).toContain(`var(--m-${m}`);
    }
  });
});

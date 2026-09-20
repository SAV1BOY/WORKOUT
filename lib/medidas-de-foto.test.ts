/**
 * `data/medidas-de-foto.json` contra os arquivos de verdade (SPEC §22.4
 * item 3).
 *
 * Este teste existe por causa de uma medida suposta: o app declarava 850×567
 * nas 162 fotos do kit, e dez delas medem outra coisa — seis são 850×1275 (a
 * derivada, limitada a 1200 px no maior lado, sai 800×1200) e quatro são
 * 850×569. A `<img>` da foto em tela cheia reservava uma caixa de proporção
 * 2,25× errada e pulava 287 px quando a imagem chegava (auditoria do lote 4).
 *
 * Por isso aqui ninguém repete a conta do `npm run assets`: o teste **abre**
 * cada foto de `assets/fotos` com o sharp e cobra do JSON o que o arquivo diz,
 * arquivo por arquivo. Quando `public/fotos` existe (qualquer build já rodou o
 * prebuild), a derivada também é medida e comparada.
 */
import { existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { medidasDeFoto } from "@/lib/dados";
import { medidaDaFoto } from "@/lib/midia";

const ASSETS = join(process.cwd(), "assets", "fotos");
const PUBLIC = join(process.cwd(), "public", "fotos");

/** Os nomes (sem extensão) das fotos de execução do kit. */
const nomes = readdirSync(ASSETS)
  .filter((f) => /\.jpe?g$/i.test(f))
  .map((f) => f.slice(0, f.length - extname(f).length))
  .sort();

type Par = [number, number];

const medido = new Map<string, { kit: Par; webp: Par | null }>();

beforeAll(async () => {
  for (const nome of nomes) {
    const kit = await sharp(join(ASSETS, `${nome}.jpg`)).metadata();
    const arquivoWebp = join(PUBLIC, `${nome}.webp`);
    const webp = existsSync(arquivoWebp)
      ? await sharp(arquivoWebp).metadata()
      : null;
    medido.set(nome, {
      kit: [kit.width!, kit.height!],
      webp: webp ? [webp.width!, webp.height!] : null,
    });
  }
}, 60_000);

describe("data/medidas-de-foto.json (SPEC §22.4 item 3)", () => {
  it("cobre exatamente as fotos de assets/fotos", () => {
    expect(nomes.length).toBeGreaterThan(100);
    expect(Object.keys(medidasDeFoto).sort()).toEqual(nomes);
  });

  it("declara a medida real de cada foto do kit", () => {
    const erradas = nomes.filter((nome) => {
      const declarada = medidasDeFoto[nome]?.kit;
      const real = medido.get(nome)!.kit;
      return declarada?.[0] !== real[0] || declarada[1] !== real[1];
    });
    expect(
      erradas.map(
        (n) =>
          `${n}: JSON ${medidasDeFoto[n]?.kit.join("×")} ≠ arquivo ${medido
            .get(n)!
            .kit.join("×")}`,
      ),
    ).toEqual([]);
  });

  it("declara a medida real de cada derivada WebP, que é o arquivo que a tela pede", () => {
    const comDerivada = nomes.filter((n) => medido.get(n)!.webp !== null);
    // sem `npm run assets` não há o que comparar — o teste do kit já rodou
    if (comDerivada.length === 0) return;
    const erradas = comDerivada.filter((nome) => {
      const declarada = medidasDeFoto[nome]?.webp;
      const real = medido.get(nome)!.webp!;
      return declarada?.[0] !== real[0] || declarada[1] !== real[1];
    });
    expect(
      erradas.map(
        (n) =>
          `${n}: JSON ${medidasDeFoto[n]?.webp.join("×")} ≠ arquivo ${medido
            .get(n)!
            .webp!.join("×")}`,
      ),
    ).toEqual([]);
  });

  it("a derivada guarda a proporção do kit e cabe em 1200 px", () => {
    for (const nome of nomes) {
      const { kit, webp } = medidasDeFoto[nome]!;
      expect(Math.max(webp[0], webp[1]), nome).toBeLessThanOrEqual(1200);
      expect(Math.abs(webp[0] / webp[1] - kit[0] / kit[1]), nome).toBeLessThan(0.005);
    }
  });

  it("pega uma foto que fuja da medida declarada", () => {
    // o que o teste acima teria dito se a foto tivesse mudado de tamanho
    const { kit } = medidasDeFoto["agachamento-bulgaro-1"]!;
    expect(kit).toEqual([850, 1275]);
    expect(medido.get("agachamento-bulgaro-1")!.kit).toEqual(kit);
  });
});

describe("medidaDaFoto (SPEC §22.4 item 3)", () => {
  it("devolve a medida da derivada para o .webp e a do kit para o .jpg", () => {
    expect(medidaDaFoto("/fotos/agachamento-bulgaro-1.webp")).toEqual({
      largura: 800,
      altura: 1200,
    });
    expect(medidaDaFoto("/fotos/agachamento-bulgaro-1.jpg")).toEqual({
      largura: 850,
      altura: 1275,
    });
    expect(medidaDaFoto("/fotos/agachamento-goblet-1.webp")).toEqual({
      largura: 850,
      altura: 569,
    });
    expect(medidaDaFoto("/fotos/agachamento-livre-1.webp")).toEqual({
      largura: 850,
      altura: 567,
    });
  });

  it("dá a medida do arquivo que cada <img> pede, foto por foto", () => {
    for (const nome of nomes) {
      const { kit, webp } = medidasDeFoto[nome]!;
      expect(medidaDaFoto(`/fotos/${nome}.jpg`), nome).toEqual({
        largura: kit[0],
        altura: kit[1],
      });
      expect(medidaDaFoto(`/fotos/${nome}.webp`), nome).toEqual({
        largura: webp[0],
        altura: webp[1],
      });
    }
  });

  it("não inventa medida para o que não é foto do kit", () => {
    // a foto de progresso do Corpo vem do storage do Supabase
    expect(
      medidaDaFoto("https://exemplo.supabase.co/storage/v1/object/fotos/eu.jpg"),
    ).toBeNull();
    // as derivadas de lista e de capa têm medida fixa, de quem as desenha
    expect(medidaDaFoto("/fotos/agachamento-livre-1-mini.webp")).toBeNull();
    expect(medidaDaFoto("/fotos/agachamento-livre-1-capa.webp")).toBeNull();
    expect(medidaDaFoto("/ilustracoes/agachamento-livre-1.webp")).toBeNull();
    expect(medidaDaFoto("/fotos/nao-existe-9.jpg")).toBeNull();
    expect(medidaDaFoto(null)).toBeNull();
    expect(medidaDaFoto(undefined)).toBeNull();
  });
});

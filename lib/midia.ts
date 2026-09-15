/**
 * Qual imagem cada tela mostra de um exercício (marco Mídia). Funções puras,
 * sem React e sem Supabase: quem decide é aqui, os componentes só desenham.
 *
 * A ordem é sempre a mesma (SPEC §13.1 e §14.2):
 *
 *   vídeo local (`assets/videos/<id>.mp4`, opcional)
 *   → **ilustração** com licença livre (`data/ilustracoes.json`)
 *   → figura animada do kit (`assets/figuras/<id>.svg`)
 *   → foto de execução (`assets/fotos/<id>-1.jpg`)
 *
 * Toda imagem sai de `assets/` pelo caminho que o JSON guarda — nenhum caminho
 * escrito à mão, nenhuma imagem de terceiros sem crédito registrado.
 */
import { acharExercicio, caminhoPublico, ilustracaoPorExercicio, urlFigura, urlFotos } from "@/lib/dados";
import type { Ilustracao } from "@/lib/schemas";
import { urlDoVideo } from "@/lib/videos.cliente";

export type TipoDeMidia = "video" | "ilustracao" | "figura" | "foto";

/** O crédito que fica sob a mídia — a CC BY-SA exige atribuição. */
export interface CreditoDaMidia {
  /** "Ilustração: Everkinetic (everkinetic.com), CC BY-SA 3.0" */
  texto: string;
  autor: string;
  licenca: string;
  url_fonte: string;
  titulo_fonte: string;
  fonte: Ilustracao["fonte"];
}

export interface IlustracaoDoExercicio {
  /** Uma URL por posição: início e, quando existe, fim do movimento. */
  urls: string[];
  /** Proporção da primeira posição, para reservar a caixa sem pular. */
  largura: number;
  altura: number;
  credito: CreditoDaMidia;
  correspondencia: Ilustracao["correspondencia"];
  nota: string;
}

export interface MidiaGrande {
  tipo: TipoDeMidia;
  /** Vídeo/figura/foto têm uma URL; a ilustração pode ter duas. */
  urls: string[];
  alt: string;
  credito: CreditoDaMidia | null;
}

export interface MidiaDaMiniatura {
  tipo: TipoDeMidia | null;
  url: string | null;
  alt: string;
}

function credito(i: Ilustracao): CreditoDaMidia {
  return {
    texto: `Ilustração: ${i.autor}, ${i.licenca}`,
    autor: i.autor,
    licenca: i.licenca,
    url_fonte: i.url_fonte,
    titulo_fonte: i.titulo_fonte,
    fonte: i.fonte,
  };
}

/** A ilustração deste exercício, já com as URLs públicas, ou `null`. */
export function ilustracaoDoExercicio(id: string): IlustracaoDoExercicio | null {
  const i = ilustracaoPorExercicio(id);
  if (!i) return null;
  const primeiro = i.arquivos[0]!;
  return {
    urls: i.arquivos.map((a) => caminhoPublico(a.arquivo)),
    largura: primeiro.largura,
    altura: primeiro.altura,
    credito: credito(i),
    correspondencia: i.correspondencia,
    nota: i.nota,
  };
}

/** Quantas posições a ilustração tem (2 = dá para alternar as duas). */
export function posicoesDaIlustracao(id: string): number {
  return ilustracaoDoExercicio(id)?.urls.length ?? 0;
}

/**
 * O que a aba **Vídeo** da ficha oferece no segmento "Ilustração · Figura ·
 * Fotos" — só o que o exercício realmente tem, na ordem de preferência.
 */
export function opcoesDeMidia(
  id: string,
  { temVideo = false }: { temVideo?: boolean } = {},
): TipoDeMidia[] {
  const exercicio = acharExercicio(id);
  const opcoes: TipoDeMidia[] = [];
  if (temVideo) opcoes.push("video");
  if (ilustracaoPorExercicio(id)) opcoes.push("ilustracao");
  if (urlFigura(exercicio)) opcoes.push("figura");
  if (urlFotos(exercicio).length > 0) opcoes.push("foto");
  return opcoes;
}

/**
 * A mídia grande da ficha, do player e da sessão. `tipo` força uma opção (o
 * segmento da ficha); sem ele vale a ordem de preferência. `semFoto` é para a
 * página inteira da ficha, onde as duas fotos já aparecem logo abaixo.
 */
export function midiaGrande(
  id: string,
  {
    temVideo = false,
    tipo,
    semFoto = false,
  }: { temVideo?: boolean; tipo?: TipoDeMidia; semFoto?: boolean } = {},
): MidiaGrande | null {
  const exercicio = acharExercicio(id);
  const alt = `Execução do ${exercicio.nome}`;
  const disponiveis = opcoesDeMidia(id, { temVideo }).filter(
    (o) => !(semFoto && o === "foto"),
  );
  const escolhido = tipo && disponiveis.includes(tipo) ? tipo : disponiveis[0];
  if (!escolhido) return null;

  if (escolhido === "video") {
    return { tipo: "video", urls: [urlDoVideo(id)], alt, credito: null };
  }
  if (escolhido === "ilustracao") {
    const i = ilustracaoDoExercicio(id)!;
    return { tipo: "ilustracao", urls: i.urls, alt, credito: i.credito };
  }
  if (escolhido === "figura") {
    return { tipo: "figura", urls: [urlFigura(exercicio)!], alt, credito: null };
  }
  return {
    tipo: "foto",
    urls: [urlFotos(exercicio)[0]!],
    alt: `${exercicio.nome} — início`,
    credito: null,
  };
}

/**
 * A miniatura das listas (aba Treino, descanso do player, catálogo, Explorar):
 * a primeira posição da ilustração, senão a figura, senão a foto.
 */
export function midiaDaMiniatura(id: string): MidiaDaMiniatura {
  const exercicio = acharExercicio(id);
  const alt = exercicio.nome;
  const ilustracao = ilustracaoDoExercicio(id);
  if (ilustracao) return { tipo: "ilustracao", url: ilustracao.urls[0]!, alt };
  const figura = urlFigura(exercicio);
  if (figura) return { tipo: "figura", url: figura, alt };
  const foto = urlFotos(exercicio)[0];
  if (foto) return { tipo: "foto", url: foto, alt };
  return { tipo: null, url: null, alt };
}

/** Todas as URLs de ilustração de um exercício (precache offline, §8). */
export function urlsDaIlustracao(id: string): string[] {
  return ilustracaoDoExercicio(id)?.urls ?? [];
}

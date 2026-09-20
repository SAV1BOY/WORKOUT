/**
 * Qual imagem cada tela mostra de um exercício (marco Mídia). Funções puras,
 * sem React e sem Supabase: quem decide é aqui, os componentes só desenham.
 *
 * A ordem é sempre a mesma (SPEC §15.2; veja também §13.1 e §14.2):
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
  /**
   * As dimensões do arquivo, quando o JSON as conhece (SPEC §22.4 item 3):
   * hoje só `data/ilustracoes.json` as guarda. Com elas o navegador reserva a
   * caixa antes de baixar a imagem e a tela para de pular.
   */
  largura: number | null;
  altura: number | null;
}

export interface MidiaDaMiniatura {
  tipo: TipoDeMidia | null;
  /** O arquivo original de `assets/` — a reserva, se a derivada faltar. */
  url: string | null;
  /** A derivada quadrada de 112 px (SPEC §22.4 item 1), quando existe. */
  mini: string | null;
  alt: string;
}

/*
 * As derivadas que `npm run assets` gera em `public/` (SPEC §22.4 item 1).
 * Aqui só se monta o nome: quem confere se o arquivo existe é o navegador, e o
 * componente volta para o original no `onError`. Nada de caminho escrito à mão
 * — todas saem da URL que o JSON já deu.
 */

/** As três pastas de `public/` que ganham derivada. */
const COM_DERIVADA = /^\/(fotos|itens|ilustracoes)\//;
/** Só estas viram WebP grande: a figura é SVG animado e fica como está. */
const COM_WEBP = /^\/(fotos|itens)\/.+\.jpe?g$/i;
/** A miniatura sai de foto, item e ilustração (SVG ou WebP). */
const COM_MINI = /^\/(fotos|itens)\/.+\.jpe?g$|^\/ilustracoes\/.+\.(webp|svg)$/i;

function trocarSufixo(url: string, sufixo: string): string {
  const ponto = url.lastIndexOf(".");
  return `${url.slice(0, ponto)}${sufixo}.webp`;
}

/** `/fotos/x-1.jpg` → `/fotos/x-1.webp` (a versão grande), senão `null`. */
export function urlWebp(url: string | null | undefined): string | null {
  if (!url || !COM_WEBP.test(url)) return null;
  return trocarSufixo(url, "");
}

/** `/fotos/x-1.jpg` → `/fotos/x-1-mini.webp` (112×112), senão `null`. */
export function urlMiniatura(url: string | null | undefined): string | null {
  if (!url || !COM_MINI.test(url)) return null;
  return trocarSufixo(url, "-mini");
}

/** Um arquivo de `public/` que tem alguma derivada gerada no prebuild. */
export function temDerivada(url: string | null | undefined): boolean {
  return Boolean(url && COM_DERIVADA.test(url));
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

/**
 * A nota que a legenda mostra quando a ilustração é só **aproximada** (SPEC
 * §15.2 e §22.2 item 6): sete exercícios não têm o movimento exato na coleção
 * livre, e o JSON guarda a frase que explica a diferença. Ilustração exata não
 * tem nota para mostrar, mesmo quando o JSON descreve a figura.
 */
export function notaDaIlustracao(id: string): string | null {
  const i = ilustracaoDoExercicio(id);
  if (!i || i.correspondencia !== "aproximada") return null;
  const nota = i.nota.trim();
  return nota === "" ? null : nota;
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

  const semMedida = { largura: null, altura: null };

  if (escolhido === "video") {
    return { tipo: "video", urls: [urlDoVideo(id)], alt, credito: null, ...semMedida };
  }
  if (escolhido === "ilustracao") {
    const i = ilustracaoDoExercicio(id)!;
    return {
      tipo: "ilustracao",
      urls: i.urls,
      alt,
      credito: i.credito,
      largura: i.largura,
      altura: i.altura,
    };
  }
  if (escolhido === "figura") {
    return {
      tipo: "figura",
      urls: [urlFigura(exercicio)!],
      alt,
      credito: null,
      ...semMedida,
    };
  }
  return {
    tipo: "foto",
    urls: [urlFotos(exercicio)[0]!],
    alt: `${exercicio.nome} — início`,
    credito: null,
    ...semMedida,
  };
}

/**
 * A miniatura das listas (aba Treino, descanso do player, catálogo, Explorar):
 * a primeira posição da ilustração, senão a figura, senão a foto.
 */
export function midiaDaMiniatura(id: string): MidiaDaMiniatura {
  const exercicio = acharExercicio(id);
  const alt = exercicio.nome;
  const escolher = (tipo: TipoDeMidia, url: string): MidiaDaMiniatura => ({
    tipo,
    url,
    mini: urlMiniatura(url),
    alt,
  });
  const ilustracao = ilustracaoDoExercicio(id);
  if (ilustracao) return escolher("ilustracao", ilustracao.urls[0]!);
  const figura = urlFigura(exercicio);
  if (figura) return escolher("figura", figura);
  const foto = urlFotos(exercicio)[0];
  if (foto) return escolher("foto", foto);
  return { tipo: null, url: null, mini: null, alt };
}

/** Todas as URLs de ilustração de um exercício (precache offline, §8). */
export function urlsDaIlustracao(id: string): string[] {
  return ilustracaoDoExercicio(id)?.urls ?? [];
}

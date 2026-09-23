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
import {
  acharExercicio,
  caminhoPublico,
  ilustracaoPorExercicio,
  medidasDeFoto,
  urlFigura,
  urlFotos,
} from "@/lib/dados";
import type { Ilustracao } from "@/lib/schemas";
import { urlDoVideo } from "@/lib/videos.cliente";

export type TipoDeMidia = "video" | "ilustracao" | "figura" | "foto";

/**
 * O crédito que fica sob a mídia — a CC BY-SA exige atribuição. Só os dados:
 * o texto ("Ilustração: <autor> · <licença>", com os dois links) é montado
 * num lugar só, `components/exercicio/media-grande.tsx` (SPEC §22.13 item 3).
 */
export interface CreditoDaMidia {
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
   * As dimensões da ilustração, que `data/ilustracoes.json` guarda (SPEC §22.4
   * item 3). Com elas o navegador reserva a caixa antes de baixar a imagem e a
   * tela para de pular. Vídeo, figura e foto vêm sem: a figura tem o `viewBox`
   * fixo (`MEDIDA_DA_FIGURA`) e a foto tem a medida do próprio arquivo, que
   * `medidaDaFoto` lê de `data/medidas-de-foto.json` já sabendo qual arquivo a
   * tela vai pedir.
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

/**
 * Só a foto de execução vira WebP grande: a figura é SVG animado e fica como
 * está, e o item de equipamento nunca aparece maior que a caixa de 56 px —
 * gerar a versão grande dele era 85 arquivos que ninguém pedia (auditoria do
 * lote 4).
 */
const COM_WEBP = /^\/fotos\/.+\.jpe?g$/i;
/** A miniatura sai de foto, item e ilustração (SVG ou WebP). */
const COM_MINI = /^\/(fotos|itens)\/.+\.jpe?g$|^\/ilustracoes\/.+\.(webp|svg)$/i;

function trocarSufixo(url: string, sufixo: string): string {
  const ponto = url.lastIndexOf(".");
  return `${url.slice(0, ponto)}${sufixo}.webp`;
}

/**
 * `/fotos/x-1.jpg` → `/fotos/x-1.webp` (a versão grande), senão `null`.
 *
 * É o que a ficha do exercício e a foto em tela cheia pedem: 44 kB no lugar
 * dos 70 kB do JPEG do kit, na mesma proporção (o `fit: inside` do sharp não
 * corta nada; só as seis fotos de 850×1275 encolhem para 800×1200, por causa
 * do limite de 1200 px no maior lado). Quem chama passa o original como
 * reserva (`fonteComReserva`), para a tela continuar desenhando num build sem
 * `npm run assets`.
 */
export function urlWebp(url: string | null | undefined): string | null {
  if (!url || !COM_WEBP.test(url)) return null;
  return trocarSufixo(url, "");
}

/** `/fotos/x-1.jpg` → `/fotos/x-1-mini.webp` (112×112), senão `null`. */
export function urlMiniatura(url: string | null | undefined): string | null {
  if (!url || !COM_MINI.test(url)) return null;
  return trocarSufixo(url, "-mini");
}

export interface MedidaDaImagem {
  largura: number;
  altura: number;
}

/** As 67 figuras animadas do kit compartilham o mesmo `viewBox` 132×100. */
export const MEDIDA_DA_FIGURA: MedidaDaImagem = { largura: 132, altura: 100 };

/** `/fotos/<nome>.jpg` ou `/fotos/<nome>.webp` — nome e extensão. */
const FOTO_DO_KIT = /^\/fotos\/([^/]+)\.(jpe?g|webp)$/i;

/**
 * A medida do arquivo que a `<img>` pede, para reservar a caixa antes de a
 * imagem chegar (SPEC §22.4 item 3).
 *
 * As medidas saem de `data/medidas-de-foto.json`, que `npm run assets` gera
 * abrindo foto por foto com o sharp — as 162 fotos do kit **não** são
 * uniformes: 152 medem 850×567, seis medem 850×1275 (derivada 800×1200) e
 * quatro medem 850×569. Declarar uma medida só punha a foto em tela cheia a
 * reservar 344×229 e a pular para 344×516 quando o arquivo chegava — o salto
 * que este item existe para eliminar (auditoria do lote 4).
 *
 * Devolve `null` quando a URL não é foto de exercício do kit: a foto de
 * progresso do Corpo vem do storage do Supabase e ninguém aqui sabe quanto ela
 * mede, e as derivadas `-mini`/`-capa` têm medida fixa, declarada por quem as
 * desenha.
 */
export function medidaDaFoto(url: string | null | undefined): MedidaDaImagem | null {
  if (!url) return null;
  const caminho = url.startsWith("http") ? new URL(url).pathname : url;
  const achado = FOTO_DO_KIT.exec(caminho);
  if (!achado) return null;
  const medidas = medidasDeFoto[achado[1]!];
  if (!medidas) return null;
  // a `<img>` diz o tamanho do arquivo que ela pede, não o do irmão
  const [largura, altura] =
    achado[2]!.toLowerCase() === "webp" ? medidas.webp : medidas.kit;
  return { largura, altura };
}

function credito(i: Ilustracao): CreditoDaMidia {
  return {
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

/* --------------------------------- a caixa da ilustração (SPEC §22.13) */

/**
 * Teto da altura da figura na ficha (SPEC §22.13 item 1): a 360×740 a figura
 * mais alta (0,35:1) cabe inteira e o goblet (0,42:1) passa de 180 px de
 * largura — o que a caixa de altura fixa espremia em 81 px.
 */
export const ALTURA_MAXIMA_DA_ILUSTRACAO = 432;

/** O respiro entre a figura e a borda da caixa (o `p-2` de cada lado). */
export const FOLGA_DA_ILUSTRACAO = 8;

export interface CaixaDaIlustracao {
  /** O `aspect-ratio` da área da figura: o par do próprio arquivo. */
  proporcao: string;
  /**
   * A largura máxima da caixa, com a folga: a figura alta estreita a caixa
   * (e ela fica centrada) em vez de ficar espremida numa caixa larga.
   */
  larguraMaxima: number;
}

/**
 * A caixa da ilustração na ficha (SPEC §22.13 item 1): a proporção é a da
 * ilustração (`data/ilustracoes.json`), e a altura da figura para no teto —
 * a figura larga ocupa a largura toda, a alta estreita a caixa.
 */
export function caixaDaIlustracao(
  medida: MedidaDaImagem,
  alturaMaxima: number = ALTURA_MAXIMA_DA_ILUSTRACAO,
): CaixaDaIlustracao {
  const razao = medida.largura / medida.altura;
  return {
    proporcao: `${medida.largura} / ${medida.altura}`,
    larguraMaxima: Math.round(alturaMaxima * razao) + 2 * FOLGA_DA_ILUSTRACAO,
  };
}

/**
 * O que a caixa desenha numa coluna de `larguraDaColuna` px: a largura da
 * caixa, a da figura e a fração que a figura ocupa. É a mesma conta que o
 * CSS faz (`width: min(100%, larguraMaxima)` e `aspect-ratio` na área da
 * figura), para o teste medir o que a tela mostra.
 */
export function figuraNaCaixa(
  medida: MedidaDaImagem,
  larguraDaColuna: number,
  alturaMaxima: number = ALTURA_MAXIMA_DA_ILUSTRACAO,
): { caixa: number; figura: number; alturaDaFigura: number; fracao: number } {
  const { larguraMaxima } = caixaDaIlustracao(medida, alturaMaxima);
  const caixa = Math.min(larguraDaColuna, larguraMaxima);
  const figura = caixa - 2 * FOLGA_DA_ILUSTRACAO;
  return {
    caixa,
    figura,
    alturaDaFigura: (figura * medida.altura) / medida.largura,
    fracao: caixa > 0 ? figura / caixa : 0,
  };
}

/**
 * A página da licença na Creative Commons, derivada do código que o JSON
 * guarda ("CC BY-SA 3.0" → `https://creativecommons.org/licenses/by-sa/3.0/`).
 * É o segundo link do crédito (SPEC §22.13 item 3). Código que não é de
 * licença CC devolve `null` e a licença fica como texto.
 */
export function urlDaLicenca(licenca: string): string | null {
  const achado = /^CC\s+((?:BY|SA|NC|ND)(?:-(?:BY|SA|NC|ND))*)\s+(\d+\.\d+)$/i.exec(
    licenca.trim(),
  );
  if (!achado) return null;
  return `https://creativecommons.org/licenses/${achado[1]!.toLowerCase()}/${achado[2]}/`;
}

/**
 * A proporção da caixa de uma foto de execução (SPEC §22.13 item 2): a do
 * próprio arquivo (`data/medidas-de-foto.json`), para o `object-cover` não
 * cortar nada; 3:2, a das fotos do kit, quando a medida não é conhecida.
 */
export function proporcaoDaFoto(url: string | null | undefined): string {
  const medida = medidaDaFoto(url);
  return medida ? `${medida.largura} / ${medida.altura}` : "3 / 2";
}

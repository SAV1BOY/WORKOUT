"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ilustracaoAlternando } from "@/lib/preferencias";
import { cn } from "@/lib/utils";

/** Quanto tempo cada posição fica na tela antes de trocar. */
const MS_POR_POSICAO = 1200;

/**
 * `prefers-reduced-motion: reduce`, acompanhado enquanto a tela está aberta —
 * a pessoa pode ligar a preferência no sistema com o app já aberto.
 *
 * Começa em `false` de propósito: o servidor não tem como saber a preferência,
 * e divergir dele na primeira pintura é erro de hidratação. O efeito corrige
 * antes de qualquer quadro aparecer.
 */
function usePrefereMenosMovimento(): boolean {
  const [menos, setMenos] = useState(false);
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ler = () => setMenos(consulta.matches);
    ler();
    consulta.addEventListener("change", ler);
    return () => consulta.removeEventListener("change", ler);
  }, []);
  return menos;
}

/** `document.hidden`: a aba escondida não anima (SPEC §22.1). */
function useAbaEscondida(): boolean {
  const [escondido, setEscondido] = useState(false);
  useEffect(() => {
    const ler = () => setEscondido(document.hidden);
    ler();
    document.addEventListener("visibilitychange", ler);
    return () => document.removeEventListener("visibilitychange", ler);
  }, []);
  return escondido;
}

/**
 * As duas posições da ilustração em transição alternada (marco Mídia): em vez
 * de gerar um GIF, o navegador faz o crossfade entre as duas imagens que já
 * estão em `assets/ilustracoes/` — ~1,2 s por posição.
 *
 * SPEC §22.13 item 5: a figura **não** é o botão de pausa. A pausa é um botão
 * próprio de 44×44 no canto ("Parar a animação" / "Voltar a alternar"); a
 * figura diz a posição ("…, posição 1 de 2") e, quando a tela tem um "Como
 * fazer" (`aoAbrir`), tocar nela abre a ficha. Sem `aoAbrir` a figura não é
 * botão — na própria ficha ela já é o "Como fazer".
 *
 * SPEC §22.13 item 4: a segunda posição só entra no DOM (e só é pedida) depois
 * que a primeira carregou **e** a ilustração vai alternar — ela não disputa a
 * primeira pintura com a primeira posição. A troca de 1,2 s só começa depois
 * que ela chegou (`onLoad`).
 *
 * Com `prefers-reduced-motion: reduce` ela **nasce parada**, e o botão do
 * canto continua valendo para quem quiser ver o movimento (SPEC §22.1).
 *
 * Com uma posição só — ou quando a segunda não chega — não há animação nem
 * botão de pausa: é uma imagem parada.
 */
export function IlustracaoAlternada({
  urls,
  alt,
  largura = null,
  altura = null,
  className,
  proporcao,
  larguraMaxima,
  aoAbrir,
  rotuloDoAbrir,
}: {
  urls: string[];
  alt: string;
  /** Dimensões do arquivo (data/ilustracoes.json) — SPEC §22.4 item 3. */
  largura?: number | null;
  altura?: number | null;
  className?: string;
  /**
   * SPEC §22.13 item 1: a proporção da área da figura (o par do arquivo) e a
   * largura máxima da caixa — a caixa acompanha a figura em vez de ter altura
   * fixa. Sem elas, a caixa tem a altura que o `className` der.
   */
  proporcao?: string;
  larguraMaxima?: number;
  /** Abre o "Como fazer" (a ficha) — no player e na lista do treino. */
  aoAbrir?: () => void;
  /** O nome acessível do toque na figura, quando ela abre a ficha. */
  rotuloDoAbrir?: string;
}) {
  const [posicao, setPosicao] = useState(0);
  /** `null` = ninguém tocou ainda: quem decide é a preferência do sistema. */
  const [escolha, setEscolha] = useState<boolean | null>(null);
  /** A primeira posição já chegou (a segunda só é pedida depois). */
  const [primeiraPronta, setPrimeiraPronta] = useState(false);
  /**
   * Quantas das outras posições já chegaram. A troca só começa quando todas
   * estão prontas (correção da auditoria 2): com rede lenta, ou parada por
   * `prefers-reduced-motion` (quando o quadro 2 nem foi pedido), trocar antes
   * fazia o fade até uma caixa vazia.
   */
  const [restoProntas, setRestoProntas] = useState(0);
  const restoPronto = restoProntas >= urls.length - 1;
  /**
   * Correção da auditoria 3 (SPEC §22.13 item 4): o quadro 2 não chegou (erro,
   * ou sem rede e fora do cache). A figura nunca vai alternar, então ela vira a
   * imagem parada de um quadro — sem o "Parar a animação" de uma animação que
   * não começa.
   */
  const [restoFalhou, setRestoFalhou] = useState(false);
  /**
   * A posição que o leitor de tela ouve (correção da auditoria 2): enquanto a
   * figura-botão tem o foco, ela fica congelada na posição de quando o foco
   * chegou — a troca a cada 1,2 s não faz o leitor repetir o anúncio.
   */
  const [posicaoNoFoco, setPosicaoNoFoco] = useState<number | null>(null);
  const idDaPosicao = useId();
  const primeira = useRef<HTMLImageElement>(null);
  const menosMovimento = usePrefereMenosMovimento();
  const escondido = useAbaEscondida();
  const duasPosicoes = urls.length > 1 && !restoFalhou;
  const alternando = ilustracaoAlternando({
    duasPosicoes,
    escolha,
    menosMovimento,
    escondido,
  });
  /*
   * Pedir as outras posições: só com a primeira pronta e a animação para
   * começar. Uma vez pedidas, ficam (pausar não tira a imagem da tela).
   */
  const [pedirResto, setPedirResto] = useState(false);
  useEffect(() => {
    if (primeiraPronta && alternando) setPedirResto(true);
  }, [primeiraPronta, alternando]);

  // o `load` pode ter acontecido antes da hidratação: confere o `complete`
  useEffect(() => {
    const img = primeira.current;
    if (img?.complete && img.naturalWidth > 0) setPrimeiraPronta(true);
  }, []);

  useEffect(() => {
    if (!alternando || !pedirResto || !restoPronto) return;
    const id = setInterval(
      () => setPosicao((v) => (v + 1) % urls.length),
      MS_POR_POSICAO,
    );
    return () => clearInterval(id);
  }, [alternando, pedirResto, restoPronto, urls.length]);

  const imagens = urls.map((url, i) =>
    i > 0 && !pedirResto ? null : (
      // eslint-disable-next-line @next/next/no-img-element -- imagem local em /public, caixa de tamanho fixo
      <img
        key={url}
        ref={i === 0 ? primeira : undefined}
        src={url}
        alt=""
        aria-hidden="true"
        width={largura ?? undefined}
        height={altura ?? undefined}
        loading={i === 0 ? "lazy" : "eager"}
        decoding="async"
        onLoad={
          i === 0
            ? () => setPrimeiraPronta(true)
            : () => setRestoProntas((n) => n + 1)
        }
        onError={i === 0 ? undefined : () => setRestoFalhou(true)}
        className={cn(
          "absolute inset-0 size-full object-contain transition-opacity duration-500 ease-in-out",
          i === posicao ? "opacity-100" : "opacity-0",
        )}
      />
    ),
  );

  const nome = duasPosicoes
    ? `${alt}, posição ${posicao + 1} de ${urls.length}`
    : alt;
  /*
   * A figura-botão (player e Visão geral) é focável: o nome dela é estável —
   * "<alt> — abre o Como fazer" — e a posição vai na descrição, congelada
   * enquanto o foco está nela (correção da auditoria 2, SPEC §22.13 item 5).
   */
  const nomeDoBotao = rotuloDoAbrir ? `${alt} — ${rotuloDoAbrir}` : alt;
  const posicaoDita = (posicaoNoFoco ?? posicao) + 1;

  const caixa = cn(
    "bg-ilustracao relative block w-full overflow-hidden rounded-xl",
    proporcao && "mx-auto",
    className,
  );
  const estilo = proporcao && larguraMaxima ? { maxWidth: larguraMaxima } : undefined;

  // a área da figura: o respiro (`p-2`) fica fora dela, a proporção dentro
  const area = cn("block p-2", proporcao ? "w-full" : "size-full");
  const miolo = (
    <span
      className={cn("relative block w-full", !proporcao && "h-full")}
      style={proporcao ? { aspectRatio: proporcao } : undefined}
      data-area-figura
    >
      {imagens}
    </span>
  );
  const figura = aoAbrir ? (
    <>
      <button
        type="button"
        onClick={aoAbrir}
        onFocus={() => setPosicaoNoFoco(posicao)}
        onBlur={() => setPosicaoNoFoco(null)}
        aria-label={nomeDoBotao}
        aria-describedby={duasPosicoes ? idDaPosicao : undefined}
        data-figura="abre"
        /*
          SPEC §22.13 item 5 (correção da auditoria 2): a caixa corta o que
          passa da borda (`overflow-hidden`), então o anel de foco deste botão
          é interno — `[data-figura="abre"]` em `app/globals.css` — e segue o
          arredondado da caixa.
        */
        className={cn(area, "rounded-[inherit]")}
      >
        {miolo}
      </button>
      {duasPosicoes ? (
        <span id={idDaPosicao} hidden>
          {`posição ${posicaoDita} de ${urls.length}`}
        </span>
      ) : null}
    </>
  ) : (
    <span role="img" aria-label={nome} data-figura="parada" className={area}>
      {miolo}
    </span>
  );

  if (!duasPosicoes) {
    return (
      <span className={caixa} style={estilo} data-ilustracao="parada" data-posicao="1">
        {figura}
      </span>
    );
  }

  return (
    <span
      className={caixa}
      style={estilo}
      data-ilustracao={alternando ? "alternando" : "pausada"}
      data-posicao={posicao + 1}
    >
      {figura}
      <button
        type="button"
        data-pausa
        aria-label={alternando ? "Parar a animação" : "Voltar a alternar"}
        onClick={() => {
          if (alternando) {
            setEscolha(true);
            return;
          }
          setEscolha(false);
          setPedirResto(true);
          /*
           * O toque sempre muda algo na tela (o ícone vira a pausa). A posição
           * só troca já se a próxima imagem chegou; senão a troca começa
           * quando ela carregar (correção da auditoria 2) — nunca um fade
           * até uma caixa vazia.
           */
          if (restoPronto) setPosicao((p) => (p + 1) % urls.length);
        }}
        className="bg-background/85 text-foreground border-border absolute right-1 bottom-1 z-10 flex size-11 items-center justify-center rounded-full border shadow-sm"
      >
        {alternando ? (
          <Pause aria-hidden="true" className="size-4" />
        ) : (
          <Play aria-hidden="true" className="size-4" />
        )}
      </button>
    </span>
  );
}

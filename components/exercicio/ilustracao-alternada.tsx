"use client";

import { useEffect, useState } from "react";
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
 * estão em `assets/ilustracoes/` — ~1,2 s por posição. Um toque pausa (ou
 * volta a alternar), para quem quiser olhar o início ou o fim com calma.
 *
 * Com `prefers-reduced-motion: reduce` ela **nasce parada**, e o mesmo toque
 * continua valendo para quem quiser ver o movimento (SPEC §22.1).
 *
 * Com uma posição só não há animação nem botão: é uma imagem parada.
 */
export function IlustracaoAlternada({
  urls,
  alt,
  className,
}: {
  urls: string[];
  alt: string;
  className?: string;
}) {
  const [posicao, setPosicao] = useState(0);
  /** `null` = ninguém tocou ainda: quem decide é a preferência do sistema. */
  const [escolha, setEscolha] = useState<boolean | null>(null);
  const menosMovimento = usePrefereMenosMovimento();
  const escondido = useAbaEscondida();
  const duasPosicoes = urls.length > 1;
  const alternando = ilustracaoAlternando({
    duasPosicoes,
    escolha,
    menosMovimento,
    escondido,
  });

  useEffect(() => {
    if (!alternando) return;
    const id = setInterval(
      () => setPosicao((v) => (v + 1) % urls.length),
      MS_POR_POSICAO,
    );
    return () => clearInterval(id);
  }, [alternando, urls.length]);

  const imagens = urls.map((url, i) => (
    // eslint-disable-next-line @next/next/no-img-element -- imagem local em /public, caixa de tamanho fixo
    <img
      key={url}
      src={url}
      alt={i === 0 ? alt : ""}
      aria-hidden={i === 0 ? undefined : true}
      className={cn(
        "absolute inset-0 size-full object-contain p-2 transition-opacity duration-500 ease-in-out",
        i === posicao ? "opacity-100" : "opacity-0",
      )}
    />
  ));

  const caixa = cn(
    "bg-ilustracao relative block w-full overflow-hidden rounded-xl",
    className,
  );

  if (!duasPosicoes) {
    return (
      <span className={caixa} data-ilustracao="parada" data-posicao="1">
        {imagens}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-ilustracao={alternando ? "alternando" : "pausada"}
      data-posicao={posicao + 1}
      aria-label={
        alternando ? "Parar em uma posição" : "Voltar a alternar as posições"
      }
      onClick={() => {
        if (alternando) {
          setEscolha(true);
          return;
        }
        setEscolha(false);
        // o toque sempre muda algo na tela: ao voltar a alternar, já troca
        setPosicao((p) => (p + 1) % urls.length);
      }}
      className={caixa}
    >
      {imagens}
    </button>
  );
}

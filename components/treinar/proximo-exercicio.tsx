"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import type { BlocoLocal } from "@/lib/sessao";

export interface ContextoProximo {
  origem: number;
  proximo: number;
  candidatos: readonly number[];
  entreBlocos: boolean;
  escolher: (ordem: number) => Promise<boolean>;
}

function mostrarAcimaDoRodape(el: HTMLElement) {
  const rodape = el.closest('[role="dialog"]')?.querySelector("[data-rodape-do-treino]");
  const caixa = el.getBoundingClientRect();
  if (caixa.top < 0 || caixa.bottom > (rodape?.getBoundingClientRect().top ?? window.innerHeight)) {
    el.scrollIntoView({ block: "start", behavior: "instant" });
  }
}

export function ProximoExercicio({ contexto, blocos, aoPerderOpcoes }: {
  contexto?: ContextoProximo;
  blocos: readonly BlocoLocal[];
  aoPerderOpcoes: () => void;
}) {
  const id = useId();
  const controle = useRef<HTMLButtonElement>(null);
  const regiao = useRef<HTMLDivElement>(null);
  const devolverFoco = useRef(false);
  const emGravacao = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [abertura, setAbertura] = useState<{ contexto: ContextoProximo; blocos: readonly BlocoLocal[] } | null>(null);
  const mostrarControle = abertura || contexto?.candidatos.length;

  function recolher(focoAoEscolher?: Element | null) {
    const ativo = document.activeElement;
    devolverFoco.current = Boolean(regiao.current?.contains(ativo) || ativo === focoAoEscolher);
    setAbertura(null);
  }
  useLayoutEffect(() => {
    if (abertura || !devolverFoco.current) return;
    devolverFoco.current = false;
    if (controle.current) {
      controle.current.focus({ preventScroll: true });
      mostrarAcimaDoRodape(controle.current);
    } else {
      aoPerderOpcoes();
    }
  }, [abertura, aoPerderOpcoes]);

  async function escolher(ordem: number, nome: string) {
    if (!abertura || emGravacao.current) return;
    // Alguns navegadores de toque mantêm o foco anterior ao ativar um botão.
    const focoAoEscolher = document.activeElement;
    emGravacao.current = true;
    setGravando(true);
    setAviso("Guardando a sequência…");
    try {
      const confirmou = await abertura.contexto.escolher(ordem);
      setAviso(confirmou ? `Próximo exercício: ${nome}.` : "O treino mudou. Confira a sequência antes de escolher novamente.");
      recolher(focoAoEscolher);
    } catch {
      setAviso("Não foi possível guardar a sequência. Tente de novo.");
    } finally {
      emGravacao.current = false;
      setGravando(false);
    }
  }

  if (!mostrarControle && !aviso) return null;
  return (
    <div ref={regiao} className="flex min-w-0 flex-col gap-2" onFocus={evento => {
      if (evento.target.matches(":focus-visible")) mostrarAcimaDoRodape(evento.target);
    }} onKeyDown={evento => {
      if (!abertura || evento.key !== "Escape") return;
      evento.preventDefault();
      if (!emGravacao.current) recolher();
    }}>
      {Boolean(mostrarControle) && (
        <Button ref={controle} type="button" variant="outline" aria-expanded={Boolean(abertura)}
          aria-controls={id} aria-disabled={gravando} className="alvo h-auto w-full scroll-mt-2 gap-2 px-2 py-2 whitespace-normal"
          onClick={() => {
            if (emGravacao.current) return;
            if (abertura) recolher();
            else if (contexto) {
              setAviso("");
              setAbertura({ contexto, blocos });
            }
          }}>
          Próximo exercício
          <ChevronDown aria-hidden="true" className={abertura ? "size-4 rotate-180" : "size-4"} />
        </Button>
      )}
      <div id={id} hidden={!abertura}>
        {abertura && (
          <>
            <p className="text-muted-foreground mb-1 text-sm wrap-anywhere">
              {abertura.contexto.entreBlocos ? "Escolha o exercício que começa ao terminar este descanso."
                : "Escolha o exercício que vem depois do atual."}
            </p>
            <ul aria-label="Exercícios para fazer a seguir" className="divide-y">
              {abertura.contexto.candidatos.map(ordem => {
                const bloco = abertura.blocos.find(b => b.ordem === ordem);
                if (!bloco) return null;
                const nome = acharExercicio(bloco.exercicioId).nome;
                return (
                  <li key={ordem}>
                    <button type="button" aria-label={`Fazer ${nome} a seguir`} aria-disabled={gravando}
                      className="foco alvo hover:bg-muted w-full scroll-mt-2 rounded-md px-2 py-2 text-left text-sm font-medium wrap-anywhere"
                      onClick={() => void escolher(ordem, nome)}>{nome}</button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <p role="status" className={aviso ? "text-muted-foreground text-sm wrap-anywhere" : "sr-only"}>{aviso}</p>
    </div>
  );
}

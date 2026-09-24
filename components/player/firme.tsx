"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { nomeAcessivel } from "@/lib/midia";
import { cn } from "@/lib/utils";

/** O tempo que o marcador fica aceso antes de a tela virar (SPEC §22.5). */
const ESPERA_DO_AVANCO_MS = 350;

type Escolha = "Fácil" | "Firme" | "Falhei";

/**
 * "Última repetição saiu firme?" no fim de cada exercício (SPEC §14.1.2).
 * É este valor que o motor usa (`session_sets.ultima_firme`): Fácil e Firme
 * gravam `true`, Falhei grava `false`.
 *
 * SPEC §22.5 item 4: a pergunta **não vem respondida**. O palpite do motor
 * aparece como dica em texto, nenhuma opção nasce com `aria-checked`, e o
 * toque numa delas acende o marcador por {@link ESPERA_DO_AVANCO_MS} ms antes
 * de a tela virar — antes o avanço era no mesmo tique e ninguém via o que
 * tinha escolhido.
 */
export function TelaFirme({
  exercicioId,
  firme,
  nota,
  aoResponder,
  aoMudarNota,
  aoSeguir,
  aoVoltar,
}: {
  exercicioId: string;
  /** O palpite do motor pelas repetições — dica, nunca resposta. */
  firme: boolean;
  nota: string | null;
  aoResponder: (firme: boolean) => void;
  aoMudarNota: (nota: string) => void;
  aoSeguir: () => void;
  aoVoltar: () => void;
}) {
  const exercicio = acharExercicio(exercicioId);
  /*
   * A coluna do banco é um booleano (`ultima_firme`), mas a referência tem
   * três botões: "Fácil" e "Firme" gravam o mesmo `true`. Qual dos dois foi
   * tocado fica só na tela, para o marcador não acender nos dois — e começa
   * em `null`, porque ninguém respondeu ainda.
   */
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seguir = useRef(aoSeguir);
  useEffect(() => {
    seguir.current = aoSeguir;
  });
  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current);
    },
    [],
  );

  const responder = (rotulo: Escolha, valor: boolean) => {
    if (escolha !== null) return;
    setEscolha(rotulo);
    aoResponder(valor);
    relogio.current = setTimeout(() => seguir.current(), ESPERA_DO_AVANCO_MS);
  };

  return (
    <section
      aria-label="Última repetição"
      className="flex flex-1 flex-col justify-center gap-5 px-4 py-8"
    >
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-muted-foreground text-sm">{exercicio.nome}</p>
        <h2 className="text-2xl font-semibold text-balance">
          Última repetição saiu firme?
        </h2>
        <p className="text-muted-foreground text-sm text-balance">
          É isto que o motor usa para decidir a carga do próximo treino.
          {" "}
          {firme
            ? "Pelas repetições, parece que saiu firme."
            : "Pelas repetições, parece que você falhou nesta."}
        </p>
      </header>

      {/*
        A nota vem ANTES dos três botões (auditoria do marco V2): tocar num
        deles já responde e sai da tela, como na referência — com a nota
        embaixo, quem quisesse escrever teria de escrever antes de escolher,
        ao contrário da ordem de leitura.
      */}
      <input
        value={nota ?? ""}
        onChange={(e) => aoMudarNota(e.target.value)}
        placeholder="Nota curta (opcional)"
        aria-label={nomeAcessivel("Nota", exercicio.nome)}
        className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring h-12 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-3"
      />

      <div role="radiogroup" aria-label="Última repetição" className="flex flex-col gap-2">
        <Opcao
          rotulo="Fácil"
          marcada={escolha === "Fácil"}
          aoTocar={() => responder("Fácil", true)}
        />
        <Opcao
          rotulo="Firme"
          marcada={escolha === "Firme"}
          aoTocar={() => responder("Firme", true)}
        />
        <Opcao
          rotulo="Falhei"
          marcada={escolha === "Falhei"}
          aoTocar={() => responder("Falhei", false)}
        />
      </div>

      {/*
        SPEC §22.5 item 5: o "Voltar" tinha o tratamento IDÊNTICO ao das três
        opções (h-14, rounded-2xl, contorno), e parecia a quarta. Agora é o
        botão padrão do projeto, ao lado de um primário que diz a verdade
        enquanto ninguém responde.
      */}
      <div className="flex items-center gap-2">
        <Button variant="outline" className="alvo" onClick={aoVoltar}>
          Voltar
        </Button>
        <Button
          size="xl"
          className="alvo flex-1 rounded-2xl font-semibold"
          onClick={aoSeguir}
        >
          {escolha === null ? "Pular esta pergunta" : "Continuar"}
        </Button>
      </div>
    </section>
  );
}

function Opcao({
  rotulo,
  marcada,
  aoTocar,
}: {
  rotulo: string;
  marcada: boolean;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      onClick={aoTocar}
      className={cn(
        "alvo flex h-14 items-center justify-center rounded-2xl border text-base font-medium",
        /* SPEC §22.5 item 5: `bg-background` era a cor exata da página no
           tema claro (1,00:1) — as cinco opções só existiam pela borda. */
        marcada ? "border-primary bg-primary/10" : "border-input bg-card",
      )}
    >
      {rotulo}
    </button>
  );
}

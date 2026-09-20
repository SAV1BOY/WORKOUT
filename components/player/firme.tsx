"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { cn } from "@/lib/utils";

/**
 * "Última repetição saiu firme?" no fim de cada exercício (SPEC §14.1.2).
 * É este valor que o motor usa (`session_sets.ultima_firme`): Fácil e Firme
 * gravam `true`, Falhei grava `false`.
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
   * tocado fica só na tela, para o marcador não acender nos dois.
   */
  const [escolha, setEscolha] = useState<"Fácil" | "Firme" | "Falhei">(
    firme ? "Firme" : "Falhei",
  );

  const responder = (rotulo: "Fácil" | "Firme" | "Falhei", valor: boolean) => {
    setEscolha(rotulo);
    aoResponder(valor);
    aoSeguir();
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
        aria-label={`Nota do ${exercicio.nome}`}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring h-12 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-3"
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

      <div className="flex items-center gap-2">
        <Button variant="outline" className="alvo h-14 rounded-2xl px-4" onClick={aoVoltar}>
          Voltar
        </Button>
        <Button
          className="alvo h-14 flex-1 rounded-2xl text-base font-semibold"
          onClick={aoSeguir}
        >
          Continuar
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
        marcada ? "border-primary bg-primary/10" : "border-input bg-background",
      )}
    >
      {rotulo}
    </button>
  );
}

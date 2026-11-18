"use client";

import { CalendarDays } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
  dataDaEscolha,
  dataValida,
  escolherData,
  opcoesDaData,
  type EscolhaDaData,
} from "@/lib/campo-data";
import { cn } from "@/lib/utils";

/**
 * A data do registro de uma aba do Corpo (SPEC §22.19 item 6, "a escolha
 * acompanha o dia"): guarda a escolha, não a data. Sem toque é hoje — o
 * `hoje` de agora, que `useHoje` renova na virada e na volta ao app —; Ontem
 * e Outra data valem só no dia do toque. `voltarParaHoje` é o que Peso e
 * Medidas chamam depois de registrar.
 */
export function useDataDoRegistro(hoje: string): {
  data: string;
  escolher: (data: string) => void;
  voltarParaHoje: () => void;
} {
  const [escolha, setEscolha] = useState<EscolhaDaData | null>(null);
  const escolher = useCallback((data: string) => setEscolha(escolherData(data, hoje)), [hoje]);
  const voltarParaHoje = useCallback(() => setEscolha(null), []);
  return { data: dataDaEscolha(escolha, hoje), escolher, voltarParaHoje };
}

/**
 * O campo de data do Corpo (SPEC §22.19 item 6): "Hoje · Ontem · Outra data".
 *
 * O `<input type="date">` cru era desenhado no formato do navegador
 * ("09/16/2026" num Chromium em inglês) e pedia três toques para o caso de
 * sempre, hoje. Aqui hoje já vem escolhido, ontem é um toque e "Outra data"
 * abre o seletor do aparelho (`showPicker()` de um campo de data escondido,
 * com `max` = hoje). As datas aparecem em dd/mm; o estado sai de
 * `opcoesDaData()` (`lib/campo-data.ts`).
 */
export function CampoData({
  id,
  valor,
  hoje,
  aoMudar,
  rotulo = "Data",
}: {
  /** O id do campo de data escondido (o seletor do aparelho). */
  id: string;
  /** `aaaa-mm-dd`. */
  valor: string;
  hoje: string;
  aoMudar: (data: string) => void;
  rotulo?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  /** Sem `showPicker()` o campo escondido recebe o foco: sai do aria-hidden enquanto isso. */
  const [emUso, setEmUso] = useState(false);
  const idRotulo = useId();
  const idEscolhida = useId();
  const op = opcoesDaData(hoje, valor);

  const abrirSeletor = () => {
    const campo = entrada.current;
    if (!campo) return;
    if (typeof campo.showPicker === "function") {
      try {
        campo.showPicker();
        return;
      } catch {
        // sem permissão (fora de um toque) ou sem suporte: tenta pelo foco
      }
    }
    // Sem seletor por código (iOS < 16): o foco no próprio campo abre o do
    // aparelho. Ele sai do aria-hidden antes — nada de foco fora da árvore.
    flushSync(() => setEmUso(true));
    campo.focus();
    campo.click();
  };

  return (
    <div role="group" aria-labelledby={idRotulo} className="flex flex-col gap-1">
      <span id={idRotulo} className="text-sm leading-snug font-medium">
        {rotulo}
      </span>
      <div className="grid grid-cols-3 gap-2">
        <Opcao acesa={op.qual === "hoje"} aoTocar={() => aoMudar(op.hoje)}>
          <span className="text-sm font-medium">Hoje</span>
          <span className="numero text-xs">{op.rotuloHoje}</span>
        </Opcao>
        <Opcao acesa={op.qual === "ontem"} aoTocar={() => aoMudar(op.ontem)}>
          <span className="text-sm font-medium">Ontem</span>
          <span className="numero text-xs">{op.rotuloOntem}</span>
        </Opcao>
        <div className="relative">
          {/*
            O nome fica "Outra data" o tempo todo (não muda com o foco nele,
            quando o seletor devolve a data); a data escolhida é a descrição.
          */}
          <Opcao
            acesa={op.qual === "outra"}
            aoTocar={abrirSeletor}
            rotulo="Outra data"
            descricao={idEscolhida}
          >
            <span className="text-sm font-medium">Outra data</span>
            <span id={idEscolhida} className="numero flex items-center gap-1 text-xs">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              {op.rotuloOutra ?? "escolher"}
            </span>
          </Opcao>
          <input
            ref={entrada}
            id={id}
            type="date"
            tabIndex={-1}
            aria-hidden={emUso ? undefined : "true"}
            aria-label="Outra data"
            value={valor}
            max={hoje}
            onBlur={() => setEmUso(false)}
            onChange={(e) => {
              const escolhida = e.target.value;
              if (dataValida(escolhida, hoje)) aoMudar(escolhida);
              // vazio é o "limpar" do seletor: só não troca. Depois de hoje
              // (um seletor que ignora `max`) não troca e diz por quê.
              else if (escolhida !== "") toast.error("Escolha uma data até hoje.");
            }}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        </div>
      </div>
    </div>
  );
}

function Opcao({
  acesa,
  aoTocar,
  rotulo,
  descricao,
  children,
}: {
  acesa: boolean;
  aoTocar: () => void;
  rotulo?: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={acesa}
      aria-label={rotulo}
      aria-describedby={descricao}
      onClick={aoTocar}
      className={cn(
        "alvo flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1 leading-none",
        acesa
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EscolhaRetomada, OpcaoRetomada } from "@/lib/retomada";
import { cn } from "@/lib/utils";

/* ------------------------------------------- voltar do player (§22.7 item 9) */

/** Onde fica anotada a rota para onde a aba Treino saiu da última vez. */
const CHAVE_DA_SAIDA = "treino:saiu-para";

/** `/treinar/<id>` é o player; `/treinar` é a escolha do treino (SPEC §14.1). */
function ehRotaDoPlayer(caminho: string): boolean {
  return caminho.startsWith("/treinar/") && caminho.length > "/treinar/".length;
}

/**
 * SPEC §22.7 item 9: o "voltar" do celular no meio do treino não é bloqueado —
 * o gesto do sistema continua saindo do player —, mas deixa de ser mudo. A aba
 * Treino anota para onde saiu; ao voltar do player com a sessão ainda aberta,
 * avisa que o treino ficou guardado e destaca o card "em andamento" por alguns
 * segundos, que é onde está o "Continuar".
 *
 * Vale para qualquer volta ao "/" vinda do player — o gesto do celular, o
 * Escape e o "Continuar depois" da Visão geral, que usam o mesmo caminho.
 */
export function useAvisoDeVoltaDoPlayer(temSessaoAberta: boolean): boolean {
  const [voltou, setVoltou] = useState(false);
  const [destacado, setDestacado] = useState(false);
  const jaAvisou = useRef(false);

  /* a marca é lida (e apagada) uma vez, na montagem da aba */
  useEffect(() => {
    let saida: string | null = null;
    try {
      saida = window.sessionStorage.getItem(CHAVE_DA_SAIDA);
      window.sessionStorage.removeItem(CHAVE_DA_SAIDA);
    } catch {
      saida = null;
    }
    if (saida !== null && ehRotaDoPlayer(saida)) setVoltou(true);
  }, []);

  /* a sessão aberta chega do cache/rede um instante depois da montagem */
  useEffect(() => {
    if (!voltou || !temSessaoAberta || jaAvisou.current) return;
    jaAvisou.current = true;
    toast("Treino guardado — toque em Continuar para retomar.", { duration: 4000 });
    setDestacado(true);
    const relogio = window.setTimeout(() => setDestacado(false), 4000);
    return () => window.clearTimeout(relogio);
  }, [voltou, temSessaoAberta]);

  /* ao sair da aba, anota para onde foi: é o que identifica a volta do player */
  useEffect(() => {
    return () => {
      try {
        window.sessionStorage.setItem(CHAVE_DA_SAIDA, window.location.pathname);
      } catch {
        /* aparelho sem sessionStorage: o aviso simplesmente não aparece */
      }
    };
  }, []);

  return destacado;
}

/** A frase do topo, conforme o tamanho da pausa (SPEC §18.2). */
function explicacao(dias: number): string {
  if (dias < 14) {
    return "Uma semana ou pouco mais fora não tira carga nenhuma. Escolha por onde recomeçar.";
  }
  if (dias < 28) {
    return "Depois de duas semanas paradas a força cai um pouco. Dá para voltar mais leve por uma semana e o app devolve a carga sozinho.";
  }
  return "Foi um mês ou mais. Voltar mais leve costuma bastar; recomeçar do zero é para quando a pausa foi longa demais.";
}

/** As opções que só dá para gravar com todas as cargas em mãos (SPEC §18.2). */
function precisaDasCargas(opcao: OpcaoRetomada): boolean {
  return opcao.escolha === "leve" || opcao.escolha === "zero";
}

/**
 * O card da retomada (SPEC §18.3): aparece no topo da aba Treino quando a
 * pausa passou de uma semana, com as opções da faixa. "Recomeçar do zero" é
 * destrutivo e só grava depois de uma confirmação em duas etapas.
 */
export function CardRetomada({
  dias,
  opcoes,
  ocupado,
  semCargas,
  destacado,
  aoEscolher,
  ref,
}: {
  dias: number;
  opcoes: readonly OpcaoRetomada[];
  ocupado: boolean;
  /**
   * As cargas de todos os exercícios ainda não chegaram (SPEC §18.3): sem elas
   * "Voltar mais leve" e "Recomeçar do zero" gravariam vazio, então só essas
   * duas ficam de fora — "Continuar" tem de funcionar sempre, ou a pausa sem
   * rede tranca a aba Treino inteira, que é toda barrada pelo card.
   */
  semCargas: boolean;
  /** Ele tocou em "Começar treino" com o card pendente (SPEC §18.3). */
  destacado: boolean;
  aoEscolher: (escolha: EscolhaRetomada) => void;
  ref?: React.Ref<HTMLElement>;
}) {
  /* o diálogo do "Recomeçar do zero": 0 = fechado, 1 e 2 = as duas etapas */
  const [etapa, setEtapa] = useState<0 | 1 | 2>(0);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Retomada"
      data-retomada
      className={cn(
        "border-border bg-card flex flex-col gap-3 rounded-xl border p-4",
        destacado && "border-primary ring-primary/40 ring-2",
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-balance">
          Você ficou {dias} dias sem treinar
        </h2>
        <p className="text-muted-foreground text-sm text-balance">
          {explicacao(dias)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {opcoes.map((opcao) => (
          <Button
            key={opcao.escolha}
            type="button"
            variant={opcao.destrutiva ? "ghost" : "outline"}
            data-retomada-opcao={opcao.escolha}
            disabled={ocupado || (semCargas && precisaDasCargas(opcao))}
            onClick={() => (opcao.destrutiva ? setEtapa(1) : aoEscolher(opcao.escolha))}
            className={cn(
              "alvo h-auto min-h-12 w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left whitespace-normal",
              opcao.destrutiva && "text-destructive hover:text-destructive",
            )}
          >
            <span className="text-sm font-medium">{opcao.rotulo}</span>
            <span className="text-muted-foreground text-xs font-normal text-balance">
              {opcao.descricao}
            </span>
          </Button>
        ))}
      </div>

      {semCargas && opcoes.some(precisaDasCargas) ? (
        <p data-retomada-sem-cargas className="text-muted-foreground text-xs text-balance">
          As suas cargas ainda não carregaram. Sem rede dá para continuar de onde
          parou; as outras opções voltam quando o app conseguir lê-las.
        </p>
      ) : null}

      <Dialog open={etapa !== 0} onOpenChange={(v) => !v && setEtapa(0)}>
        <DialogContent
          data-retomada-etapa={etapa}
          className="max-w-[calc(100vw-2rem)] sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>
              {etapa === 1 ? "Recomeçar do zero?" : "Tem certeza mesmo?"}
            </DialogTitle>
            <DialogDescription className="text-balance">
              {etapa === 1
                ? "A carga de todos os exercícios volta ao começo do programa, as semanas de corrida, corda e barra fixa voltam para a 1 e o próximo treino volta a ser o Treino A. Seus treinos, séries, corridas, pesos e fotos continuam no histórico."
                : "Isto não tem como desfazer: as cargas que você conquistou até aqui voltam ao início. Se a pausa não foi tão longa, “Voltar mais leve” resolve."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {etapa === 1 ? (
              <Button
                type="button"
                variant="outline"
                className="alvo h-12 w-full"
                data-retomada-zero="continuar"
                onClick={() => setEtapa(2)}
              >
                Entendi, quero recomeçar
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                className="alvo h-12 w-full"
                data-retomada-zero="confirmar"
                disabled={ocupado}
                onClick={() => {
                  setEtapa(0);
                  aoEscolher("zero");
                }}
              >
                Sim, recomeçar do zero
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="alvo h-12 w-full"
              data-retomada-zero="cancelar"
              onClick={() => setEtapa(0)}
            >
              {etapa === 1 ? "Agora não" : "Voltar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

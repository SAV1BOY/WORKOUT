"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acharFase, acharTreino } from "@/lib/dados";
import { formatarDataLonga } from "@/lib/formato";
import type { FaseId, TipoDia, TreinoId } from "@/lib/schemas";
import { NOME_DA_MARCA, type DiaDaGrade, type NovoOverride } from "@/lib/semana";
import { cn } from "@/lib/utils";

export interface TrocaDoDia {
  tipo: TipoDia;
  workout_id: TreinoId | null;
  sessao: string | null;
  motivo: string | null;
}

/** Botão de escolha grande o bastante para o dedo (≥ 44 px). */
function Opcao({
  aceso,
  children,
  ...props
}: React.ComponentProps<"button"> & { aceso: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={aceso}
      className={cn(
        "alvo border-border flex-1 rounded-lg border px-2 py-2 text-sm font-medium",
        aceso ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Dia tocado na grade (SPEC §3.5): dia passado abre o resumo; dia de hoje ou
 * futuro permite trocar o tipo, com motivo opcional.
 */
export function DialogoDia({
  dia,
  fase,
  aoFechar,
  aoTrocar,
  aoDesfazer,
}: {
  dia: DiaDaGrade | null;
  fase: FaseId;
  aoFechar: () => void;
  aoTrocar: (troca: TrocaDoDia) => void;
  aoDesfazer: () => void;
}) {
  const [tipo, setTipo] = useState<TipoDia>("forca");
  const [treino, setTreino] = useState<TreinoId | null>(null);
  const [sessao, setSessao] = useState<string>("corrida");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!dia) return;
    setTipo(dia.dia.tipo);
    setTreino(dia.dia.treinoEscolhido ? dia.dia.treinoId : null);
    setSessao(dia.dia.cardio?.tipo === "corda" ? "corda" : "corrida");
    setMotivo("");
  }, [dia]);

  const aberto = dia !== null;
  const passado = dia?.passado ?? false;
  const treinos = acharFase(fase).treinos;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        {dia ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-left first-letter:uppercase">
                {formatarDataLonga(dia.data)}
              </DialogTitle>
              <DialogDescription className="text-left">
                {dia.rotulo}
                {dia.detalhe ? ` · ${dia.detalhe}` : ""} ·{" "}
                {NOME_DA_MARCA[dia.marca]}
              </DialogDescription>
            </DialogHeader>

            {passado ? (
              <div className="flex flex-col gap-3">
                {dia.sessaoId ? (
                  <Button asChild className="alvo h-12 w-full">
                    <Link href={`/treinar/${dia.sessaoId}`}>Abrir o treino</Link>
                  </Button>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nada registrado neste dia.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                    Tipo do dia
                  </legend>
                  <div className="flex gap-2">
                    <Opcao aceso={tipo === "forca"} onClick={() => setTipo("forca")}>
                      Força
                    </Opcao>
                    <Opcao aceso={tipo === "cardio"} onClick={() => setTipo("cardio")}>
                      Cardio
                    </Opcao>
                    <Opcao
                      aceso={tipo === "descanso"}
                      onClick={() => setTipo("descanso")}
                    >
                      Descanso
                    </Opcao>
                  </div>
                </fieldset>

                {tipo === "forca" ? (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                      Qual treino
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      <Opcao aceso={treino === null} onClick={() => setTreino(null)}>
                        O próximo da vez
                      </Opcao>
                      {treinos.map((id) => (
                        <Opcao
                          key={id}
                          aceso={treino === id}
                          onClick={() => setTreino(id)}
                        >
                          {acharTreino(id).nome}
                        </Opcao>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {tipo === "cardio" ? (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                      Qual sessão
                    </legend>
                    <div className="flex gap-2">
                      <Opcao
                        aceso={sessao === "corrida"}
                        onClick={() => setSessao("corrida")}
                      >
                        Corrida
                      </Opcao>
                      <Opcao aceso={sessao === "corda"} onClick={() => setSessao("corda")}>
                        Corda
                      </Opcao>
                    </div>
                  </fieldset>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="motivo">Motivo (opcional)</Label>
                  <Input
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="chuva, viagem, dor nas costas…"
                    className="alvo h-12"
                  />
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    className="alvo h-12 w-full"
                    onClick={() =>
                      aoTrocar({
                        tipo,
                        workout_id: tipo === "forca" ? treino : null,
                        sessao: tipo === "cardio" ? sessao : null,
                        motivo: motivo.trim() === "" ? null : motivo.trim(),
                      })
                    }
                  >
                    Salvar a troca
                  </Button>
                  {dia.dia.origem === "override" ? (
                    <Button
                      variant="outline"
                      className="alvo h-12 w-full"
                      onClick={aoDesfazer}
                    >
                      Voltar ao programa
                    </Button>
                  ) : null}
                </DialogFooter>
              </div>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Não vou treinar hoje" (SPEC §5.4): mostra o que a regra da semana curta vai
 * mudar antes de gravar nada.
 */
export function DialogoSemanaCurta({
  aberto,
  mudancas,
  cortados,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  mudancas: NovoOverride[];
  cortados: string[];
  aoFechar: () => void;
  aoConfirmar: (motivo: string | null) => void;
}) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (aberto) setMotivo("");
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">Não vou treinar hoje</DialogTitle>
          <DialogDescription className="text-left">
            O resto da semana é remanejado na ordem do guia — o treino com
            agachamento ou terra nunca é cortado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {mudancas.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nada muda: a semana continua igual.
            </p>
          ) : (
            <ul aria-label="O que muda" className="flex flex-col gap-1 text-sm">
              {mudancas.map((m) => (
                <li key={m.data} className="numero">
                  {m.descricao}
                </li>
              ))}
            </ul>
          )}

          {cortados.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Fica de fora: {cortados.join(", ")}.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-semana">Motivo (opcional)</Label>
            <Input
              id="motivo-semana"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="viagem, chuva, trabalho…"
              className="alvo h-12"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="alvo h-12 w-full"
            onClick={() => aoConfirmar(motivo.trim() === "" ? null : motivo.trim())}
          >
            Aplicar à semana
          </Button>
          <Button variant="outline" className="alvo h-12 w-full" onClick={aoFechar}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contagemInteiraValida, MAX_CONTAGEM } from "@/lib/campos-de-contagem";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";

export const acaoDaFolha = "alvo h-auto max-w-full py-1 whitespace-normal wrap-anywhere";
export const numero = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 21 });

export function lerInteiro(texto = "") {
  const valor = /^\d+$/.test(texto.trim()) ? Number(texto) : NaN;
  return contagemInteiraValida(valor) ? valor : null;
}

export function CampoInteiroRecusado({ rotulo, fracionario, posterior, texto, aoDigitar, bloqueado, ajuda }: {
  rotulo: string; fracionario: number; posterior?: number | null; texto: string;
  aoDigitar: (texto: string) => void; bloqueado: boolean; ajuda: string;
}) {
  const id = useId();
  const invalido = !bloqueado && Boolean(texto) && lerInteiro(texto) === null;
  return (
    <div className="grid min-w-0 gap-1">
      {posterior === undefined ? <label htmlFor={id} className="font-medium">{rotulo}</label> : <p className="font-medium">{rotulo}</p>}
      <p id={`${id}-recusado`} className="text-muted-foreground text-sm">Valor recusado: {numero.format(fracionario)}</p>
      {posterior !== undefined ? (
        <p className="text-sm">Valor já corrigido: {posterior === null ? "Sem contagem" : numero.format(posterior)}</p>
      ) : (
        <>
          <Input id={id} type="text" inputMode="numeric" autoComplete="off" value={texto}
            aria-invalid={invalido} aria-describedby={`${id}-recusado ${id}-ajuda`}
            disabled={bloqueado} className="alvo max-w-44" placeholder="Número inteiro"
            onChange={e => aoDigitar(e.target.value)} />
          <p id={`${id}-ajuda`} className="text-muted-foreground text-xs">
            {invalido ? `Use um inteiro de 0 a ${numero.format(MAX_CONTAGEM)}.` : ajuda}
          </p>
        </>
      )}
    </div>
  );
}

type Decisao = "aparelho" | "historico" | "criar" | "manter-ausencia";
type Revisao = { estado: "aguardando" | "conflito" | "ausente"; revisao: string; mesmaIdentidade: boolean; permiteCriar?: boolean };

export function EscolhaDoRegistro({ tipo, titulo, conta, atual, revisaoEscolhida, salvar, aoEscolher, children }: {
  tipo: "série" | "treino"; titulo: string; conta: string; atual: Revisao; revisaoEscolhida?: string;
  salvar: (escolha: Decisao) => Promise<void>; aoEscolher: () => void; children: ReactNode;
}) {
  const id = useId();
  const [revista, setRevista] = useState(revisaoEscolhida ?? atual.revisao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const emCurso = useRef(false);
  const mudou = revista !== atual.revisao;
  const decidir = async (usar: Decisao) => {
    if (emCurso.current || mudou) return;
    emCurso.current = true;
    setSalvando(true);
    setErro("");
    try {
      await salvar(usar);
      await confirmarContaDoTreino(conta, "A conta deste registro mudou.");
      aoEscolher();
    } catch {
      setErro("Não foi possível salvar a escolha. Confira os valores atuais e tente de novo.");
    } finally {
      emCurso.current = false;
      setSalvando(false);
    }
  };
  const ausente = atual.estado === "ausente";
  const manter = ausente ? (tipo === "série" ? "Manter o histórico sem esta série" : "Manter o histórico sem este treino")
    : atual.mesmaIdentidade ? "Manter a contagem do histórico" : (tipo === "série" ? "Manter a série do histórico" : "Manter o treino do histórico");
  return (
    <section role="group" aria-labelledby={id} className="border-border flex min-w-0 flex-col gap-3 border-b py-4 last:border-0">
      <h3 id={id} className="font-semibold wrap-anywhere">{titulo}</h3>
      {children}
      {mudou ? (
        <>
          <p role="status" className="text-sm">O histórico mudou. Confira os valores atuais.</p>
          <Button variant="outline" className={`${acaoDaFolha} self-start`} onClick={() => { setRevista(atual.revisao); setErro(""); }}>Rever valores</Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button className={acaoDaFolha} disabled={salvando} onClick={() => void decidir(ausente ? "manter-ausencia" : "historico")}>{manter}</Button>
          {ausente && atual.permiteCriar && <Button variant="outline" className={acaoDaFolha} disabled={salvando}
            onClick={() => void decidir("criar")}>{tipo === "série" ? "Criar a série no histórico" : "Criar o treino no histórico"}</Button>}
          {!ausente && atual.mesmaIdentidade && <Button variant="outline" className={acaoDaFolha} disabled={salvando}
            onClick={() => void decidir("aparelho")}>Usar a contagem do aparelho</Button>}
        </div>
      )}
      {erro && <p role="alert" className="text-destructive text-sm">{erro}</p>}
    </section>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mensagemDeRegistro } from "@/lib/outbox";
import { usePerfil } from "@/lib/queries/dados";
import { gravarNotaDoExercicio, useNotaDoExercicio } from "@/lib/queries/nota-do-exercicio";

export function NotaPessoal({ exercicioId }: { exercicioId: string }) {
  const conta = usePerfil().data?.user_id;
  if (!conta) return null;
  return <EditorDaNota key={`${conta}:${exercicioId}`} conta={conta} exercicioId={exercicioId} />;
}

function EditorDaNota({ conta, exercicioId }: { conta: string; exercicioId: string }) {
  const cliente = useQueryClient();
  const nota = useNotaDoExercicio(conta, exercicioId);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const id = useId();
  async function salvar(texto: string) {
    setSalvando(true);
    try {
      await gravarNotaDoExercicio(cliente, conta, exercicioId, texto);
      setRascunho(null);
      toast.success(mensagemDeRegistro(texto.trim() ? "Nota salva" : "Nota removida"));
    } catch {
      toast.error("Não foi possível guardar a nota neste aparelho. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <section aria-label="Lembrar no próximo treino" className="flex flex-col items-start gap-2">
      {rascunho === null ? (
        <>
          {nota.data && <p className="whitespace-pre-wrap break-words text-sm">{nota.data}</p>}
          {nota.isError && nota.data === undefined ? (
            <>
              <p className="text-muted-foreground text-sm">Não foi possível consultar a nota anterior.</p>
              <div className="flex flex-wrap gap-2">
                <Button className="alvo" variant="outline" onClick={() => void nota.refetch()}>Tentar novamente</Button>
                <Button className="alvo" variant="outline" onClick={() => setRascunho("")}>Definir uma nova nota</Button>
              </div>
            </>
          ) : (
            <Button className="alvo" variant="outline" disabled={nota.data === undefined} onClick={() => setRascunho(nota.data ?? "")}>
              {nota.data ? "Editar nota pessoal" : "Lembrar no próximo treino"}
            </Button>
          )}
        </>
      ) : (
        <>
          <label htmlFor={id} className="text-sm font-semibold">Lembrar no próximo treino</label>
          <textarea id={id} value={rascunho} disabled={salvando} onChange={(e) => setRascunho(e.target.value)}
            placeholder="Ex.: banco no terceiro furo" rows={2} autoFocus
            className="border-input bg-background w-full rounded-md border p-2 text-base" />
          <div className="flex flex-wrap gap-2">
            <Button className="alvo" disabled={salvando || !rascunho.trim()} onClick={() => void salvar(rascunho)}>Salvar nota</Button>
            <Button className="alvo" variant="outline" disabled={salvando} onClick={() => setRascunho(null)}>Cancelar</Button>
            {nota.data && <Button className="alvo" variant="ghost" disabled={salvando} onClick={() => void salvar("")}>Remover nota</Button>}
          </div>
        </>
      )}
    </section>
  );
}

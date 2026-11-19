"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MENSAGEM_NOTA_GERAL_ALTERADA } from "@/lib/sessao";

/** No fim do treino, o submit guarda também o texto que a pessoa ainda está editando. */
export function NotaDoTreino({
  valor, aoGuardar, aoConcluir, bloqueado = false, children,
}: {
  valor?: string | null;
  aoGuardar: (texto: string, notaAoAbrir: string | null) => Promise<void>;
  aoConcluir?: () => void;
  bloqueado?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const abrir = useRef<HTMLButtonElement>(null);
  const ocupado = useRef(false);
  const [edicao, setEdicao] = useState<{ inicial: string | null; texto: string } | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  function fecharEditor() {
    setEdicao(null);
    setErro("");
    requestAnimationFrame(() => abrir.current?.focus());
  }

  async function guardar(texto: string | null, concluir = false) {
    if (ocupado.current || bloqueado) return;
    ocupado.current = true;
    setErro("");
    try {
      const inicial = edicao?.inicial ?? null;
      if (texto !== null && texto !== (inicial ?? "") && (texto.trim() || null) !== inicial) {
        // Uma atualização do histórico não muda a base do texto que a pessoa está editando.
        if ((valor ?? null) !== inicial) throw new Error(MENSAGEM_NOTA_GERAL_ALTERADA);
        setGravando(true);
        await aoGuardar(texto, inicial);
        if (!form.current) return;
        setAviso(texto.trim() ? "Nota salva." : "Nota apagada.");
      }
      if (concluir && aoConcluir) aoConcluir();
      else fecharEditor();
    } catch (falha) {
      setErro(falha instanceof Error && falha.message === MENSAGEM_NOTA_GERAL_ALTERADA
        ? falha.message : "Não foi possível guardar a nota neste aparelho. Tente novamente.");
      requestAnimationFrame(() => document.getElementById(id)?.focus());
    } finally {
      ocupado.current = false;
      setGravando(false);
    }
  }

  return (
    <form ref={form} className="min-w-0" onSubmit={evento => {
      evento.preventDefault();
      void guardar(edicao?.texto ?? null, true);
    }}>
      <fieldset disabled={bloqueado || gravando} aria-busy={gravando} className="flex min-w-0 flex-col gap-3">
        {edicao === null ? (
          <div className="flex min-w-0 flex-col items-start gap-1">
            {valor && (
              <>
                <h3 className="text-sm font-semibold">Nota do treino</h3>
                <p className="w-full text-sm whitespace-pre-wrap break-words">{valor}</p>
              </>
            )}
            <Button ref={abrir} type="button" variant="ghost" className="alvo"
              onClick={() => { setAviso(""); setEdicao({ texto: valor ?? "", inicial: valor ?? null }); }}>
              {valor ? "Editar nota do treino" : "Adicionar nota do treino"}
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor={id} className="text-sm font-semibold">Nota do treino</label>
            <textarea autoFocus id={id} rows={3} value={edicao.texto}
              aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined}
              onChange={evento => setEdicao({ ...edicao, texto: evento.target.value })}
              className="border-input bg-background focus-visible:outline-ring w-full resize-y rounded-lg border p-3 text-base focus-visible:outline-2" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="alvo" onClick={() => void guardar(edicao.texto)}>
                Salvar nota
              </Button>
              <Button type="button" variant="outline" className="alvo"
                aria-label="Cancelar edição da nota" onClick={fecharEditor}>
                Cancelar
              </Button>
              {edicao.inicial && (
                <Button type="button" variant="ghost" className="alvo" onClick={() => void guardar("")}>
                  Apagar nota
                </Button>
              )}
            </div>
          </div>
        )}
        {erro && <p id={`${id}-erro`} role="alert" className="text-destructive text-sm">{erro}</p>}
        {children}
      </fieldset>
      <p role="status" className="sr-only">{aviso}</p>
    </form>
  );
}

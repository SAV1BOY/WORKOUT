"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { NomeDoTreino } from "@/components/treino/treinos-salvos";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { composicaoDoModeloDaSessao } from "@/lib/modelo-da-sessao";
import type { SessaoBruta } from "@/lib/progresso";
import { salvarModeloDeTreino } from "@/lib/queries/modelos-de-treino";
import { novoId } from "@/lib/queries/sessao";

export function SalvarComoTreino({ sessao, conta, titulo }: { sessao: SessaoBruta; conta: string; titulo: string }) {
  const cliente = useQueryClient();
  const composicao = useMemo(() => sessao.user_id === conta ? composicaoDoModeloDaSessao(sessao) : null, [sessao, conta]);
  const [id, setId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [gravando, setGravando] = useState(false);
  const emGravacao = useRef(false);
  const avisoId = useId();
  if (!composicao) return null;

  function mudarAberto(aberto: boolean) {
    if (emGravacao.current) return;
    if (aberto) {
      setId(novoId());
      setNome([...titulo.trim()].slice(0, 80).join(""));
      setErro(null);
      setAviso("");
    } else setId(null);
  }

  async function salvar() {
    if (!id || !composicao || !nome.trim() || emGravacao.current) return;
    emGravacao.current = true;
    setGravando(true);
    setErro(null);
    try {
      await salvarModeloDeTreino(cliente, { ...composicao, id, user_id: conta, nome: nome.trim() });
      setAviso("Treino salvo. Você pode abri-lo em Personalizar treino → Treinos salvos.");
      setId(null);
    } catch {
      setErro("Não foi possível salvar o treino neste aparelho. Tente novamente.");
    } finally {
      emGravacao.current = false;
      setGravando(false);
    }
  }

  return (
    <div>
      <Sheet open={id !== null} onOpenChange={mudarAberto}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" aria-describedby={aviso ? avisoId : undefined}
            className="alvo h-auto max-w-full py-2 whitespace-normal">
            <Bookmark aria-hidden="true" /> Salvar como treino
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="block max-h-[85dvh] overflow-y-auto pb-6" showCloseButton={!gravando}>
          <SheetHeader className="pr-16 pb-3">
            <SheetTitle className="wrap-anywhere">Salvar como treino</SheetTitle>
            <SheetDescription>Guarde os exercícios e seus ajustes para outro dia.</SheetDescription>
          </SheetHeader>
          <NomeDoTreino nome={nome} aoMudar={setNome} atualizando={false} gravando={gravando}
            erro={erro} aoSalvar={() => void salvar()} aoVoltar={() => mudarAberto(false)} />
        </SheetContent>
      </Sheet>
      <p id={avisoId} role="status" className="text-muted-foreground mt-2 text-sm wrap-anywhere empty:hidden">{aviso}</p>
    </div>
  );
}

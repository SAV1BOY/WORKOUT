"use client";

import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useSessaoLivre } from "@/components/colecoes/usar-sessao-livre";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { acharExercicio } from "@/lib/dados";
import { podeVoltarNoApp } from "@/lib/ficha";

/**
 * "Voltar" no topo da ficha em página (SPEC §22.14 item 1). É um link para
 * `/exercicios` — funciona sem JavaScript e numa aba aberta direto na ficha —,
 * e, quando há uma página anterior do app no histórico (`podeVoltarNoApp`), o
 * toque volta a ela: quem chegou do Progresso ou de uma coleção volta para lá,
 * não para o catálogo.
 * O rótulo é o mesmo nos dois casos (nome acessível estável).
 */
export function VoltarDaFicha() {
  const router = useRouter();
  return (
    <Link
      href="/exercicios"
      data-voltar-da-ficha
      onClick={(evento) => {
        const navegacao = (window as { navigation?: { canGoBack?: unknown } }).navigation;
        if (!podeVoltarNoApp(navegacao, window.history.length)) return;
        evento.preventDefault();
        router.back();
      }}
      className="alvo text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar
    </Link>
  );
}

/**
 * "Fazer agora" no fim da ficha em página (SPEC §22.14 item 1): uma sessão
 * livre só com este exercício, pelo mesmo `useSessaoLivre` das coleções
 * (§14.3) — o player grava cada série no IndexedDB na hora (§8). Enquanto o
 * perfil e o dia carregam, o botão fica desabilitado. O rótulo
 * não muda enquanto a sessão nasce: o foco não ouve outro nome.
 */
export function FazerAgora({ exercicioId }: { exercicioId: string }) {
  const ids = useMemo(() => [exercicioId], [exercicioId]);
  const { comecar, ocupado, pronto } = useSessaoLivre(ids);
  const exercicio = acharExercicio(exercicioId);

  return (
    <div className="flex flex-col gap-1 pt-2">
      <BotaoLargo
        data-fazer-agora
        disabled={!pronto || ocupado}
        aria-busy={ocupado || undefined}
        onClick={() => void comecar(ids, { titulo: exercicio.nome })}
      >
        <Play aria-hidden="true" className="size-5" />
        Fazer agora
      </BotaoLargo>
      <p className="text-muted-foreground text-xs text-balance">
        Sessão livre só com este exercício, com a carga que o motor indica.
      </p>
    </div>
  );
}

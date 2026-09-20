"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChartLine,
  Compass,
  Dumbbell,
  Ellipsis,
  LayoutGrid,
  ListChecks,
  PersonStanding,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ICONE_DA_ABA } from "@/components/icones-das-abas";
import { Button } from "@/components/ui/button";
import {
  ABAS_DO_GUIA,
  SECOES,
  blocosDaSecao,
  type FuncaoDoGuia,
  type IconeDaSecao,
  type SecaoDoGuia,
} from "@/lib/guia";
import { comGuiaVisto } from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";
import { salvarPrefs } from "@/lib/queries/mais";

/** Os ícones das seções, pelo nome guardado em `lib/guia.ts`. */
const ICONE_DA_SECAO: Readonly<Record<IconeDaSecao, LucideIcon>> = {
  ListChecks,
  LayoutGrid,
  CalendarDays,
  WifiOff,
  Dumbbell,
  Compass,
  ChartLine,
  PersonStanding,
  Ellipsis,
};

/**
 * `/mais/guia` (SPEC §20): uma página rolável com o índice de chips, os
 * primeiros passos, a barra de abas e uma seção por tela — cada função com o
 * caminho em chips e o "Ir" quando tem rota.
 *
 * Com `?inicio=1` (a primeira entrada da conta) ela ganha o "Pular por agora"
 * no topo; sem ele, o botão do fim só volta para Mais.
 */
export function TelaGuia() {
  const router = useRouter();
  const cliente = useQueryClient();
  const parametros = useSearchParams();
  const inicio = parametros.get("inicio") === "1";
  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;
  const [salvando, setSalvando] = useState(false);

  /*
   * SPEC §20.2: os dois botões que reconhecem o guia gravam
   * `prefs.guia_visto` pela fila de saída (§8) — o mesmo caminho de
   * `conquistas_vistas`. `salvarPrefs` já põe o perfil novo no cache do
   * TanStack Query, e é ele que a aba Treino lê ao voltar; um
   * `invalidateQueries` aqui releria o banco ANTES de a fila subir e traria o
   * perfil velho de volta — ou seja, o guia outra vez. Por isso não há um.
   */
  const reconhecer = async (destino: string) => {
    if (salvando) return;
    setSalvando(true);
    try {
      if (perfil) {
        await salvarPrefs({
          userId: perfil.user_id,
          prefs: comGuiaVisto(perfil.prefs),
          cliente,
        });
      }
    } catch {
      toast.error("Não consegui salvar agora. Fica na fila.");
    } finally {
      setSalvando(false);
      router.replace(destino);
    }
  };

  return (
    <section aria-label="Como usar o app" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        {inicio ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="alvo text-muted-foreground -mr-2"
              disabled={salvando}
              onClick={() => void reconhecer("/")}
            >
              Pular por agora
            </Button>
          </div>
        ) : (
          <Link
            href="/mais"
            className="alvo text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm"
          >
            ← Mais
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">
          Como usar o app
        </h1>
        <p className="text-muted-foreground text-sm text-balance">
          {inicio
            ? "Bem-vindo. Em dois minutos você sabe onde fica cada coisa — e o guia continua em Mais, para voltar quando quiser."
            : "Onde fica cada função e como chegar nela. Toque em “Ir” para abrir a tela."}
        </p>
      </header>

      <Indice />

      {SECOES.map((secao) => (
        <Secao key={secao.id} secao={secao} />
      ))}

      <div className="flex flex-col gap-2 pb-2">
        <Button
          className="alvo h-14 w-full text-base font-semibold"
          disabled={salvando}
          onClick={() => void reconhecer(inicio ? "/" : "/mais")}
        >
          {inicio ? "Entendi, começar a treinar" : "Entendi"}
        </Button>
        <p className="text-muted-foreground text-center text-xs text-balance">
          Este guia fica em Mais → Como usar o app.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------- índice de chips */

function Indice() {
  return (
    <nav aria-label="Índice do guia">
      <ul className="flex flex-wrap gap-2">
        {SECOES.map((secao) => (
          <li key={secao.id}>
            <a
              href={`#${secao.id}`}
              data-chip={secao.id}
              className="alvo border-border bg-card hover:bg-accent flex items-center rounded-full border px-3 py-2 text-xs font-medium"
            >
              {secao.chip}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------- seção */

function Secao({ secao }: { secao: SecaoDoGuia }) {
  const Icone = ICONE_DA_SECAO[secao.icone];
  const blocos = blocosDaSecao(secao);

  return (
    <section
      id={secao.id}
      aria-labelledby={`guia-${secao.id}`}
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <header className="flex items-start gap-3">
        <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Icone aria-hidden="true" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            id={`guia-${secao.id}`}
            className="text-base leading-tight font-semibold"
          >
            {secao.titulo}
          </h2>
          <p className="text-muted-foreground text-xs text-balance">
            {secao.resumo}
          </p>
        </div>
        {secao.href ? <Ir href={secao.href} nome={secao.titulo} /> : null}
      </header>

      {secao.id === "abas" ? <MiniaturaDaBarra /> : null}

      <div className="border-border bg-card cartao border px-3">
        {blocos.map((bloco, i) => (
          <div key={bloco.grupo ?? `bloco-${i}`}>
            {bloco.grupo ? (
              <h3 className="text-muted-foreground border-border border-b pt-3 pb-1 text-rotulo font-medium tracking-wide uppercase first:pt-1">
                {bloco.grupo}
              </h3>
            ) : null}
            <ul className="divide-border divide-y">
              {bloco.funcoes.map((funcao) => (
                <Linha key={funcao.id} funcao={funcao} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------- miniatura da barra */

/**
 * A barra de abas desenhada em miniatura, com os mesmos ícones e rótulos da
 * barra de baixo — os dois leem `lib/abas.ts` (SPEC §20.4).
 */
function MiniaturaDaBarra() {
  return (
    <div
      aria-hidden="true"
      data-miniatura=""
      className="border-border bg-card cartao flex border px-1 py-1.5"
    >
      {ABAS_DO_GUIA.map((aba, i) => {
        const Icone = ICONE_DA_ABA[aba.icone];
        return (
          <span
            key={aba.href}
            className={`flex flex-1 flex-col items-center gap-1 text-micro font-medium ${
              i === 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icone className="size-5" />
            {aba.rotulo}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------ linha de função */

function Linha({ funcao }: { funcao: FuncaoDoGuia }) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm leading-tight font-medium text-balance">
            {funcao.nome}
          </p>
          <p className="text-muted-foreground text-xs text-balance">
            {funcao.oQueFaz}
          </p>
          {funcao.nota ? (
            <p className="text-muted-foreground text-xs text-balance">
              {funcao.nota}
            </p>
          ) : null}
        </div>
        {funcao.href ? <Ir href={funcao.href} nome={funcao.nome} /> : null}
      </div>
      <Caminho chips={funcao.caminho} />
    </li>
  );
}

/** O caminho em chips: `Mais → Preferências → Dias de treino`. */
function Caminho({ chips }: { chips: readonly string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {chips.map((chip, i) => (
        <li key={`${chip}-${i}`} className="flex items-center gap-1">
          {i > 0 ? (
            <span aria-hidden="true" className="text-muted-foreground text-rotulo">
              →
            </span>
          ) : null}
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-rotulo font-medium">
            {chip}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** O botão "Ir" (alvo ≥ 44 px) que abre a tela da função. */
function Ir({ href, nome }: { href: string; nome: string }) {
  return (
    <Button asChild variant="outline" className="alvo shrink-0 px-3">
      <Link href={href} data-ir={href} aria-label={`Ir para ${nome}`}>
        Ir
      </Link>
    </Button>
  );
}

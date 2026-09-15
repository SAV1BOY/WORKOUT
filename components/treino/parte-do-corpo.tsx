"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListaDaColecao } from "@/components/colecoes/lista-da-colecao";
import { useSessaoLivre } from "@/components/colecoes/usar-sessao-livre";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Raios } from "@/components/ui/raios";
import {
  FILTROS,
  colecaoDoGrupo,
  colecaoFiltrada,
  exerciciosParaSessao,
  grupos,
  hrefDaColecao,
  type ChaveDoFiltro,
  type Colecao,
} from "@/lib/colecoes";
import { evitadosPorUltimo } from "@/lib/preferencias";
import type { Grupo } from "@/lib/schemas";
import type { Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Parte do corpo em foco" (SPEC §14.3): os chips dos 8 grupos de
 * `exercicios.json`, a lista do grupo escolhido com `N exercícios · ~M min` e
 * os raios, e o "Começar", que abre uma sessão livre com os 6 primeiros
 * (compostos antes de isolamento, só o que o equipamento do terraço permite).
 *
 * Os chips de filtro são derivados (§14.3): eles escondem os grupos que não
 * casam — nenhuma lista escrita à mão.
 */
export function ParteDoCorpo({
  prefs,
  mostrarRaios = true,
}: {
  prefs?: Prefs;
  mostrarRaios?: boolean;
}) {
  const [filtros, setFiltros] = useState<ChaveDoFiltro[]>([]);
  const todos = useMemo(() => grupos(), []);

  /*
   * Os filtros encolhem a lista de cada grupo (SPEC §14.3): um grupo que fica
   * sem exercício nenhum some dos chips, e o que sobra já entra no "Começar".
   */
  const porGrupo = useMemo(() => {
    const mapa = new Map<Grupo, Colecao>();
    for (const g of todos) {
      const filtrada = colecaoFiltrada(colecaoDoGrupo(g), filtros);
      if (filtrada) mapa.set(g, filtrada);
    }
    return mapa;
  }, [todos, filtros]);
  const visiveis = useMemo(() => [...porGrupo.keys()], [porGrupo]);

  const [escolhido, setEscolhido] = useState<Grupo | null>(null);
  const grupo = escolhido && visiveis.includes(escolhido) ? escolhido : (visiveis[0] ?? null);

  const colecao = useMemo(() => (grupo ? (porGrupo.get(grupo) ?? null) : null), [grupo, porGrupo]);
  const ids = useMemo(
    () => (colecao ? evitadosPorUltimo(colecao.exercicios, (id) => id, prefs) : []),
    [colecao, prefs],
  );
  const escolhidos = useMemo(
    () => (colecao ? exerciciosParaSessao(colecao.exercicios, { prefs }) : []),
    [colecao, prefs],
  );

  const { comecar, ocupado, pronto } = useSessaoLivre(colecao?.exercicios ?? []);

  const alternar = (chave: ChaveDoFiltro) =>
    setFiltros((atuais) =>
      atuais.includes(chave) ? atuais.filter((c) => c !== chave) : [...atuais, chave],
    );

  return (
    <section aria-label="Parte do corpo em foco" className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Parte do corpo em foco</h2>

      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Grupos">
        {visiveis.map((g) => (
          <li key={g}>
            <Chip
              rotulo={g}
              ativo={g === grupo}
              aoTocar={() => setEscolhido(g)}
              nome={`Parte do corpo: ${g}`}
            />
          </li>
        ))}
      </ul>

      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Filtros">
        {FILTROS.map((f) => (
          <li key={f.chave}>
            <Chip
              rotulo={f.rotulo}
              ativo={filtros.includes(f.chave)}
              aoTocar={() => alternar(f.chave)}
              nome={`Filtro: ${f.rotulo}`}
              variante="filtro"
            />
          </li>
        ))}
      </ul>

      {colecao === null ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
          Nenhuma parte do corpo com esses filtros.
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <p className="numero text-muted-foreground text-xs">{colecao.detalhe}</p>
            <div className="flex items-center gap-2">
              {mostrarRaios && colecao.raios ? (
                <Raios nivel={colecao.raios} tamanho="sm" className="text-primary" />
              ) : null}
              <Link
                href={hrefDaColecao({ id: `grupo:${grupo}` })}
                className="alvo text-primary flex items-center text-xs underline underline-offset-4"
              >
                Ver tudo
              </Link>
            </div>
          </div>

          <ListaDaColecao
            ids={ids.slice(0, 6)}
            titulo={`Exercícios de ${colecao.titulo}`}
            mostrarRaios={mostrarRaios}
            prefs={prefs}
          />

          <BotaoLargo
            disabled={!pronto || ocupado || escolhidos.length === 0}
            onClick={() =>
              void comecar(escolhidos, { titulo: colecao.titulo, colecao: colecao.id })
            }
          >
            {ocupado ? "Começando…" : `Começar ${colecao.titulo}`}
          </BotaoLargo>
        </>
      )}
    </section>
  );
}

function Chip({
  rotulo,
  nome,
  ativo,
  aoTocar,
  variante = "grupo",
}: {
  rotulo: string;
  nome: string;
  ativo: boolean;
  aoTocar: () => void;
  variante?: "grupo" | "filtro";
}) {
  return (
    <button
      type="button"
      aria-label={nome}
      aria-pressed={ativo}
      onClick={aoTocar}
      className={cn(
        "alvo flex h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap",
        ativo
          ? "border-primary bg-primary text-primary-foreground font-medium"
          : "border-border bg-card hover:bg-muted",
        variante === "filtro" && !ativo && "text-muted-foreground",
      )}
    >
      {rotulo}
    </button>
  );
}

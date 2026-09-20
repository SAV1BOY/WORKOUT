"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FILTROS_VAZIOS,
  NOME_EQUIPAMENTO,
  NOME_IMPLEMENTO,
  filtrarExercicios,
  idsDoPrograma,
  opcoesDoCatalogo,
  temFiltro,
  type FiltrosCatalogo,
} from "@/lib/catalogo";
import { Miniatura } from "@/components/ui/miniatura";
import { exercicios } from "@/lib/dados";
import { evitado, evitadosPorUltimo } from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";
import type { EquipamentoTag, Exercicio, Grupo, Implemento } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * O catálogo dos 81 exercícios (SPEC §3.6): busca sem acento e filtros por
 * grupo, equipamento, implemento e "está no meu programa".
 *
 * O conteúdo vem de `data/exercicios.json` (nada é escrito aqui) e a filtragem
 * é de `lib/catalogo.ts`, que os testes cobrem.
 */
export function ListaExercicios({
  busca,
}: {
  /**
   * Busca vinda de fora (a barra única do Explorar, SPEC §14.4). Quando vem,
   * a caixa daqui some: duas buscas na mesma tela confundem.
   */
  busca?: string;
} = {}) {
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_VAZIOS);
  const deFora = busca !== undefined;
  const doPrograma = useMemo(() => idsDoPrograma(), []);
  const opcoes = useMemo(() => opcoesDoCatalogo(exercicios), []);
  const prefs = usePerfil().data?.prefs;
  // SPEC §14.1.2: o que foi marcado como "não gosto" aparece por último
  const usados = useMemo(
    () => (deFora ? { ...filtros, busca: busca ?? "" } : filtros),
    [deFora, filtros, busca],
  );
  const achados = useMemo(
    () => evitadosPorUltimo(filtrarExercicios(exercicios, usados, doPrograma), (e) => e.id, prefs),
    [usados, doPrograma, prefs],
  );

  const mudar = (parte: Partial<FiltrosCatalogo>) =>
    setFiltros((atual) => ({ ...atual, ...parte }));

  return (
    <div className="flex flex-col gap-3">
      {deFora ? null : (
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          inputMode="search"
          value={filtros.busca}
          onChange={(e) => mudar({ busca: e.target.value })}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício pelo nome"
          className="alvo h-12 pl-9 text-base"
        />
        {filtros.busca ? (
          <button
            type="button"
            onClick={() => mudar({ busca: "" })}
            aria-label="Limpar a busca"
            className="alvo text-muted-foreground absolute top-1/2 right-0 flex -translate-y-1/2 items-center justify-center"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Selecao
          rotulo="Grupo"
          valor={filtros.grupo}
          aoMudar={(v) => mudar({ grupo: v as Grupo | "todos" })}
          opcoes={opcoes.grupos.map((g) => ({ valor: g, nome: g }))}
        />
        <Selecao
          rotulo="Implemento"
          valor={filtros.implemento}
          aoMudar={(v) => mudar({ implemento: v as Implemento | "todos" })}
          opcoes={opcoes.implementos.map((i) => ({ valor: i, nome: NOME_IMPLEMENTO[i] }))}
        />
        <Selecao
          rotulo="Equipamento"
          valor={filtros.equipamento}
          aoMudar={(v) => mudar({ equipamento: v as EquipamentoTag | "todos" })}
          opcoes={opcoes.equipamentos.map((e) => ({ valor: e, nome: NOME_EQUIPAMENTO[e] }))}
          className="col-span-2"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={filtros.soPrograma ? "default" : "outline"}
          className="alvo h-11 flex-1"
          aria-pressed={filtros.soPrograma}
          onClick={() => mudar({ soPrograma: !filtros.soPrograma })}
        >
          No meu programa
        </Button>
        {temFiltro(filtros) ? (
          <Button
            type="button"
            variant="ghost"
            className="alvo h-11"
            onClick={() => setFiltros(FILTROS_VAZIOS)}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs" aria-live="polite">
        {achados.length === exercicios.length
          ? `${exercicios.length} exercícios`
          : `${achados.length} de ${exercicios.length} exercícios`}
      </p>

      {achados.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
          Nenhum exercício com esses filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {achados.map((e) => (
            <li key={e.id}>
              <CardDoExercicio
                exercicio={e}
                noPrograma={doPrograma.has(e.id)}
                evitar={evitado(prefs, e.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Selecao({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  className,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: { valor: string; nome: string }[];
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {rotulo}
      </span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="alvo border-input bg-background h-11 rounded-md border px-2 text-sm"
      >
        <option value="todos">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

function CardDoExercicio({
  exercicio,
  noPrograma,
  evitar,
}: {
  exercicio: Exercicio;
  noPrograma: boolean;
  evitar: boolean;
}) {
  return (
    <Link
      href={`/exercicios/${exercicio.id}`}
      className="alvo border-border bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-2 transition-colors"
    >
      {/* marco Mídia: a ilustração vem na frente da figura e da foto */}
      <Miniatura exercicioId={exercicio.id} className="rounded-lg" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm leading-tight font-medium text-balance">
          {exercicio.nome}
        </span>
        <span className="text-muted-foreground line-clamp-2 text-xs">
          {exercicio.grupo} · {exercicio.equipamento_texto}
        </span>
        <span className="flex items-center gap-2">
          <span className="numero text-xs">{exercicio.prescricao_padrao.texto}</span>
          {noPrograma ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              no programa
            </Badge>
          ) : null}
          {evitar ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              você marcou como evitar
            </Badge>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

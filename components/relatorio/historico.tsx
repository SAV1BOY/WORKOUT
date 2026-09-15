"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { addDays } from "date-fns";
import { useMemo, useState } from "react";
import { FaixaSemana } from "@/components/ui/faixa-semana";
import { formatarData } from "@/lib/formato";
import { iso, inicioDaSemana, paraData, semanaDoPlano } from "@/lib/calendario";
import { registros, textoDoMotorDaSessao, type EventoDeSessao } from "@/lib/relatorio";
import type { CardioBruto, SerieBruta, SessaoBruta, SoltaBruta } from "@/lib/progresso";
import { faixaDaSemana, montarGrade } from "@/lib/semana";
import type { LinhaPerfil, LinhaExcecaoAgenda } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Quantos registros a lista mostra antes do "Ver mais". */
const PAGINA = 12;

/**
 * Histórico (SPEC §13.5): a faixa da semana navegável e "Todos os registros" —
 * sessões de força com treino, duração, séries e ↑/=/↓; cardio com tipo,
 * semana e duração; e as repetições soltas do dia.
 */
export function Historico({
  hoje,
  perfil,
  overrides,
  sessoes,
  cardios,
  series,
  soltas,
  eventos,
}: {
  hoje: string;
  perfil: LinhaPerfil;
  overrides: LinhaExcecaoAgenda[];
  sessoes: SessaoBruta[];
  cardios: CardioBruto[];
  series: SerieBruta[];
  soltas: SoltaBruta[];
  eventos: EventoDeSessao[];
}) {
  /** Quantas semanas atrás da de hoje a faixa está (0 = esta semana). */
  const [atras, setAtras] = useState(0);
  const [tudo, setTudo] = useState(false);

  const inicio = useMemo(
    () => iso(addDays(inicioDaSemana(paraData(hoje)), -7 * atras)),
    [hoje, atras],
  );
  const fim = useMemo(() => iso(addDays(paraData(inicio), 6)), [inicio]);

  const dias = useMemo(() => {
    const semana = semanaDoPlano(inicio, perfil, overrides);
    return faixaDaSemana(
      montarGrade(
        semana,
        sessoes.map((s) => ({ ...s, id: s.id })),
        cardios.map((c, i) => ({
          id: `c${i}`,
          data: c.data,
          tipo: c.tipo,
          concluida: c.concluida,
        })),
        hoje,
      ),
    );
  }, [inicio, perfil, overrides, sessoes, cardios, hoje]);

  const daSemana = useMemo(
    () => registros({ sessoes, cardios, series, soltas, eventos, de: inicio, ate: fim }),
    [sessoes, cardios, series, soltas, eventos, inicio, fim],
  );
  const todos = useMemo(
    () => registros({ sessoes, cardios, series, soltas, eventos }),
    [sessoes, cardios, series, soltas, eventos],
  );

  const lista = tudo ? todos : daSemana;
  const mostrados = lista.slice(0, PAGINA);

  return (
    <section aria-label="Histórico" className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Histórico</h2>

      <FaixaSemana
        dias={dias}
        rotulo={`${formatarData(inicio)} a ${formatarData(fim)}`}
        aoVoltar={() => setAtras((n) => n + 1)}
        aoAvancar={atras > 0 ? () => setAtras((n) => Math.max(0, n - 1)) : undefined}
      />

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {tudo ? "Todos os registros" : "Registros da semana"}
        </h3>
        <button
          type="button"
          onClick={() => setTudo((v) => !v)}
          aria-pressed={tudo}
          className="alvo text-primary flex items-center text-xs underline underline-offset-4"
        >
          {tudo ? "Só esta semana" : "Todos os registros"}
        </button>
      </div>

      {mostrados.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
          {tudo
            ? "Nenhum registro ainda — o primeiro treino concluído aparece aqui."
            : "Nada registrado nesta semana."}
        </p>
      ) : (
        <ul aria-label="Registros" className="flex flex-col divide-y">
          {mostrados.map((r) => (
            <li key={r.chave}>
              <LinhaDoRegistro registro={r} />
            </li>
          ))}
        </ul>
      )}

      {lista.length > PAGINA ? (
        <p className="text-muted-foreground text-center text-xs">
          Mostrando {PAGINA} de {lista.length}.
        </p>
      ) : null}
    </section>
  );
}

function LinhaDoRegistro({
  registro: r,
}: {
  registro: ReturnType<typeof registros>[number];
}) {
  const motor = textoDoMotorDaSessao(r.motor);
  const miolo = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          r.tipo === "forca"
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {r.tipo === "soltas" ? <Flame className="size-4" /> : r.titulo.slice(0, 1)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-balance">{r.titulo}</span>
        <span className="numero text-muted-foreground text-xs">
          {r.detalhe}
          {motor ? ` · ${motor}` : ""}
        </span>
      </span>
      <span className="numero text-muted-foreground shrink-0 text-xs">
        {formatarData(r.data)}
      </span>
    </>
  );

  if (!r.href) {
    return <span className="flex items-center gap-3 py-2">{miolo}</span>;
  }
  return (
    <Link
      href={r.href}
      data-registro={r.tipo}
      className="hover:bg-muted/40 alvo -mx-1 flex items-center gap-3 rounded-xl px-1 py-2"
    >
      {miolo}
    </Link>
  );
}

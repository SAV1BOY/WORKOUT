"use client";

import { Dumbbell, Flame, Timer, Weight } from "lucide-react";
import Link from "next/link";
import { addDays } from "date-fns";
import { useMemo } from "react";
import { EsqueletoCard, EsqueletoGrade3 } from "@/components/carregando";
import { CardImc } from "@/components/corpo/card-imc";
import { AvisoDeConquista } from "@/components/relatorio/aviso-conquista";
import { CardPeso } from "@/components/relatorio/card-peso";
import { Conquistas } from "@/components/relatorio/conquistas";
import { Historico } from "@/components/relatorio/historico";
import { Numeros } from "@/components/relatorio/numeros";
import { useConquistas } from "@/components/relatorio/usar-conquistas";
import { TelaProgresso } from "@/components/progresso/tela-progresso";
import { Contador } from "@/components/ui/contador";
import { iso, inicioDaSemana, paraData } from "@/lib/calendario";
import { formatarNumero } from "@/lib/formato";
import { ultimoPeso } from "@/lib/corpo";
import { metaSemanal, sequenciaDeDias, sequenciaDeSemanas } from "@/lib/metas";
import { contadoresDoRelatorio } from "@/lib/relatorio";
import { gravarPerfil } from "@/lib/queries/perfil";
import { usePesos } from "@/lib/queries/corpo";
import {
  useCardioTodos,
  useOverrides,
  usePerfil,
  useSoltas,
  useSoltasTodas,
} from "@/lib/queries/dados";
import {
  useEventosDesde,
  useSeriesTodas,
  useSessoesTodas,
} from "@/lib/queries/progresso";
import { useHoje } from "@/lib/relogio";
import { useQueryClient } from "@tanstack/react-query";
import { intervaloDaSemana } from "@/lib/semana";

/** Quantas semanas para trás o histórico e as sequências leem. */
const SEMANAS = 26;

/**
 * `/relatorio` (SPEC §13.5 e §14.4): contadores, histórico com a faixa da
 * semana e "Todos os registros", sequências, Peso e IMC — e, abaixo, os
 * gráficos e recordes que já existiam (§3.7).
 */
export function TelaRelatorio() {
  const hoje = useHoje();
  const cliente = useQueryClient();

  const desde = useMemo(
    () => (hoje ? iso(addDays(inicioDaSemana(paraData(hoje)), -7 * (SEMANAS - 1))) : null),
    [hoje],
  );
  const intervalo = hoje ? intervaloDaSemana(hoje) : null;

  const perfilQ = usePerfil();
  /*
   * SPEC §14.4: os contadores do topo são acumulados, então as três fontes
   * leem a MESMA janela (tudo). O histórico e as sequências recortam as 26
   * semanas destas mesmas listas, sem uma segunda leitura.
   */
  const sessoesQ = useSessoesTodas();
  const seriesQ = useSeriesTodas();
  const cardioQ = useCardioTodos();
  const soltasQ = useSoltas(desde, hoje);
  /* SPEC §19.2: os Números e as conquistas contam desde o começo */
  const soltasTodasQ = useSoltasTodas();
  const eventosQ = useEventosDesde(desde);
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);
  const pesosQ = usePesos();

  const perfil = perfilQ.data ?? null;
  const sessoes = useMemo(() => sessoesQ.data ?? [], [sessoesQ.data]);
  const cardios = useMemo(() => cardioQ.data ?? [], [cardioQ.data]);
  const series = useMemo(() => seriesQ.data ?? [], [seriesQ.data]);

  const soltasTodas = useMemo(() => soltasTodasQ.data ?? [], [soltasTodasQ.data]);

  const contadores = useMemo(
    () => contadoresDoRelatorio({ sessoes, cardios, series }),
    [sessoes, cardios, series],
  );

  const conquistas = useConquistas();

  /* a janela do histórico e dos gráficos, recortada do que já foi lido */
  const seriesDaJanela = useMemo(
    () => (desde ? series.filter((s) => (s.registrada_em ?? "") >= desde) : series),
    [series, desde],
  );
  const cardiosDaJanela = useMemo(
    () => (desde ? cardios.filter((c) => c.data >= desde) : cardios),
    [cardios, desde],
  );

  if (!hoje || !perfil) {
    return (
      <Tela>
        <EsqueletoGrade3 />
        <EsqueletoCard linhas={3} />
      </Tela>
    );
  }

  const meta = metaSemanal(perfil.prefs, perfil.fase_atual);
  const dias = sequenciaDeDias({ sessoes, cardios, hoje });
  const semanas = sequenciaDeSemanas({ sessoes, cardios, hoje, meta });
  const pesos = pesosQ.data ?? [];
  const peso = ultimoPeso(pesos);

  return (
    <Tela>
      <section aria-label="Totais" className="grid grid-cols-3 gap-2">
        <Contador
          rotulo="Treinos"
          valor={formatarNumero(contadores.treinos)}
          detalhe="no total"
          icone={<Dumbbell aria-hidden="true" className="size-3" />}
        />
        <Contador
          rotulo="Minutos"
          valor={formatarNumero(contadores.minutos)}
          detalhe="no total"
          icone={<Timer aria-hidden="true" className="size-3" />}
        />
        {/*
          A unidade vai no detalhe (SPEC §22.2 item 1): "300 kg" em 22 px não
          cabe numa das três colunas a 360 px, e "VOLUME (KG)" no rótulo
          quebrava em duas linhas e desalinhava a base dos três contadores.
        */}
        <Contador
          rotulo="Volume"
          valor={formatarNumero(contadores.volumeKg)}
          detalhe="kg no total"
          icone={<Weight aria-hidden="true" className="size-3" />}
        />
      </section>

      <AvisoDeConquista />

      <Numeros
        hoje={hoje}
        sessoes={sessoes}
        series={series}
        cardios={cardios}
        soltas={soltasTodas}
      />

      <Conquistas lista={conquistas.lista} />

      <Historico
        hoje={hoje}
        perfil={perfil}
        overrides={overridesQ.data ?? []}
        sessoes={sessoes}
        cardios={cardiosDaJanela}
        series={seriesDaJanela}
        soltas={soltasQ.data ?? []}
        eventos={eventosQ.data ?? []}
      />

      <section aria-label="Sequências" className="grid grid-cols-2 gap-2">
        <Contador
          rotulo="Dias seguidos"
          valor={formatarNumero(dias)}
          detalhe={dias === 0 ? "comece hoje" : "com alguma sessão"}
          icone={<Flame aria-hidden="true" className="size-3" />}
        />
        <Contador
          rotulo="Semanas seguidas"
          valor={formatarNumero(semanas)}
          detalhe={`com a meta de ${formatarNumero(meta)}`}
          icone={<Flame aria-hidden="true" className="size-3" />}
        />
      </section>

      <CardPeso pesos={pesos} />

      <CardImc
        pesoKg={peso?.peso ?? null}
        alturaCm={perfil.altura_cm}
        aoMudarAltura={(cm) =>
          void gravarPerfil({
            userId: perfil.user_id,
            mudanca: { altura_cm: cm },
            cliente,
          })
        }
      />

      <TelaProgresso comCabecalho={false} />
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Relatório" className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Relatório</h1>
          <p className="text-muted-foreground text-sm text-balance">
            O que já foi feito e para onde a carga está indo.
          </p>
        </div>
        <Link
          href="/exercicios"
          className="alvo border-border bg-card hover:bg-accent flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium"
        >
          Catálogo de exercícios
          <span aria-hidden="true">→</span>
        </Link>
      </header>
      {children}
    </section>
  );
}

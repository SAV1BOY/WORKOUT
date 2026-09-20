"use client";

import { ChevronDown, Dumbbell, Flame, Timer, Weight } from "lucide-react";
import Link from "next/link";
import { addDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
import { TOTAL_DE_CONQUISTAS, totalConquistado } from "@/lib/conquistas";
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
import { cn } from "@/lib/utils";
import { intervaloDaSemana } from "@/lib/semana";

/** Quantas semanas para trás o histórico e as sequências leem. */
const SEMANAS = 26;

/** As cinco seções dobráveis do Relatório (SPEC §22.6 item 1). */
const SECOES = ["resumo", "conquistas", "historico", "corpo", "graficos"] as const;
type IdDeSecao = (typeof SECOES)[number];

/** Onde o estado das seções fica guardado entre visitas. */
const CHAVE = "relatorio:secoes";

/** A tela abre pelo Resumo; o resto está a um toque do cabeçalho. */
const PADRAO: Record<IdDeSecao, boolean> = {
  resumo: true,
  conquistas: false,
  historico: false,
  corpo: false,
  graficos: false,
};

function lerGuardadas(): Partial<Record<IdDeSecao, boolean>> {
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return {};
    const lido: unknown = JSON.parse(cru);
    if (!lido || typeof lido !== "object") return {};
    const saida: Partial<Record<IdDeSecao, boolean>> = {};
    for (const id of SECOES) {
      const v = (lido as Record<string, unknown>)[id];
      if (typeof v === "boolean") saida[id] = v;
    }
    return saida;
  } catch {
    return {};
  }
}

/**
 * O estado aberto/fechado de cada seção, lembrado em `localStorage`
 * (SPEC §22.6 item 1). A leitura é depois da montagem — no servidor não há
 * `localStorage` e ler no primeiro render trocaria o HTML por baixo da
 * hidratação.
 *
 * `montadas` é o que já abriu alguma vez: o conteúdo de uma seção fechada
 * nunca é montado, então a seção Gráficos não pede as consultas nem desenha
 * os Recharts enquanto ninguém a abrir.
 */
function useSecoes() {
  const [abertas, setAbertas] = useState<Record<IdDeSecao, boolean>>(PADRAO);
  const [montadas, setMontadas] = useState<IdDeSecao[]>(() =>
    SECOES.filter((id) => PADRAO[id]),
  );

  useEffect(() => {
    const guardadas = lerGuardadas();
    if (Object.keys(guardadas).length === 0) return;
    setAbertas((a) => ({ ...a, ...guardadas }));
    setMontadas((m) => [
      ...m,
      ...SECOES.filter((id) => guardadas[id] === true && !m.includes(id)),
    ]);
  }, []);

  const alternar = useCallback((id: IdDeSecao, aberta: boolean) => {
    setAbertas((a) => {
      if (a[id] === aberta) return a;
      const proximo = { ...a, [id]: aberta };
      try {
        window.localStorage.setItem(CHAVE, JSON.stringify(proximo));
      } catch {
        /* navegação privada: a tela continua funcionando sem memória */
      }
      return proximo;
    });
    if (aberta) setMontadas((m) => (m.includes(id) ? m : [...m, id]));
  }, []);

  return { abertas, montadas, alternar };
}

/**
 * `/relatorio` (SPEC §13.5, §14.4 e §22.6): cinco seções dobráveis — Resumo,
 * Conquistas, Histórico, Corpo e Gráficos —, cada uma com o cabeçalho grudado
 * no topo e a caixa reservada antes de o dado chegar.
 */
export function TelaRelatorio() {
  const hoje = useHoje();
  const cliente = useQueryClient();
  const { abertas, montadas, alternar } = useSecoes();

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

  const pronto = Boolean(hoje && perfil);
  const feitas = totalConquistado(conquistas.lista);
  const meta = perfil ? metaSemanal(perfil.prefs, perfil.fase_atual) : 0;
  const dias = hoje ? sequenciaDeDias({ sessoes, cardios, hoje }) : 0;
  const semanas = hoje ? sequenciaDeSemanas({ sessoes, cardios, hoje, meta }) : 0;
  const pesos = pesosQ.data ?? [];
  const peso = ultimoPeso(pesos);

  const comum = { abertas, montadas, aoAlternar: alternar };

  return (
    <section aria-label="Relatório" className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Relatório</h1>
        <p className="text-muted-foreground text-sm text-balance">
          O que já foi feito e para onde a carga está indo.
        </p>
      </header>

      <Secao
        {...comum}
        id="resumo"
        titulo="Resumo"
        subtitulo="Os acumulados de sempre e os números do período."
      >
        {/*
          SPEC §22.6 item 4: o rótulo do acumulado diz o que ele soma. Antes
          este contador dizia "51 no total" e o card de treinos dos gráficos
          dizia "46 no total" na mesma rolagem — o mesmo rótulo com dois
          números.
        */}
        <section aria-label="Totais" className="grid grid-cols-3 gap-2">
          <Contador
            className="grid grid-rows-[auto_1fr_auto]"
            rotulo="Sessões"
            valor={pronto ? formatarNumero(contadores.treinos) : "—"}
            detalhe="no total (força + cardio)"
            icone={<Dumbbell aria-hidden="true" className="size-3.5 shrink-0" />}
          />
          <Contador
            className="grid grid-rows-[auto_1fr_auto]"
            rotulo="Minutos"
            valor={pronto ? formatarNumero(contadores.minutos) : "—"}
            detalhe="no total"
            icone={<Timer aria-hidden="true" className="size-3.5 shrink-0" />}
          />
          {/*
            A unidade vai no detalhe (SPEC §22.2 item 1): "300 kg" em 22 px não
            cabe numa das três colunas a 360 px, e "VOLUME (KG)" no rótulo
            quebrava em duas linhas e desalinhava a base dos três contadores.
          */}
          <Contador
            className="grid grid-rows-[auto_1fr_auto]"
            rotulo="Volume"
            valor={pronto ? formatarNumero(contadores.volumeKg) : "—"}
            detalhe="kg no total"
            icone={<Weight aria-hidden="true" className="size-3.5 shrink-0" />}
          />
        </section>

        {hoje ? (
          <Numeros
            hoje={hoje}
            sessoes={sessoes}
            series={series}
            cardios={cardios}
            soltas={soltasTodas}
          />
        ) : (
          <EsqueletoNumeros />
        )}

        <section aria-label="Sequências" className="grid grid-cols-2 gap-2">
          <Contador
            className="grid grid-rows-[auto_1fr_auto]"
            rotulo="Dias seguidos"
            valor={pronto ? formatarNumero(dias) : "—"}
            detalhe={dias === 0 ? "comece hoje" : "com alguma sessão"}
            icone={<Flame aria-hidden="true" className="size-3.5 shrink-0" />}
          />
          <Contador
            className="grid grid-rows-[auto_1fr_auto]"
            rotulo="Semanas seguidas"
            valor={pronto ? formatarNumero(semanas) : "—"}
            detalhe={`com a meta de ${formatarNumero(meta)}`}
            icone={<Flame aria-hidden="true" className="size-3.5 shrink-0" />}
          />
        </section>
      </Secao>

      {/*
        SPEC §22.6 item 2: o aviso mora ao lado do assunto dele, não no alto
        da tela. Ele só existe DEPOIS das ~10 leituras, e no alto empurrava
        297 px de conteúdo já pintado para baixo — sozinho, 0,3155 de CLS.
      */}
      <AvisoDeConquista />

      <Secao
        {...comum}
        id="conquistas"
        titulo="Conquistas"
        contador={`${formatarNumero(feitas)} de ${formatarNumero(TOTAL_DE_CONQUISTAS)}`}
        subtitulo="Marcos que saem dos seus próprios registros."
      >
        <Conquistas lista={conquistas.lista} />
      </Secao>

      <Secao
        {...comum}
        id="historico"
        titulo="Histórico"
        subtitulo="A semana marcada e a lista de tudo o que foi registrado."
      >
        {pronto && hoje && perfil ? (
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
        ) : (
          <EsqueletoLinhas linhas={3} />
        )}
      </Secao>

      <Secao
        {...comum}
        id="corpo"
        titulo="Corpo"
        subtitulo="O peso registrado e o IMC calculado com a sua altura."
      >
        <CardPeso pesos={pesos} />
        {perfil ? (
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
        ) : (
          <EsqueletoLinhas linhas={2} />
        )}
      </Secao>

      <Secao
        {...comum}
        id="graficos"
        titulo="Gráficos"
        subtitulo="Carga dos grandes, volume, barra fixa, corrida e recordes."
      >
        <TelaProgresso comCabecalho={false} />
      </Secao>

      {/*
        SPEC §22.6 item 3: o atalho vinha ANTES dos totais e empurrava os
        números para baixo da dobra. O Relatório começa pelos números; o
        catálogo é a saída do fim da tela.
      */}
      <Link
        href="/exercicios"
        className="alvo border-border bg-card hover:bg-accent flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium"
      >
        Catálogo de exercícios
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

/**
 * Uma seção dobrável, com o cabeçalho grudado no topo (SPEC §22.6 itens 1 e
 * 3): o contador curto na linha de base do título e a explicação como
 * subtítulo — a 360 px a frase ao lado do título roubava a leitura dele.
 */
function Secao({
  id,
  titulo,
  contador,
  subtitulo,
  abertas,
  montadas,
  aoAlternar,
  children,
}: {
  id: IdDeSecao;
  titulo: string;
  contador?: string;
  subtitulo: string;
  abertas: Record<IdDeSecao, boolean>;
  montadas: IdDeSecao[];
  aoAlternar: (id: IdDeSecao, aberta: boolean) => void;
  children: React.ReactNode;
}) {
  const aberta = abertas[id];
  return (
    <details
      data-secao={id}
      open={aberta}
      onToggle={(e) => aoAlternar(id, e.currentTarget.open)}
      className="cartao border-border bg-card group border"
    >
      <summary
        data-secao-cabecalho={id}
        className={cn(
          "alvo bg-card sticky top-0 z-10 flex cursor-pointer list-none items-start gap-2 rounded-xl px-3 py-2.5",
          "[&::-webkit-details-marker]:hidden",
          aberta && "border-border rounded-b-none border-b",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{titulo}</h2>
            {contador ? (
              <span className="numero text-muted-foreground shrink-0 text-xs">
                {contador}
              </span>
            ) : null}
          </span>
          {/*
            A explicação só na seção ABERTA: recolhida, o cabeçalho é uma
            linha de 56 px, e a tela inteira cabe em menos de 1.500 px.
          */}
          {aberta ? (
            <span className="text-muted-foreground text-xs text-balance">
              {subtitulo}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground mt-1 size-5 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-4 px-3 pt-3 pb-3">
        {montadas.includes(id) ? children : null}
      </div>
    </details>
  );
}

/**
 * A caixa dos Números antes de o relógio e o perfil chegarem (SPEC §22.6
 * item 2): a MESMA forma da versão final — cabeçalho, seletor de período,
 * a fileira de três, as três linhas de detalhe e a fileira de dois.
 */
function EsqueletoNumeros() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-13 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[4.75rem] rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[4.75rem] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Linhas reservadas enquanto a seção não tem dado (SPEC §22.6 item 2). */
function EsqueletoLinhas({ linhas }: { linhas: number }) {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

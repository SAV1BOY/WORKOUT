"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { DadosDoFim, FimDoCardio } from "@/components/cardio/fim-cardio";
import { ListaDeBlocos, TimerIntervalos } from "@/components/cardio/timer-intervalos";
import { Button } from "@/components/ui/button";
import { calar } from "@/lib/apito";
import {
  avancar,
  avancoDeSemana,
  decorridoTotal,
  niveisDeEsforco,
  planoDeCardio,
  pausar,
  pularBloco,
  retomar,
  saltosEstimados,
  sessoesDaSemanaCivil,
  textoDoPlano,
  timerInicial,
  trabalhoCumprido,
} from "@/lib/cardio";
import { formatarDuracao, formatarKm, formatarMinutos } from "@/lib/formato";
import { useCardio, useCardioPorId, usePerfil } from "@/lib/queries/dados";
import {
  apagarCardioLocal,
  cardioLocalAberto,
  descarregarCardio,
  encerrarCardio,
  novoId,
  salvarCardioLocal,
  type CardioLocal,
} from "@/lib/queries/cardio";
import { aplicarAvanco } from "@/lib/queries/perfil";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";
import type { Esforco, LinhaSessaoCardio, TipoCardio } from "@/lib/types";
import { useTelaAcesa } from "@/lib/wake-lock";

/**
 * `/cardio/[id]` (SPEC §3.3): o timer de intervalos da sessão da semana, o
 * cronômetro simples da caminhada e o fim da sessão.
 *
 * O estado do timer vive no IndexedDB (lib/queries/cardio.ts): recarregar a
 * página, sair da aba ou ficar sem rede não perde a sessão.
 */
export function TelaCardio({
  userId,
  tipo,
  semanaPedida,
  sessaoId,
}: {
  userId: string;
  tipo: TipoCardio;
  /** `?semana=` da URL, para rever uma semana específica do plano. */
  semanaPedida: number | null;
  /** `?sessao=` da URL: uma sessão já registrada, só leitura (§3.5). */
  sessaoId: string | null;
}) {
  const router = useRouter();
  const cliente = useQueryClient();
  const hoje = useHoje();
  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;

  const intervalo = hoje ? intervaloDaSemana(hoje) : null;
  const cardioQ = useCardio(intervalo?.de ?? null, intervalo?.ate ?? null);
  const registradaQ = useCardioPorId(sessaoId);

  const [sessao, setSessao] = useState<CardioLocal | null | undefined>(undefined);
  const [agora, setAgora] = useState(() => Date.now());
  const [encerrando, setEncerrando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const semanaDoPerfil =
    tipo === "corda" ? (perfil?.semana_corda ?? 1) : (perfil?.semana_corrida ?? 1);
  const semana = semanaPedida ?? semanaDoPerfil;
  const plano = useMemo(() => planoDeCardio(tipo, semana), [tipo, semana]);
  const prefs = perfil?.prefs ?? {};
  const comBlocos = plano.blocos.length > 0;

  /* ------------------------------------------- a sessão neste aparelho */

  /*
   * Uma sessão por tela: o efeito depende do perfil (que pode ser relido) e
   * `salvarCardioLocal` tem debounce, então sem esta trava duas passadas
   * seguidas criariam duas sessões para o mesmo dia.
   */
  const comecou = useRef(false);
  useEffect(() => {
    if (sessaoId || !hoje || !perfil || comecou.current) return;
    comecou.current = true;
    let vivo = true;
    void cardioLocalAberto(hoje, tipo).then((achada) => {
      if (!vivo) return;
      if (achada) {
        setSessao(achada);
        return;
      }
      const nova: CardioLocal = {
        id: novoId(),
        userId,
        data: hoje,
        tipo,
        semana: comBlocos ? semana : null,
        iniciadaEm: new Date().toISOString(),
        // começa parada: quem aperta "Começar" é o Miguel, não a navegação
        timer: timerInicial(false, Date.now()),
        encerrada: false,
      };
      salvarCardioLocal(nova);
      setSessao(nova);
    });
    return () => {
      vivo = false;
    };
  }, [sessaoId, hoje, perfil, tipo, userId, semana, comBlocos]);

  /* ------------------------------------------------ relógio e saída da aba */

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 500);
    const aoSair = () => void descarregarCardio();
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("visibilitychange", aoSair);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("pagehide", aoSair);
      document.removeEventListener("visibilitychange", aoSair);
      void descarregarCardio();
      calar();
    };
  }, []);

  const mexer = useCallback(
    (fn: (atual: CardioLocal) => CardioLocal) => {
      setSessao((atual) => {
        if (!atual) return atual;
        const nova = fn(atual);
        if (nova === atual) return atual;
        salvarCardioLocal(nova);
        return nova;
      });
    },
    [],
  );

  /* O tempo passa: a troca de bloco é calculada, nunca contada em ticks. */
  useEffect(() => {
    if (!sessao || !comBlocos || sessao.timer.terminado) return;
    const novo = avancar(sessao.timer, plano.blocos, agora);
    if (novo !== sessao.timer) mexer((atual) => ({ ...atual, timer: novo }));
  }, [agora, sessao, plano.blocos, comBlocos, mexer]);

  const rodando = sessao?.timer.desdeMs != null;
  useTelaAcesa(prefs.manter_tela !== false && rodando);

  /* --------------------------------------------------------- encerrar */

  const salvar = async (dados: DadosDoFim) => {
    if (!sessao || !perfil || !hoje) return;
    setSalvando(true);
    try {
      const agoraMs = Date.now();
      const cumpridas = trabalhoCumprido(sessao.timer, plano.blocos);
      await descarregarCardio();
      await encerrarCardio({
        sessao,
        plano,
        agoraMs,
        distanciaKm: dados.distanciaKm,
        saltos: dados.saltos,
        esforco: dados.esforco,
        notas: dados.notas,
        concluida: true,
        intervalo,
        cliente,
      });

      /*
       * SPEC §5.5: a semana do plano avança quando as 2 sessões da semana
       * civil foram concluídas. A sessão recém-salva ainda não está na
       * leitura, então entra na conta aqui.
       */
      if (comBlocos && !sessaoId) {
        const feitas =
          sessoesDaSemanaCivil(
            (cardioQ.data ?? []).filter((c) => c.id !== sessao.id),
            tipo,
            hoje,
          ) + 1;
        const avanco = avancoDeSemana({
          plano: tipo === "corda" ? "corda" : "corrida",
          semanaAtual: semanaDoPerfil,
          sessoesDaSemanaCivil: feitas,
          hoje,
          prefs,
        });
        if (avanco) {
          await aplicarAvanco({ userId, avanco, cliente });
          toast.success(`Semana ${avanco.semana} do plano liberada.`);
        }
      }

      calar();
      toast.success(
        cumpridas > 0
          ? `Cardio salvo · ${cumpridas} de ${plano.repeticoes} blocos.`
          : "Cardio salvo.",
      );
      router.push("/");
    } catch {
      setSalvando(false);
      toast.error("Não consegui salvar agora. Está tudo guardado no aparelho.");
    }
  };

  const descartar = async () => {
    if (!sessao) return;
    await apagarCardioLocal(sessao.id);
    calar();
    router.push("/");
  };

  /* ------------------------------------------------------- renderizar */

  if (sessaoId) {
    return (
      <Tela titulo={plano.titulo} descricao="Sessão registrada">
        <SessaoRegistrada
          linha={registradaQ.data ?? null}
          carregando={registradaQ.isPending}
        />
      </Tela>
    );
  }

  if (perfilQ.isError) {
    return (
      <Tela titulo={plano.titulo} descricao={plano.descricao ?? ""}>
        <Erro
          mensagem={(perfilQ.error as Error).message}
          aoTentarDeNovo={() => void perfilQ.refetch()}
        />
      </Tela>
    );
  }

  if (!sessao || !hoje) {
    return (
      <Tela titulo={plano.titulo} descricao={plano.descricao ?? ""}>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  const decorridoS = Math.round(decorridoTotal(sessao.timer, agora));
  const cumpridas = trabalhoCumprido(sessao.timer, plano.blocos);

  return (
    <Tela titulo={plano.titulo} descricao={textoDoPlano(plano)}>
      {comBlocos ? (
        <TimerIntervalos
          blocos={plano.blocos}
          timer={sessao.timer}
          agoraMs={agora}
          voz={prefs.cardio_voz !== false}
          vibracao={prefs.descanso_vibra !== false}
          aoPausar={() => mexer((a) => ({ ...a, timer: pausar(a.timer, Date.now()) }))}
          aoRetomar={() => mexer((a) => ({ ...a, timer: retomar(a.timer, Date.now()) }))}
          aoPular={() =>
            mexer((a) => ({ ...a, timer: pularBloco(a.timer, plano.blocos, Date.now()) }))
          }
        />
      ) : (
        <Cronometro
          segundos={decorridoS}
          rodando={rodando}
          aoPausar={() => mexer((a) => ({ ...a, timer: pausar(a.timer, Date.now()) }))}
          aoRetomar={() => mexer((a) => ({ ...a, timer: retomar(a.timer, Date.now()) }))}
        />
      )}

      {sessao.timer.terminado ? (
        <p className="border-primary/40 bg-primary/5 rounded-lg border p-3 text-center text-sm">
          Acabou. {formatarDuracao(decorridoS)} · {cumpridas} de {plano.repeticoes} blocos.
        </p>
      ) : null}

      <Button
        variant={sessao.timer.terminado ? "default" : "outline"}
        className="alvo h-14 w-full text-base font-semibold"
        onClick={() => setEncerrando(true)}
      >
        Encerrar e registrar
      </Button>

      {comBlocos ? (
        <ListaDeBlocos
          blocos={plano.blocos}
          indice={sessao.timer.indice}
          cumpridos={sessao.timer.cumpridos}
        />
      ) : null}

      {plano.notas.length > 0 ? (
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-xs">
          {plano.notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <Button variant="ghost" className="alvo h-11" onClick={() => void descartar()}>
        Sair sem registrar
      </Button>

      <FimDoCardio
        aberto={encerrando}
        plano={plano}
        decorridoS={decorridoS}
        repeticoesCumpridas={cumpridas}
        saltosSugeridos={saltosEstimados(plano, cumpridas)}
        salvando={salvando}
        aoFechar={() => setEncerrando(false)}
        aoSalvar={(dados) => void salvar(dados)}
      />
    </Tela>
  );
}

/* ------------------------------------------------------------ pedaços */

function Tela({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm text-balance">{descricao}</p>
      </header>
      {children}
    </section>
  );
}

/** Caminhada leve e "outro": só duração (SPEC §3.3). */
function Cronometro({
  segundos,
  rodando,
  aoPausar,
  aoRetomar,
}: {
  segundos: number;
  rodando: boolean;
  aoPausar: () => void;
  aoRetomar: () => void;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label="Cronômetro">
      <div className="bg-secondary text-secondary-foreground flex flex-col gap-1 rounded-xl p-4">
        <span className="text-sm opacity-80">tempo</span>
        <p role="timer" aria-live="off" className="numero text-6xl leading-none">
          {formatarDuracao(segundos)}
        </p>
      </div>
      <Button
        className="alvo h-14 w-full text-base font-semibold"
        onClick={rodando ? aoPausar : aoRetomar}
      >
        {rodando ? "Pausar" : segundos > 0 ? "Retomar" : "Começar"}
      </Button>
    </section>
  );
}

/** O que foi registrado num dia que já passou (o calendário abre aqui). */
function SessaoRegistrada({
  linha,
  carregando,
}: {
  linha: LinhaSessaoCardio | null;
  carregando: boolean;
}) {
  if (carregando) return <EsqueletoCard linhas={3} />;
  if (!linha) {
    return (
      <Erro mensagem="Não achei esta sessão de cardio." />
    );
  }
  const feito = (linha.feito ?? {}) as Record<string, unknown>;
  return (
    <dl className="border-border divide-border divide-y rounded-xl border text-sm">
      <Linha termo="Duração" valor={linha.duracao_min !== null ? formatarMinutos(linha.duracao_min) : "—"} />
      <Linha termo="Semana do plano" valor={linha.semana_plano !== null ? String(linha.semana_plano) : "—"} />
      <Linha
        termo="Blocos cumpridos"
        valor={
          typeof feito.repeticoes_cumpridas === "number"
            ? `${feito.repeticoes_cumpridas} de ${feito.repeticoes_planejadas ?? "?"}`
            : "—"
        }
      />
      <Linha
        termo="Distância"
        valor={linha.distancia_km !== null ? formatarKm(linha.distancia_km) : "—"}
      />
      <Linha termo="Saltos" valor={linha.saltos !== null ? String(linha.saltos) : "—"} />
      <Linha termo="Esforço" valor={rotuloDoEsforco(linha.esforco)} />
      <Linha termo="Nota" valor={linha.notas ?? "—"} />
    </dl>
  );
}

/** "facil" é o valor da coluna; na tela vale o texto do JSON ("fácil"). */
function rotuloDoEsforco(valor: Esforco | null): string {
  if (!valor) return "—";
  return niveisDeEsforco().find((n) => n.valor === valor)?.nivel ?? valor;
}

function Linha({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-muted-foreground">{termo}</dt>
      <dd className="numero text-right">{valor}</dd>
    </div>
  );
}

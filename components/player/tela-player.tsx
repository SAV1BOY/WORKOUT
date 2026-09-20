"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Erro, EsqueletoCard } from "@/components/carregando";
import type { ContextoDaFicha } from "@/components/exercicio/ficha-folha";
import { TelaConclusao } from "@/components/player/conclusao";
import { TelaDescanso } from "@/components/player/descanso";
import { TelaExercicio } from "@/components/player/exercicio";
import { TelaFeedback } from "@/components/player/feedback";
import { TelaFirme } from "@/components/player/firme";
import { TelaPreparacao } from "@/components/player/preparacao";
import { useSessaoDeTreino } from "@/components/treinar/usar-sessao";
import { VisaoGeralDaSessao } from "@/components/treinar/visao-geral";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { semanaDaFase } from "@/lib/calendario";
import {
  anterior as passoAnterior,
  apos,
  definirDuracao,
  entradaDoPasso,
  indiceDaChave,
  indiceDeRetomada,
  irPara,
  posicaoNaSequencia,
  seguinte,
  sequenciaDoPlayer,
  serieDoPasso,
  somarSegundos,
  totalDeSeries,
  zerou,
  type EstadoPlayer,
  type PassoSerie,
} from "@/lib/player";
import {
  comVoto,
  ligado,
  opcoesDoPlayer,
  votoDoExercicio,
  type VotoDoExercicio,
} from "@/lib/preferencias";
import { salvarPerfil, salvarPrefs } from "@/lib/queries/mais";
import { useUltimoPeso } from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import {
  ajustarPrescricaoDaSessao,
  contadoresDaSessao,
  firmePadrao,
  type SessaoLocal,
} from "@/lib/sessao";


/**
 * SPEC §22.4 item 10: a ficha em folha traz junto o tutorial e o iframe do
 * YouTube, e nada disso aparece antes de alguém tocar no "?". Com
 * `next/dynamic` ela sai do caminho da primeira série — a rota do player era
 * a mais pesada do app — e chega no primeiro toque.
 */
const FichaEmFolha = dynamic(
  () => import("@/components/exercicio/ficha-folha").then((m) => m.FichaEmFolha),
  { ssr: false },
);

/** Idem para a folha de ajustes: ela é a mesma tela de Mais → Preferências. */
const AjustesDoTreino = dynamic(
  () => import("@/components/mais/ajustes-do-treino").then((m) => m.AjustesDoTreino),
  { ssr: false, loading: () => <EsqueletoCard linhas={3} /> },
);
/**
 * O player (SPEC §14.1): preparação → exercício → descanso → "firme?" →
 * feedback → conclusão, para qualquer sessão de força.
 *
 * O estado do passo vive dentro da sessão, no Dexie (`sessao.player`): fechar
 * o app no meio de um descanso e abrir de novo volta ao mesmo passo, com o
 * relógio ancorado em `Date.now()` — nunca numa soma de ticks.
 */
export function TelaPlayer({
  sessaoId,
  videos = [],
}: {
  sessaoId: string;
  /** Ids com `public/videos/<id>.mp4` (SPEC §13.1). */
  videos?: string[];
}) {
  const router = useRouter();
  const cliente = useQueryClient();
  const hoje = useHoje();
  const dados = useSessaoDeTreino(sessaoId);
  const { sessao, prefs, perfil } = dados;
  const pesoQ = useUltimoPeso();

  const [estado, setEstado] = useState<EstadoPlayer | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [visaoGeral, setVisaoGeral] = useState(false);
  const [ficha, setFicha] = useState<string | null>(null);
  const [ajustar, setAjustar] = useState(false);

  const opcoes = useMemo(() => opcoesDoPlayer(prefs), [prefs]);
  const seq = useMemo(
    () => (sessao ? sequenciaDoPlayer(sessao, opcoes) : []),
    [sessao, opcoes],
  );

  /* ------------------------------------------------- onde estamos */

  // primeira carga: o passo salvo no aparelho, ou o que a sessão deixa retomar
  useEffect(() => {
    if (!sessao || estado !== null || seq.length === 0) return;
    const salvo = sessao.player ?? null;
    if (salvo && indiceDaChave(seq, salvo.chave) >= 0) {
      setEstado(salvo);
      return;
    }
    setEstado(irPara(seq, indiceDeRetomada(seq, sessao), Date.now()));
  }, [sessao, seq, estado]);

  const indice = estado ? indiceDaChave(seq, estado.chave) : -1;
  const passo = indice >= 0 ? seq[indice] : null;

  /** Anota o passo na sessão (Dexie) antes de qualquer animação (§8). */
  const guardar = useCallback(
    (novo: EstadoPlayer) => {
      setEstado(novo);
      dados.mexer((atual: SessaoLocal) => ({ ...atual, player: novo }));
    },
    [dados],
  );

  const ir = useCallback(
    (destino: number) => guardar(irPara(seq, destino, Date.now())),
    [guardar, seq],
  );

  /* ------------------------------------------------------ relógio */

  const contando = estado?.fimEm !== null && estado?.fimEm !== undefined;
  useEffect(() => {
    if (!contando) return;
    const tique = () => setAgora(Date.now());
    tique();
    const relogio = setInterval(tique, 250);
    // voltar para a aba não pode mostrar o número congelado (§14.1)
    const aoVoltar = () => {
      if (document.visibilityState === "visible") tique();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [contando, estado?.chave]);

  // a preparação é uma contagem: ao zerar, o treino começa sozinho (§14.1.1)
  const tipoDoPasso = passo?.tipo;
  useEffect(() => {
    if (tipoDoPasso !== "preparacao" || !estado || !zerou(estado, agora)) return;
    ir(indice + 1);
  }, [tipoDoPasso, estado, agora, indice, ir]);

  /* ------------------------------------------------------ ações */

  const avaliarExercicio = useCallback(
    (exercicioId: string, voto: VotoDoExercicio) => {
      if (!perfil) return;
      void salvarPrefs({
        userId: perfil.user_id,
        prefs: comVoto(prefs, exercicioId, voto),
        cliente,
      });
    },
    [perfil, prefs, cliente],
  );

  const mudarAltura = useCallback(
    (cm: number) => {
      if (!perfil) return;
      void salvarPerfil({
        userId: perfil.user_id,
        mudanca: { altura_cm: cm },
        cliente,
      });
    },
    [perfil, cliente],
  );

  /* -------------------------------------------------- renderizar */

  if (dados.carregando) return <EsqueletoCard linhas={6} />;

  if (!sessao) {
    return (
      <Erro
        mensagem="Não achei este treino. Ele pode ter sido registrado em outro aparelho."
        aoTentarDeNovo={() => router.push("/treinar")}
      />
    );
  }

  if (visaoGeral) {
    return (
      /* tela cheia: no player a barra de abas devolve `null` (§14.1), então
         parar 56 px antes do fim só deixava uma faixa morta (§22.1) */
      <div className="bg-background fixed inset-0 z-50 overflow-y-auto">
        <div className="pb-segura mx-auto w-full max-w-lg px-4 pt-4">
          <VisaoGeralDaSessao
            sessao={sessao}
            dados={dados}
            videos={videos}
            aoFechar={() => setVisaoGeral(false)}
          />
        </div>
      </div>
    );
  }

  if (!estado || !passo) return <EsqueletoCard linhas={6} />;

  const bloco =
    passo.tipo === "serie" || passo.tipo === "firme" || passo.tipo === "preparacao"
      ? (sessao.blocos.find((b) => b.ordem === passo.ordem) ?? null)
      : null;

  /** A ficha aberta de dentro da sessão mexe na prescrição de hoje (§14.2). */
  const contextoDaFicha = ((): ContextoDaFicha | undefined => {
    const alvoBloco = sessao.blocos.find((b) => b.exercicioId === ficha);
    if (!ficha || !alvoBloco) return undefined;
    const pendente =
      alvoBloco.series.find((s) => s.tipo === "trabalho" && !s.concluida) ??
      alvoBloco.series.find((s) => s.tipo === "trabalho");
    const alvoAtual =
      alvoBloco.prescricao.tipo === "tempo_s"
        ? (pendente?.tempoS ?? null)
        : alvoBloco.prescricao.tipo === "passos"
          ? (pendente?.passos ?? null)
          : (pendente?.reps ?? null);
    return {
      series: alvoBloco.series.filter((s) => s.tipo === "trabalho").length,
      alvo: alvoAtual,
      tipo: alvoBloco.prescricao.tipo,
      aoMudarSeries: (n) =>
        dados.mexer((atual) =>
          ajustarPrescricaoDaSessao(atual, alvoBloco.ordem, { series: n }, {
            novoId: () => crypto.randomUUID(),
          }),
        ),
      aoMudarAlvo: (v) =>
        dados.mexer((atual) =>
          ajustarPrescricaoDaSessao(atual, alvoBloco.ordem, { alvo: v }),
        ),
      aoSubstituir: (novo) => {
        dados.substituir(alvoBloco, novo);
        setFicha(novo);
      },
      indice: sessao.blocos.indexOf(alvoBloco),
      total: sessao.blocos.length,
      aoIr: (i) => setFicha(sessao.blocos[i]?.exercicioId ?? null),
    };
  })();

  const folha = (
    <>
      {/* a folha já devolvia `null` sem exercício: aqui ela também não baixa */}
      {ficha !== null ? (
        <FichaEmFolha
          exercicioId={ficha}
          aberto
          aoMudarAberto={(v) => setFicha(v ? ficha : null)}
          temVideo={videos.includes(ficha)}
          contexto={contextoDaFicha}
          prefs={prefs}
        />
      ) : null}
      <Sheet open={ajustar} onOpenChange={setAjustar}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto pb-8">
          <SheetHeader className="pb-0">
            <SheetTitle>Ajustar</SheetTitle>
            <SheetDescription>
              Vale para todos os treinos. Fica em Mais → Preferências.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {perfil && ajustar ? (
              <AjustesDoTreino userId={perfil.user_id} perfil={perfil} />
            ) : (
              <EsqueletoCard linhas={3} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );

  if (passo.tipo === "preparacao") {
    return (
      <>
        <TelaPreparacao
          exercicioId={passo.exercicioId}
          estado={estado}
          agora={agora}
          aoAbrirFicha={() => setFicha(passo.exercicioId)}
          aoPular={() => ir(indice + 1)}
        />
        {folha}
      </>
    );
  }

  if (passo.tipo === "serie" && bloco) {
    const serie = serieDoPasso(sessao, passo);
    if (!serie) return <EsqueletoCard linhas={6} />;
    return (
      <>
        <TelaExercicio
          passo={passo}
          bloco={bloco}
          serie={serie}
          entrada={entradaDoPasso(bloco, serie)}
          opcoes={sessao.opcoesMontagem}
          temVideo={videos.includes(bloco.exercicioId)}
          anteriores={dados.anteriores[bloco.exercicioId]}
          voto={votoDoExercicio(prefs, bloco.exercicioId)}
          feitas={posicaoNaSequencia(seq, indice)}
          total={totalDeSeries(seq)}
          aoMudar={(campos) => dados.mudarSerie(bloco.ordem, serie.id, campos)}
          aoConcluir={() => {
            if (!serie.concluida) dados.marcar(bloco.ordem, serie.id, true);
            ir(apos(seq, indice));
          }}
          aoAnterior={() => ir(passoAnterior(seq, indice))}
          aoProximo={() => ir(seguinte(seq, indice))}
          aoAbrirFicha={() => setFicha(bloco.exercicioId)}
          aoAbrirLista={() => setVisaoGeral(true)}
          aoAjustar={() => setAjustar(true)}
          aoAvaliar={(voto) => avaliarExercicio(bloco.exercicioId, voto)}
        />
        {folha}
      </>
    );
  }

  if (passo.tipo === "descanso") {
    const alvo = seq[passo.indiceProximo];
    const proximo = alvo && alvo.tipo === "serie" ? (alvo as PassoSerie) : null;
    const blocoDoProximo = proximo
      ? (sessao.blocos.find((b) => b.ordem === proximo.ordem) ?? null)
      : null;
    return (
      <TelaDescanso
        estado={estado}
        agora={agora}
        proximo={proximo}
        blocoDoProximo={blocoDoProximo}
        serieDoProximo={proximo ? serieDoPasso(sessao, proximo) : null}
        som={ligado(prefs, "descanso_som")}
        vibracao={ligado(prefs, "descanso_vibra")}
        avancarSozinho={ligado(prefs, "avancar_sozinho")}
        aoSomar={(s) => guardar(somarSegundos(estado, s, Date.now()))}
        aoDefinir={(s) => guardar(definirDuracao(estado, s, Date.now()))}
        aoPular={() => ir(passo.indiceProximo)}
      />
    );
  }

  if (passo.tipo === "firme" && bloco) {
    return (
      <>
        <TelaFirme
          exercicioId={bloco.exercicioId}
          firme={bloco.ultimaFirme ?? firmePadrao(bloco)}
          nota={bloco.nota}
          aoResponder={(firme) => dados.mudarFirme(bloco.ordem, firme)}
          aoMudarNota={(nota) => dados.mudarNota(bloco.ordem, nota)}
          aoSeguir={() => ir(indice + 1)}
          aoVoltar={() => ir(passoAnterior(seq, indice))}
        />
        {folha}
      </>
    );
  }

  if (passo.tipo === "feedback") {
    return (
      <TelaFeedback
        sensacao={sessao.sensacao}
        aoEscolher={(valor) =>
          dados.mexer((atual) => ({ ...atual, sensacao: valor }))
        }
        aoSeguir={() => ir(indice + 1)}
        aoVoltar={() => ir(passoAnterior(seq, indice))}
      />
    );
  }

  const primeiro = sessao.blocos[0]?.exercicioId ?? null;
  const nomeDoTreino =
    dados.treino?.nome ??
    (dados.plano ? "Barra fixa" : (dados.tituloLivre ?? "Treino livre"));
  const semana = perfil ? semanaDaFase(sessao.data, perfil.fase_desde) : null;

  return (
    <TelaConclusao
      sessaoId={sessao.id}
      titulo={`${nomeDoTreino} concluído`}
      subtitulo={
        semana ? `${nomeDoTreino} · semana ${semana} da fase` : nomeDoTreino
      }
      primeiroExercicioId={primeiro}
      contadores={contadoresDaSessao(sessao)}
      duracaoS={dados.decorridoS}
      resultados={dados.previa("concluida")}
      hoje={hoje ?? sessao.data}
      dataDaSessao={sessao.data}
      pesoAtual={pesoQ.data?.[0]?.peso_kg ?? null}
      pesoDeHoje={
        pesoQ.data?.[0]?.data === (hoje ?? sessao.data)
          ? (pesoQ.data?.[0]?.peso_kg ?? null)
          : null
      }
      alturaCm={perfil?.altura_cm ?? null}
      peso={sessao.pesoCorporal}
      aoMudarPeso={(kg) => dados.mexer((atual) => ({ ...atual, pesoCorporal: kg }))}
      aoMudarAltura={perfil ? mudarAltura : undefined}
      salvando={dados.salvando}
      aoSeguir={() =>
        void dados.salvar("concluida", {
          sensacao: sessao.sensacao,
          peso: sessao.pesoCorporal,
        })
      }
      aoVoltar={() => ir(passoAnterior(seq, indice))}
    />
  );
}

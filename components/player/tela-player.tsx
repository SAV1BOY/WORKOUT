"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { FichaEmFolha, type ContextoDaFicha } from "@/components/exercicio/ficha-folha";
import { AjustesDoTreino } from "@/components/mais/ajustes-do-treino";
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
import { acharExercicio } from "@/lib/dados";
import { formatarDuracao, formatarKg, rotuloDaCarga } from "@/lib/formato";
import {
  anterior as passoAnterior,
  apos,
  definirDuracao,
  entradaDoPasso,
  indiceDaChave,
  indiceDeRetomada,
  irPara,
  posicaoNaSequencia,
  rotuloDoPasso,
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
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { registrarPeso } from "@/lib/queries/corpo";
import { salvarPerfil, salvarPrefs } from "@/lib/queries/mais";
import { useUltimoPeso } from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import {
  ajustarPrescricaoDaSessao,
  contadoresDaSessao,
  firmePadrao,
  type BlocoLocal,
  type SerieLocal,
  type SessaoLocal,
} from "@/lib/sessao";

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
  /** Muda ao fechar a Visão geral: o foco volta ao botão que a abriu (§22.5). */
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  /** O que o leitor de tela ouve depois de gravar uma série (§22.5 item 10). */
  const [aviso, setAviso] = useState("");
  /**
   * SPEC §22.5 item 2: a gravação acontece ao ENTRAR na conclusão. "pendente"
   * é o estado de quem ainda não chegou lá (ou está gravando agora).
   */
  const [gravacao, setGravacao] = useState<"pendente" | "feita" | "falhou">(
    "pendente",
  );
  /**
   * O peso do dia vive aqui depois da gravação: mexer na sessão gravada a
   * devolveria ao Dexie como "em andamento" — exatamente o defeito que o
   * item 2 conserta. Depois de gravada, o peso vai pelo caminho do Corpo
   * (`registrarPeso`, upsert por `user_id,data`).
   */
  const [pesoDigitado, setPesoDigitado] = useState<number | null>(null);

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

  /* estável de propósito: é dependência do efeito de história da Visão geral */
  const fecharVisaoGeral = useCallback(() => {
    setVisaoGeral(false);
    setPedidoDeFoco((n) => n + 1);
  }, []);

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

  /* ------------------------------------------- gravar ao chegar no fim */

  /*
   * SPEC §22.5 item 2: a sessão vai para o banco ao ENTRAR na conclusão.
   * `dados` nasce de novo a cada renderização, então ele entra por referência
   * — o efeito depende só do tipo do passo, e o `gravando` impede a segunda
   * chamada (StrictMode inclusive), que rodaria o motor duas vezes.
   */
  const referencia = useRef(dados);
  useEffect(() => {
    referencia.current = dados;
  });
  const gravando = useRef(false);

  const gravarAgora = useCallback(() => {
    if (gravando.current) return;
    gravando.current = true;
    const atual = referencia.current;
    const daSessao = atual.sessao;
    void atual
      .salvar(
        "concluida",
        {
          sensacao: daSessao?.sensacao ?? null,
          peso: daSessao?.pesoCorporal ?? null,
        },
        { navegar: false },
      )
      .then((certo) => {
        setGravacao(certo ? "feita" : "falhou");
        gravando.current = certo;
      });
  }, []);

  useEffect(() => {
    if (tipoDoPasso !== "conclusao") return;
    gravarAgora();
  }, [tipoDoPasso, gravarAgora]);

  /*
   * O peso do dia, depois da gravação, é uma escrita do Corpo — não da
   * sessão. Um `mexer` aqui gravaria a sessão de novo no aparelho, e a aba
   * Treino voltaria a mostrar "EM ANDAMENTO". A espera junta os toques do
   * stepper numa escrita só; sair da tela grava o que estiver pendente.
   */
  const relogioDoPeso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pesoPendente = useRef<number | null>(null);
  const dadosDoPeso = useRef({ perfil, hoje, cliente });
  useEffect(() => {
    dadosDoPeso.current = { perfil, hoje, cliente };
  });

  const escreverPeso = useCallback(() => {
    if (relogioDoPeso.current) {
      clearTimeout(relogioDoPeso.current);
      relogioDoPeso.current = null;
    }
    const kg = pesoPendente.current;
    pesoPendente.current = null;
    const { perfil: quem, hoje: dia, cliente: qc } = dadosDoPeso.current;
    if (kg === null || kg <= 0 || !quem || !dia) return;
    void registrarPeso({ userId: quem.user_id, data: dia, pesoKg: kg, cliente: qc });
    // a sessão já está gravada: a pesagem dela vai por uma atualização à parte
    void enfileirarEscrita("sessao", {
      tabela: "sessions",
      op: "update",
      filtro: { id: sessaoId },
      linha: { peso_corporal: kg },
    });
  }, [sessaoId]);

  useEffect(() => () => escreverPeso(), [escreverPeso]);

  const anotarPeso = useCallback(
    (kg: number | null) => {
      setPesoDigitado(kg);
      pesoPendente.current = kg;
      if (relogioDoPeso.current) clearTimeout(relogioDoPeso.current);
      relogioDoPeso.current = setTimeout(escreverPeso, 600);
    },
    [escreverPeso],
  );

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
            aoFechar={fecharVisaoGeral}
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
      <FichaEmFolha
        exercicioId={ficha}
        aberto={ficha !== null}
        aoMudarAberto={(v) => setFicha(v ? ficha : null)}
        temVideo={ficha !== null && videos.includes(ficha)}
        contexto={contextoDaFicha}
        prefs={prefs}
      />
      <Sheet open={ajustar} onOpenChange={setAjustar}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto pb-8">
          <SheetHeader className="pb-0">
            <SheetTitle>Ajustar</SheetTitle>
            <SheetDescription>
              Vale para todos os treinos. Fica em Mais → Preferências.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {perfil ? (
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
          nomeDoTreino={nomeDaSessao(dados)}
          aviso={aviso}
          pedidoDeFoco={pedidoDeFoco}
          aoMudar={(campos) => dados.mudarSerie(bloco.ordem, serie.id, campos)}
          aoConcluir={() => {
            if (!serie.concluida) dados.marcar(bloco.ordem, serie.id, true);
            const destino = apos(seq, indice);
            // SPEC §22.5 item 10: gravar a série deixa de ser silencioso
            setAviso(textoDaSerieGravada(passo, bloco, serie, seq[destino] ?? null));
            ir(destino);
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
        aviso={aviso}
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
  const nomeDoTreino = nomeDaSessao(dados);
  const semana = perfil ? semanaDaFase(sessao.data, perfil.fase_desde) : null;
  const pesoDaTela = pesoDigitado ?? sessao.pesoCorporal;

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
      peso={pesoDaTela}
      aoMudarPeso={anotarPeso}
      aoMudarAltura={perfil ? mudarAltura : undefined}
      salvando={dados.salvando}
      gravada={gravacao === "feita"}
      falhou={gravacao === "falhou"}
      aoSeguir={() => {
        if (gravacao === "falhou") {
          gravarAgora();
          return;
        }
        escreverPeso();
        router.push("/");
      }}
      /*
        SPEC §22.5 item 2: com a sessão já gravada não há para onde voltar —
        reentrar na conclusão rodaria o motor de novo. O "Voltar ao treino" só
        existe enquanto a gravação não terminou.
      */
      aoVoltar={
        gravacao === "feita" ? undefined : () => ir(passoAnterior(seq, indice))
      }
    />
  );
}

/** "Treino B" · "Barra fixa" · "Core no tatame" — o nome desta sessão. */
function nomeDaSessao(dados: {
  treino: { nome: string } | null;
  plano: unknown;
  tituloLivre: string | null;
}): string {
  return (
    dados.treino?.nome ??
    (dados.plano ? "Barra fixa" : (dados.tituloLivre ?? "Treino livre"))
  );
}

/**
 * "Série 2 de 3 registrada: 5 repetições com 7,5 kg na barra. Descanso de
 * 2 min 30." — SPEC §22.5 item 10.
 *
 * O `role="status"` da tela de exercício lê este texto; sem ele, gravar uma
 * série era completamente silencioso para quem usa leitor de tela.
 */
function textoDaSerieGravada(
  passo: PassoSerie,
  bloco: BlocoLocal,
  serie: SerieLocal,
  proximo: { tipo: string; segundos?: number } | null,
): string {
  const exercicio = acharExercicio(bloco.exercicioId);
  const partes: string[] = [];
  if (serie.reps !== null) partes.push(`${serie.reps} repetições`);
  else if (serie.tempoS !== null) partes.push(`${serie.tempoS} segundos`);
  else if (serie.passos !== null) partes.push(`${serie.passos} passos`);
  if (serie.cargaKg !== null && serie.cargaKg > 0) {
    partes.push(
      `com ${formatarKg(serie.cargaKg)} ${rotuloDaCarga(exercicio.implemento)}`,
    );
  }
  const feito = partes.length > 0 ? `: ${partes.join(" ")}` : "";
  const descanso =
    proximo && proximo.tipo === "descanso" && proximo.segundos
      ? ` Descanso de ${formatarDuracao(proximo.segundos)}.`
      : "";
  return `${rotuloDoPasso(passo)} registrada${feito}.${descanso}`;
}

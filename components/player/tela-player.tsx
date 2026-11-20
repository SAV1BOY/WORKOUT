"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { EquipamentoDeHoje } from "@/components/exercicio/equipamento-de-hoje";
import { FichaEmFolha } from "@/components/exercicio/ficha-sob-demanda";
import type { ContextoDaFicha } from "@/components/exercicio/ficha-folha";
import { SeletorAlternativa } from "@/components/exercicio/seletor-alternativa";
import { TelaDescanso } from "@/components/player/descanso";
import { TelaExercicio } from "@/components/player/exercicio";
import { TelaPreparacao } from "@/components/player/preparacao";
import { Button } from "@/components/ui/button";
import { useSessaoDeTreino, type SessaoDeTreino } from "@/components/treinar/usar-sessao";
import { VisaoGeralDaSessao } from "@/components/treinar/visao-geral";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apitar, vibrar } from "@/lib/apito";
import { AVISO_CATALOGO_DA_SESSAO } from "@/lib/compatibilidade-da-sessao";
import { semanaDaFase } from "@/lib/calendario";
import { acharExercicio } from "@/lib/dados";
import { formatarDuracao, formatarKg, rotuloDaCarga } from "@/lib/formato";
import {
  anterior as passoAnterior,
  apos,
  contextoDoProximoExercicio,
  definirDuracao,
  entradaDoPasso,
  estadoDoPasso,
  exercicioDoDescansoEntreSeries,
  indiceDeRetomada,
  indiceDoEstado,
  irPara,
  progressoDoPlayer,
  restanteS,
  prefsDoVoto,
  rotuloDoPasso,
  seguinte,
  sequenciaDoPlayer,
  serieAntesDoDescanso,
  serieDoPasso,
  somarSegundos,
  indiceDaChave,
  zerou,
  type EstadoPlayer,
  type PassoSerie,
} from "@/lib/player";
import {
  ligado,
  opcoesDoPlayer,
  votoDoExercicio,
  type VotoDoExercicio,
} from "@/lib/preferencias";
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { registrarPeso } from "@/lib/queries/corpo";
import { descarregarSessao, mesmoRelogio } from "@/lib/queries/sessao";
import { salvarPerfil, salvarPrefsOuDesfazer } from "@/lib/queries/mais";
import { chaves, useUltimoPeso } from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import {
  ajustarPrescricaoDaSessao,
  avisoDaTroca,
  bloquearDesfazerSeIniciado,
  blocosNaOrdemDeExecucao,
  contadoresDaSessao,
  descansoPersonalizadoDaSessao,
  firmePadrao,
  type BlocoLocal,
  type SerieLocal,
  type SessaoLocal,
} from "@/lib/sessao";
import type { LinhaPerfil } from "@/lib/types";

const AjustesDoTreino = dynamic(() => import("@/components/mais/ajustes-do-treino").then((m) => m.AjustesDoTreino));
const TelaConclusao = dynamic(() => import("@/components/player/conclusao").then((m) => m.TelaConclusao));
const TelaFeedback = dynamic(() => import("@/components/player/feedback").then((m) => m.TelaFeedback));
const TelaFirme = dynamic(() => import("@/components/player/firme").then((m) => m.TelaFirme));

/**
 * O player (SPEC §14.1): preparação → exercício → descanso → "firme?" →
 * feedback → conclusão, para qualquer sessão de força.
 *
 * O estado do passo vive dentro da sessão, no Dexie (`sessao.player`): fechar
 * o app no meio de um descanso e abrir de novo volta ao mesmo passo, com o
 * relógio ancorado em `Date.now()` — nunca numa soma de ticks.
 */
export function TelaPlayer({
  userId,
  sessaoId,
  videos = [],
}: {
  userId: string;
  sessaoId: string;
  /** Ids com `public/videos/<id>.mp4` (SPEC §13.1). */
  videos?: string[];
}) {
  const router = useRouter();
  const dados = useSessaoDeTreino(sessaoId, userId);
  const focarAviso = useCallback((titulo: HTMLHeadingElement | null) => titulo?.focus(), []);
  /* -------------------------------------------------- renderizar */

  /*
   * SPEC §22.11: "não achei" é uma afirmação, e só sai quando as duas buscas
   * — o aparelho e o servidor — terminaram sem sessão. Enquanto qualquer uma
   * corre, esqueleto; erro de rede é "tentar de novo", que agora refaz as
   * consultas em vez de mandar o usuário para outra tela.
   */
  if (dados.tela === "erro" || dados.tela === "erro-aparelho") {
    return (
      <Erro
        mensagem={dados.tela === "erro-aparelho" ? "Não consegui ler os dados deste treino no aparelho." : "Não consegui carregar este treino agora. Confira a conexão."}
        aoTentarDeNovo={dados.recarregar}
      />
    );
  }

  if (dados.tela === "carregando") return <EsqueletoCard linhas={6} />;

  if (dados.tela === "atualizar") {
    return (
      <section aria-labelledby="atualizar-treino" className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4">
        <h1 id="atualizar-treino" ref={focarAviso} tabIndex={-1} className="text-lg font-semibold">{AVISO_CATALOGO_DA_SESSAO}</h1>
        <p className="text-muted-foreground text-sm">Este treino tem um exercício que precisa de uma versão mais recente do app.</p>
        <Button asChild variant="outline"><Link href="/relatorio#historico">Ver histórico</Link></Button>
      </section>
    );
  }

  if (!dados.sessao) {
    return (
      <Erro
        mensagem="Não achei este treino. Ele pode ter sido registrado em outro aparelho."
        aoTentarDeNovo={() => router.push("/treinar")}
      />
    );
  }

  return <PlayerDaSessao dados={dados} sessao={dados.sessao} videos={videos} />;
}

function PlayerDaSessao({ dados, sessao, videos }: {
  dados: SessaoDeTreino; sessao: SessaoLocal; videos: string[];
}) {
  const router = useRouter();
  const cliente = useQueryClient();
  const hoje = useHoje();
  const { prefs, perfil } = dados;
  const { id: sessaoId, userId } = sessao;
  const pesoQ = useUltimoPeso();

  const [estado, setEstado] = useState<EstadoPlayer | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [visaoGeral, setVisaoGeral] = useState(false);
  const [ordemDaFicha, setFicha] = useState<number | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [ajustar, setAjustar] = useState(false);
  /** Muda ao fechar a Visão geral: o foco volta ao botão que a abriu (§22.5). */
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const listaAbertaNoDescanso = useRef(false);
  const focarListaDoDescanso = useCallback((botao: HTMLButtonElement | null) => {
    if (botao && listaAbertaNoDescanso.current) {
      listaAbertaNoDescanso.current = false;
      botao.focus();
    }
  }, []);
  /** O que o leitor de tela ouve depois de gravar uma série (§22.5 item 10). */
  const [aviso, setAviso] = useState("");
  const marcacaoEmCurso = useRef<symbol | null>(null);
  const [gravandoSerie, setGravandoSerie] = useState(false);
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

  const descansoNoAparelho = sessao?.descansoPadraoConhecidoS;
  const opcoes = useMemo(() => {
    const atuais = opcoesDoPlayer(prefs);
    if (!perfil && descansoNoAparelho !== undefined) atuais.descansoPadraoS = descansoNoAparelho;
    return atuais;
  }, [perfil, prefs, descansoNoAparelho]);
  const seq = useMemo(
    () => (sessao ? sequenciaDoPlayer(sessao, opcoes) : []),
    [sessao, opcoes],
  );

  /* ------------------------------------------------- onde estamos */

  /** Anota o passo na sessão (Dexie) antes de qualquer animação (§8). */
  const guardar = useCallback(
    (novo: EstadoPlayer) => {
      setEstado(novo);
      dados.mexer((atual: SessaoLocal) => bloquearDesfazerSeIniciado({ ...atual, player: novo }));
      // Recarregar logo após pular o descanso precisa retomar a série já aberta.
      void descarregarSessao();
    },
    [dados],
  );

  // primeira carga: o passo salvo no aparelho, ou o que a sessão deixa retomar
  useEffect(() => {
    if (!sessao || estado !== null || seq.length === 0) return;
    // a chave salva pode ter sumido (troca de exercício): `indiceDoEstado`
    // acha o passo no mesmo exercício, e o efeito abaixo o anota (§22.16)
    const passoInicial = sessao.player ?? irPara(seq, indiceDeRetomada(seq, sessao), Date.now());
    const comPasso = { ...sessao, player: passoInicial };
    if (bloquearDesfazerSeIniciado(comPasso) !== comPasso) guardar(passoInicial);
    else setEstado(passoInicial);
  }, [sessao, seq, estado, guardar]);

  const indice = estado && sessao ? indiceDoEstado(seq, sessao, estado) : -1;
  const passo = indice >= 0 ? seq[indice] : null;

  useEffect(() => () => {
    marcacaoEmCurso.current = null;
    setGravandoSerie(false);
  }, [sessao?.id, estado?.chave, visaoGeral]);

  const ir = useCallback(
    (destino: number) => guardar(irPara(seq, destino, Date.now())),
    [guardar, seq],
  );

  /*
   * SPEC §22.16 item 1: "Substituir" no exercício do passo atual recria as
   * séries com ids novos e a chave salva some. `indiceDoEstado` já achou o
   * passo no mesmo exercício; aqui ele é anotado no aparelho (Dexie), com o
   * relógio dele — antes, a tela ficava no esqueleto até recarregar.
   */
  useEffect(() => {
    if (!estado || !passo || passo.chave === estado.chave) return;
    guardar(estadoDoPasso(passo, Date.now()));
  }, [estado, passo, guardar]);

  /* estável de propósito: é dependência do efeito de história da Visão geral */
  const fecharVisaoGeral = useCallback(() => {
    setVisaoGeral(false);
    setPedidoDeFoco((n) => n + 1);
  }, []);

  /* ------------------------------------------------------ relógio */

  const fimEm = estado?.fimEm ?? null;
  const chaveDoDescanso = passo?.tipo === "descanso" && passo.chave === estado?.chave ? passo.chave : null;
  const ultimoDescansoAvisado = useRef<{ chave: string; fimEm: number } | null>(null);
  const som = ligado(prefs, "descanso_som");
  const vibracao = ligado(prefs, "descanso_vibra");
  /*
   * Com a Visão geral aberta, a preparação espera (§22.16 item 2). O descanso
   * ainda avisa no prazo sem redesenhar a lista ou interromper a escolha.
   */
  useEffect(() => {
    if (fimEm === null || (visaoGeral && !chaveDoDescanso)) return;
    const tique = () => {
      const agora = Date.now();
      if (!visaoGeral) setAgora(agora);
      if (!chaveDoDescanso || agora < fimEm) return;
      const anterior = ultimoDescansoAvisado.current;
      if (anterior?.chave === chaveDoDescanso && anterior.fimEm === fimEm) return;
      ultimoDescansoAvisado.current = { chave: chaveDoDescanso, fimEm };
      if (vibracao) vibrar();
      if (som) apitar();
    };
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
  }, [fimEm, visaoGeral, chaveDoDescanso, som, vibracao]);

  /*
   * A preparação é uma contagem: ao zerar, o treino começa sozinho (§14.1.1).
   * SPEC §22.16 item 2 (correção da auditoria 1): com a Visão geral aberta a
   * partir da preparação a contagem não vale — quem abriu a lista para
   * conferir o treino não pode voltar direto na série 1 — e, ao "Fechar",
   * ela recomeça do início. Num efeito só: dois efeitos leriam o mesmo
   * estado velho (já zerado) no mesmo ciclo, e o segundo desfaria o primeiro.
   */
  const tipoDoPasso = passo?.tipo;
  const recontar = useRef(false);
  useEffect(() => {
    if (visaoGeral) return;
    if (recontar.current) {
      recontar.current = false;
      if (passo?.tipo === "preparacao") {
        guardar(estadoDoPasso(passo, Date.now()));
        return;
      }
    }
    if (tipoDoPasso !== "preparacao" || !estado || !zerou(estado, agora)) return;
    ir(indice + 1);
  }, [visaoGeral, passo, tipoDoPasso, estado, agora, indice, ir, guardar]);

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

  /**
   * O voto dos polegares (SPEC §22.16 item 6 e §22.18 itens 8 e 9). Devolve
   * o voto que havia antes do toque, ou `null` quando não gravou: sem perfil
   * (o player abre só com a sessão do aparelho) não há onde gravar, e a tela
   * não pode confirmar o voto. As preferências — e o voto de antes — são as
   * de AGORA, lidas do cache na hora (`prefsDoVoto`, pura).
   */
  const avaliarExercicio = useCallback(
    async (exercicioId: string, voto: VotoDoExercicio): Promise<VotoDoExercicio | undefined> => {
      const gravacao = prefsDoVoto(
        cliente.getQueryData<LinhaPerfil | null>(chaves.perfil()),
        perfil,
        exercicioId,
        voto,
      );
      if (!gravacao) return undefined;
      await salvarPrefsOuDesfazer({ userId: gravacao.userId, prefs: gravacao.prefs, cliente });
      return gravacao.antes;
    },
    [perfil, cliente],
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

  const nomeDoTreino = nomeDaSessao(dados);
  if (visaoGeral) {
    const contexto = sessao.id === sessaoId && sessao.userId === userId && mesmoRelogio(estado, sessao.player)
      ? contextoDoProximoExercicio(sessao, estado, seq) : null;
    const contextoProximo = contexto ? {
      ...contexto,
      escolher: async (ordem: number) => {
        const resultado = await dados.escolherProximo(sessao, contexto.origem, ordem, ligado(prefs, "avancar_sozinho"));
        const passoConfirmado = resultado.sessao?.player;
        if (!resultado.aplicada && passoConfirmado && resultado.sessao?.id === sessaoId && resultado.sessao.userId === userId) {
          setEstado(atual => mesmoRelogio(atual, sessao.player) ? passoConfirmado : atual);
        }
        return resultado.aplicada;
      },
    } : undefined;
    return (
      /* tela cheia: no player a barra de abas devolve `null` (§14.1), então
         parar 56 px antes do fim só deixava uma faixa morta (§22.1) */
      <div className="bg-background fixed inset-0 z-50 overflow-y-auto">
        <div className="pb-segura mx-auto w-full max-w-lg px-4 pt-4">
          <VisaoGeralDaSessao
            sessao={sessao}
            nomeDoTreino={nomeDoTreino}
            dados={dados}
            opcoesDoPlayer={opcoes}
            contextoProximo={contextoProximo}
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

  const abrirVisaoGeral = () => {
    // Na primeira série o estado da tela ainda pode não ter sido salvo neste aparelho.
    if (!sessao.player && sessao.workoutId === "livre" && sessao.id === sessaoId && sessao.userId === userId) guardar(estado);
    setVisaoGeral(true);
  };
  const blocoDaFicha = sessao.blocos.find((b) => b.ordem === ordemDaFicha);
  const ficha = blocoDaFicha?.exercicioId ?? null;
  /** A ficha aberta de dentro da sessão mexe na prescrição de hoje (§14.2). */
  const contextoDaFicha = ((): ContextoDaFicha | undefined => {
    const alvoBloco = blocoDaFicha;
    if (!ficha || !alvoBloco) return undefined;
    const blocos = blocosNaOrdemDeExecucao(sessao);
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
      aoSubstituir: alvoBloco.series.some((s) => s.tipo === "trabalho" && !s.concluida)
        ? (novo) => dados.substituir(alvoBloco, novo)
        : undefined,
      originalId: alvoBloco.originalId,
      recorrencia: dados.recorrencia,
      material: dados.material,
      ocupados: sessao.blocos.filter((outro) => outro.ordem !== alvoBloco.ordem).map((outro) => outro.exercicioId),
      avisoDaTroca: avisoDaTroca(alvoBloco),
      indice: blocos.indexOf(alvoBloco),
      total: blocos.length,
      aoIr: (i) => setFicha(blocos[i]?.ordem ?? null),
    };
  })();

  const folha = (
    <>
      {ficha !== null && (
        <FichaEmFolha
          exercicioId={ficha}
          aberto
          aoMudarAberto={(aberto) => { if (!aberto) setFicha(null); }}
          temVideo={videos.includes(ficha)}
          contexto={contextoDaFicha}
          prefs={prefs}
        />
      )}
      {passo.tipo === "serie" && bloco && (
        <SeletorAlternativa
          originalId={bloco.originalId}
          recorrencia={dados.recorrencia}
          material={dados.material}
          ocupados={sessao.blocos.filter((outro) => outro.ordem !== bloco.ordem).map((outro) => outro.exercicioId)}
          exercicioId={bloco.exercicioId}
          prefs={prefs}
          aberto={trocando}
          aoMudarAberto={setTrocando}
          avisoDaTroca={avisoDaTroca(bloco)}
          voltarAoOriginal={bloco.substituido ? {
            nome: acharExercicio(bloco.originalId).nome,
            escolher: () => dados.substituir(bloco, bloco.originalId),
          } : undefined}
          aoSubstituir={async (novo) => {
            if (await dados.substituir(bloco, novo)) setAviso(`Exercício escolhido: ${acharExercicio(novo).nome}.`);
          }}
        />
      )}
      <Sheet open={ajustar} onOpenChange={setAjustar}>
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] overflow-y-auto pb-8"
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            (evento.currentTarget as HTMLElement)
              .querySelector<HTMLElement>("[data-titulo-da-folha]")?.focus();
          }}
        >
          <SheetHeader className="pb-0">
            <SheetTitle data-titulo-da-folha tabIndex={-1}>Ajustar</SheetTitle>
            <SheetDescription>
              O equipamento vale para esta sessão. Os outros ajustes ficam em Mais → Preferências.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            {dados.material && <EquipamentoDeHoje material={dados.material} />}
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
          nomeDoTreino={nomeDoTreino}
          pedidoDeFoco={pedidoDeFoco}
          aoAbrirFicha={() => setFicha(passo.ordem)}
          aoAbrirLista={() => {
            recontar.current = true;
            abrirVisaoGeral();
          }}
          aoPular={() => ir(indice + 1)}
        />
        {folha}
      </>
    );
  }

  if (passo.tipo === "serie" && bloco) {
    const serie = serieDoPasso(sessao, passo);
    if (!serie) return <EsqueletoCard linhas={6} />;
    const progresso = progressoDoPlayer(sessao);
    return (
      <>
        <TelaExercicio
          conta={sessao.userId}
          passo={passo}
          bloco={bloco}
          serie={serie}
          gravando={gravandoSerie}
          entrada={entradaDoPasso(bloco, serie)}
          opcoes={sessao.opcoesMontagem}
          temVideo={videos.includes(bloco.exercicioId)}
          anteriores={dados.anteriores[bloco.exercicioId]}
          voto={votoDoExercicio(prefs, bloco.exercicioId)}
          feitas={progresso.feitas}
          total={progresso.total}
          nomeDoTreino={nomeDoTreino}
          aviso={aviso}
          pedidoDeFoco={pedidoDeFoco}
          aoMudar={(campos) => dados.mudarSerie(bloco.ordem, serie.id, campos)}
          aoConcluir={async () => {
            if (marcacaoEmCurso.current) return;
            const descanso = estado.descansoAoCorrigir;
            let registrada = serie;
            if (!serie.concluida || descanso) {
              const pedido = Symbol();
              marcacaoEmCurso.current = pedido;
              setGravandoSerie(true);
              try {
                const salvo = await dados.marcar(bloco.ordem, serie.id, true);
                if (marcacaoEmCurso.current !== pedido || !salvo) return;
                registrada = salvo.serie;
                if (!salvo.aplicada) {
                  const passos = sequenciaDoPlayer(salvo.sessao, opcoes);
                  const feita = indiceDaChave(passos, passo.chave);
                  const player = salvo.sessao.player;
                  if (player && (player.descansoAoCorrigir || indiceDaChave(passos, player.chave) > feita)) {
                    setEstado(player);
                  } else if (feita >= 0) {
                    // A Visão geral registra a série sem avançar o player. O intervalo já está correndo.
                    const desde = Date.parse(registrada.registradaEm ?? "");
                    const temHorario = Number.isFinite(desde);
                    const destino = temHorario ? apos(passos, feita) : seguinte(passos, feita);
                    guardar(irPara(passos, destino, temHorario ? Math.min(desde, Date.now()) : Date.now()));
                  }
                  return;
                }
              } finally {
                if (marcacaoEmCurso.current === pedido) {
                  marcacaoEmCurso.current = null;
                  setGravandoSerie(false);
                }
              }
            }
            if (descanso && indiceDaChave(seq, descanso.chave) >= 0) {
              setAviso(textoDaSerieGravada(passo, bloco, registrada, null));
              guardar(descanso);
              return;
            }
            const destino = apos(seq, indice);
            // SPEC §22.5 item 10: gravar a série deixa de ser silencioso
            setAviso(textoDaSerieGravada(passo, bloco, registrada, seq[destino] ?? null));
            ir(destino);
          }}
          aoAnterior={() => ir(passoAnterior(seq, indice))}
          aoProximo={() => ir(seguinte(seq, indice))}
          aoAbrirFicha={() => setFicha(bloco.ordem)}
          aoTrocar={bloco.series.some((s) => s.tipo === "trabalho" && !s.concluida)
            ? () => setTrocando(true)
            : undefined}
          aoAbrirLista={abrirVisaoGeral}
          aoAjustar={() => setAjustar(true)}
          aoAvaliar={(voto) => avaliarExercicio(bloco.exercicioId, voto)}
        />
        {folha}
      </>
    );
  }

  if (passo.tipo === "descanso") {
    const trabalho = exercicioDoDescansoEntreSeries(seq, indice);
    const alvo = seq[passo.indiceProximo];
    const proximo = alvo && alvo.tipo === "serie" ? (alvo as PassoSerie) : null;
    const blocoDoProximo = proximo
      ? (sessao.blocos.find((b) => b.ordem === proximo.ordem) ?? null)
      : null;
    const anterior = serieAntesDoDescanso(seq, indice, sessao);
    const serieFeita = anterior ? serieDoPasso(sessao, anterior) : null;
    const blocoFeito = anterior
      ? sessao.blocos.find((b) => b.ordem === anterior.ordem)
      : null;
    const registrado = anterior && blocoFeito && serieFeita
      ? textoDaSerieGravada(anterior, blocoFeito, serieFeita, null)
      : null;
    const mostrarConfirmado = (gravado: { base: EstadoPlayer; novo: EstadoPlayer } | null) => {
      if (gravado) setEstado(atual => mesmoRelogio(atual, gravado.base) ? gravado.novo : atual);
    };
    return (
      <>
        <h1 className="sr-only">{nomeDoTreino} — descanso{proximo ? ` antes do exercício ${proximo.posicao} de ${proximo.totalExercicios}` : ""}</h1>
        <TelaDescanso
          key={passo.chave}
          estado={estado}
          agora={agora}
          proximo={proximo}
          antesDoFeedback={alvo?.tipo === "feedback"}
          blocoDoProximo={blocoDoProximo}
          serieDoProximo={proximo ? serieDoPasso(sessao, proximo) : null}
          avancarSozinho={ligado(prefs, "avancar_sozinho") && ficha === null && !dados.ajustandoCronometro}
          ajustando={dados.ajustandoCronometro}
          registrado={registrado}
          aoAbrirFicha={() => proximo && setFicha(proximo.ordem)}
          aoCorrigir={() => dados.aposAjustarCronometro(passo.chave, confirmado => {
            if (anterior) {
              guardar({ ...estadoDoPasso(anterior, Date.now()), descansoAoCorrigir: confirmado });
            }
          })}
          aviso={aviso}
          botaoDaLista={focarListaDoDescanso}
          aoAbrirLista={dados.adicionarExercicio ? () => {
            listaAbertaNoDescanso.current = true;
            abrirVisaoGeral();
          } : undefined}
          aoSomar={(s) => {
            const instante = Date.now();
            return dados.ajustarCronometro(passo.chave, base => {
              const delta = Math.max(s, -restanteS(base, instante));
              return delta === 0 ? base : somarSegundos(base, delta, instante);
            }).then(mostrarConfirmado);
          }}
          aoDefinir={(s) => {
            const instante = Date.now();
            return dados.ajustarCronometro(passo.chave, base => definirDuracao(base, s, instante)).then(mostrarConfirmado);
          }}
          proximasSeries={trabalho ? {
            exercicio: acharExercicio(trabalho.exercicioId).nome,
            segundos: descansoPersonalizadoDaSessao(sessao, trabalho.exercicioId),
            aoGuardar: async (segundos) => {
              const novo = segundos === null ? undefined : definirDuracao(estado, segundos, Date.now());
              mostrarConfirmado(await dados.mudarDescanso(trabalho.exercicioId, segundos, novo));
            },
          } : undefined}
          aoPular={() => dados.aposAjustarCronometro(passo.chave, () => ir(passo.indiceProximo))}
        />
        {folha}
      </>
    );
  }

  if (passo.tipo === "firme" && bloco) {
    return (
      <>
        <h1 className="sr-only">{nomeDoTreino} — esforço em {acharExercicio(bloco.exercicioId).nome}</h1>
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
      <>
        <h1 className="sr-only">{nomeDoTreino} — avaliação do treino</h1>
        <TelaFeedback
          key={`${sessao.userId}:${sessao.id}`}
          notaGeral={sessao.notaGeral}
          aoGuardarNota={dados.guardarNotaGeral}
          sensacao={sessao.sensacao}
          aoEscolher={(valor) =>
            dados.mexer((atual) => ({ ...atual, sensacao: valor }))
          }
          aoSeguir={() => ir(indice + 1)}
          aoVoltar={() => ir(passoAnterior(seq, indice))}
        />
      </>
    );
  }

  const primeiro = sessao.blocos[0]?.exercicioId ?? null;
  const semana = perfil ? semanaDaFase(sessao.data, perfil.fase_desde) : null;
  const pesoDaTela = pesoDigitado ?? sessao.pesoCorporal;

  return (
    <>
      <h1 className="sr-only">{nomeDoTreino} — conclusão</h1>
      <TelaConclusao
        conta={userId}
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
    </>
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

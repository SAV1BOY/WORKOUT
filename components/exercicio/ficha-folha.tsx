"use client";

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
} from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { FazerAgora } from "@/components/exercicio/acoes-da-ficha";
import { FotosAmpliaveis } from "@/components/exercicios/fotos-ampliaveis";
import { HistoricoExercicio } from "@/components/exercicios/historico-exercicio";
import { MediaGrande } from "@/components/exercicio/media-grande";
import { FotosExercicio } from "@/components/exercicio/midia";
import { TutorialDoExercicio } from "@/components/exercicio/tutorial";
import { MapaAnatomico } from "@/components/mapa-anatomico";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { treinosDoExercicio } from "@/lib/catalogo";
import { acharExercicio, tutorialPorExercicio } from "@/lib/dados";
import {
  ROTULO_DA_ABA,
  abasDaFicha,
  linhaDaCargaInicial,
  linksDosTreinos,
  nivelDosTitulos,
  notaDaCargaInicial,
  tagsDoEquipamento,
  type NivelDeTitulo,
} from "@/lib/ficha";
import { formatarDescanso } from "@/lib/formato";
import type { PrescricaoTipo } from "@/lib/schemas";
import { opcoesDeMidia, type TipoDeMidia } from "@/lib/midia";
import { substitutosPara } from "@/lib/sessao";
import type { Prefs } from "@/lib/types";
import { evitado, evitadosPorUltimo } from "@/lib/preferencias";
import { cn } from "@/lib/utils";

/** O que a ficha ganha quando é aberta de dentro de uma sessão (SPEC §14.2). */
export interface ContextoDaFicha {
  /** Séries desta sessão (o stepper mexe só nelas). */
  series: number;
  /** Repetições, segundos ou passos de hoje — conforme `tipo`. */
  alvo: number | null;
  tipo: PrescricaoTipo;
  aoMudarSeries: (n: number) => void;
  aoMudarAlvo: (v: number) => void;
  aoSubstituir?: (novoExercicioId: string) => void;
  /** Posição no treino, para o "anterior/próximo (n/N)". */
  indice: number;
  total: number;
  aoIr?: (indice: number) => void;
}

const MIN_SERIES = 1;
const MAX_SERIES = 10;

/**
 * SPEC §22.14 item 3(e): o nível dos títulos das seções vem do contexto — H2
 * na página (o nome do exercício é o H1), H3 na folha (o título da folha é o
 * H2). Um contexto em vez de um parâmetro por componente: as seções, o "Erro
 * comum", o "Seu histórico" e o "Só nesta sessão" leem daqui.
 */
const NivelDaFicha = createContext<NivelDeTitulo>(3);

function Titulo({
  children,
  className = "text-sm font-semibold",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const nivel = useContext(NivelDaFicha);
  const Tag = nivel === 2 ? "h2" : "h3";
  return <Tag className={className}>{children}</Tag>;
}

/**
 * A ficha do exercício (SPEC §14.2): título, Substituir, as abas
 * **Vídeo · Músculos · Tutorial**, o stepper da prescrição de hoje,
 * instruções, erro comum, área de foco, histórico e recorde.
 *
 * O mesmo componente serve a folha (bottom sheet, por cima de qualquer tela) e
 * a página `/exercicios/[id]` — não há duas fichas.
 */
export function ConteudoDaFicha({
  exercicioId,
  temVideo = false,
  contexto,
  prefs,
  comoPagina = false,
  aoFechar,
}: {
  exercicioId: string;
  temVideo?: boolean;
  contexto?: ContextoDaFicha;
  prefs?: Prefs;
  /** Página inteira (`/exercicios/[id]`): sem o "Fechar" e com tudo aberto. */
  comoPagina?: boolean;
  aoFechar?: () => void;
}) {
  const exercicio = acharExercicio(exercicioId);
  const treinos = linksDosTreinos(treinosDoExercicio(exercicio.id));
  const p = exercicio.prescricao_padrao;
  const notaDaCarga = notaDaCargaInicial(exercicio.carga_inicial);

  return (
    <NivelDaFicha.Provider value={nivelDosTitulos(comoPagina)}>
    <div className="flex flex-col gap-4">
      {contexto?.aoSubstituir ? (
        <Substituir
          exercicioId={exercicioId}
          prefs={prefs}
          aoEscolher={contexto.aoSubstituir}
        />
      ) : null}

      <AbasDaMidia
        exercicioId={exercicioId}
        temVideo={temVideo}
        comoPagina={comoPagina}
      />

      {contexto ? <StepperDaSessao contexto={contexto} /> : null}

      {comoPagina ? (
        <>
          {/*
            SPEC §22.14 item 3(d): os treinos em que o exercício aparece vêm
            depois de "Aparece em:" e cada um abre a coleção do treino no
            Explorar. O alvo de 44 px é a linha inteira do link.
          */}
          {treinos.length > 0 ? (
            <div data-aparece-em className="flex flex-wrap items-center gap-x-1">
              <span className="text-muted-foreground text-sm">Aparece em:</span>
              <ul className="flex flex-wrap items-center gap-x-1">
                {treinos.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={t.href}
                      className="alvo inline-flex items-center rounded-md"
                    >
                      <Badge
                        variant="secondary"
                        className="text-micro underline-offset-2 hover:underline"
                      >
                        {t.nome}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <FotosAmpliaveis exercicio={exercicio} />
        </>
      ) : null}

      <Secao titulo="Instruções">
        <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
          {exercicio.passos.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      </Secao>

      <section className="border-destructive/40 bg-destructive/5 flex flex-col gap-1 rounded-lg border p-3">
        <Titulo>Erro comum</Titulo>
        <p className="text-sm text-balance">{exercicio.erro_comum}</p>
      </section>

      {/*
        SPEC §22.14 item 3(b): na página os músculos ficam só na aba Músculos
        (a página não repete o que a aba diz); na folha, consultada no meio da
        série sem trocar de aba, a "Área de foco" continua (§14.2).
      */}
      {comoPagina ? null : <AreaDeFoco exercicioId={exercicioId} />}

      <Secao titulo="Montagem">
        <p className="text-muted-foreground text-sm text-balance">{exercicio.montagem}</p>
      </Secao>

      {comoPagina ? (
        <>
          {/*
            SPEC §22.14 item 3(c): o `equipamento_texto` já é o subtítulo do
            cabeçalho; aqui ficam as tags, e cada uma com coleção no Explorar
            leva ao aparelho. Anilhas, halteres e barra W não têm coleção.
          */}
          <Secao titulo="Equipamento">
            <ul data-tags-equipamento className="flex flex-wrap gap-x-1">
              {tagsDoEquipamento(exercicio.equipamento).map((t) => (
                <li key={t.tag}>
                  {/*
                    SPEC §22.15 item 10: a tag que abre a coleção parece link
                    sem hover — pílula com contorno, sublinhada sempre e com a
                    seta no fim —, e a sem coleção é texto simples, sem
                    pílula: antes as duas tinham o mesmo visual.
                  */}
                  {t.href ? (
                    <Link
                      href={t.href}
                      className="alvo inline-flex items-center rounded-md"
                    >
                      <Badge
                        variant="outline"
                        data-tag-equipamento="link"
                        className="text-micro underline underline-offset-2"
                      >
                        {t.rotulo}
                        <ChevronRight aria-hidden="true" data-icon="inline-end" />
                      </Badge>
                    </Link>
                  ) : (
                    <span
                      data-tag-equipamento="texto"
                      className="text-muted-foreground inline-flex min-h-11 items-center px-1 text-micro"
                    >
                      {t.rotulo}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Secao>

          <Secao titulo="Prescrição padrão">
            <p className="numero text-lg">{p.texto}</p>
            <p className="text-muted-foreground text-sm">
              Descanso de {formatarDescanso(p.descanso_s)}
              {p.unilateral ? " · um lado de cada vez" : ""}
            </p>
          </Secao>

          {/*
            SPEC §22.14 item 3 (correção da auditoria): com carga 0 a nota não
            repete "peso corporal" embaixo de "peso do corpo".
          */}
          <Secao titulo="Carga inicial">
            <p className="numero text-lg">{linhaDaCargaInicial(exercicio)}</p>
            {notaDaCarga ? (
              <p className="text-muted-foreground text-sm text-balance">{notaDaCarga}</p>
            ) : null}
          </Secao>
        </>
      ) : null}

      <Secao titulo="Como progredir">
        <p className="text-muted-foreground text-sm text-balance">
          {exercicio.progressao.regra}
        </p>
      </Secao>

      <Titulo className={comoPagina ? "pt-2 text-lg font-semibold" : "text-sm font-semibold"}>
        Seu histórico
      </Titulo>
      <HistoricoExercicio exercicioId={exercicioId} comoPagina={comoPagina} />

      {contexto && contexto.total > 1 ? (
        <Navegacao contexto={contexto} />
      ) : null}

      {/* SPEC §22.14 item 1: da página dá para treinar o exercício agora */}
      {comoPagina ? <FazerAgora exercicioId={exercicioId} /> : null}

      {!comoPagina && aoFechar ? (
        <Button variant="outline" className="alvo h-12" onClick={aoFechar}>
          Fechar
        </Button>
      ) : null}
    </div>
    </NivelDaFicha.Provider>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <Titulo>{titulo}</Titulo>
      {children}
    </section>
  );
}

/**
 * Vídeo · Músculos · Tutorial no YouTube (SPEC §14.2 e §22.14 item 4): a aba
 * do tutorial só existe quando o JSON tem o vídeo, e o rótulo diz de onde ele
 * vem. Sem ícone de link externo: com rede o vídeo toca aqui dentro
 * (`youtube-nocookie`), e o ícone prometia uma saída do app que não acontece;
 * ele fica só no "Abrir no YouTube" da aba sem rede, que sai de verdade. As
 * abas dividem a largura pelo tamanho do rótulo (`flex-auto`): em partes
 * iguais, "Tutorial no YouTube" não cabia no terço de 328 px.
 */
function AbasDaMidia({
  exercicioId,
  temVideo,
  comoPagina,
}: {
  exercicioId: string;
  temVideo: boolean;
  comoPagina: boolean;
}) {
  const abas = abasDaFicha(tutorialPorExercicio(exercicioId) !== null);
  return (
    <Tabs defaultValue="video" className="gap-3">
      <TabsList className="w-full">
        {abas.map((aba) => (
          <TabsTrigger key={aba} value={aba} className="alvo flex-auto">
            {ROTULO_DA_ABA[aba]}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="video">
        <AbaVideo
          exercicioId={exercicioId}
          temVideo={temVideo}
          comoPagina={comoPagina}
        />
      </TabsContent>

      <TabsContent value="musculos">
        <AbaMusculos exercicioId={exercicioId} />
      </TabsContent>

      {abas.includes("tutorial") ? (
        <TabsContent value="tutorial">
          <TutorialDoExercicio exercicioId={exercicioId} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

const ROTULO_DA_MIDIA: Readonly<Record<TipoDeMidia, string>> = {
  video: "Vídeo",
  ilustracao: "Ilustração",
  figura: "Figura",
  foto: "Fotos",
};

/**
 * A aba Vídeo (SPEC §14.2 e marco Mídia): a ilustração com licença livre
 * alternando as duas posições, com o segmento "Ilustração · Figura · Fotos"
 * para trocar de demonstração. O vídeo local (§13.1) continua na frente
 * quando o arquivo existe.
 */
function AbaVideo({
  exercicioId,
  temVideo,
  comoPagina,
}: {
  exercicioId: string;
  temVideo: boolean;
  comoPagina: boolean;
}) {
  const exercicio = acharExercicio(exercicioId);
  /*
   * Na página inteira as duas fotos já aparecem logo abaixo, ampliáveis: pôr
   * "Fotos" também no segmento seria mostrar a mesma coisa duas vezes. Na
   * folha, que não tem a tira de fotos, a opção fica.
   */
  const opcoes = opcoesDeMidia(exercicioId, { temVideo }).filter(
    (o) => !(comoPagina && o === "foto"),
  );
  const [escolhido, setEscolhido] = useState<TipoDeMidia | null>(null);
  const [pausado, setPausado] = useState(false);
  const video = useRef<HTMLDivElement>(null);

  // pausar só faz sentido no vídeo local; a ilustração tem o próprio toque
  useEffect(() => {
    const elemento = video.current?.querySelector("video");
    if (!elemento) return;
    if (pausado) elemento.pause();
    else void elemento.play().catch(() => {});
  }, [pausado]);

  const tipo = escolhido && opcoes.includes(escolhido) ? escolhido : opcoes[0];

  return (
    <div className="flex flex-col gap-2">
      {/*
        SPEC §22.13 item 1 (correção da auditoria): o segmento fica ACIMA da
        mídia. Com a caixa na proporção da ilustração, a mídia muda de altura
        ao trocar de vista (de 130 a 448 px), e o segmento, embaixo dela,
        saltava até 369 px sob o dedo; em cima, ele não sai do lugar.
      */}
      {opcoes.length > 1 ? (
        <div
          role="group"
          aria-label="Como ver o exercício"
          className="bg-muted flex items-center gap-1 self-start rounded-lg p-1"
        >
          {opcoes.map((opcao) => (
            <button
              key={opcao}
              type="button"
              aria-pressed={opcao === tipo}
              onClick={() => setEscolhido(opcao)}
              /*
                SPEC §22.13 item 6: o ativo era `bg-background` sobre o
                trilho `bg-muted` (1,08:1 no claro) — não se via qual estava
                escolhido. Ele ganha contorno de 2 px na cor do texto, que
                passa de 3:1 contra o trilho nos dois temas. O fundo não
                inverte: `bg-foreground` virava uma placa de 91 % de luz no
                escuro (§22.3 item 4). O inativo tem o mesmo contorno,
                transparente, para o texto não pular ao trocar.
              */
              className={cn(
                "alvo h-9 rounded-md border-2 px-3 text-xs font-medium",
                opcao === tipo
                  ? "bg-background text-foreground border-foreground shadow-sm"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {ROTULO_DA_MIDIA[opcao]}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={video}>
        {tipo === "foto" ? (
          <FotosExercicio exercicio={exercicio} />
        ) : (
          <MediaGrande
            exercicioId={exercicioId}
            temVideo={temVideo}
            tipo={tipo}
            semFoto={comoPagina}
            proporcional
            className={comoPagina ? "h-52" : "h-44"}
          />
        )}
      </div>

      {tipo === "video" ? (
        <Button
          variant="outline"
          className="alvo self-start"
          onClick={() => setPausado((v) => !v)}
        >
          {pausado ? <Play className="size-4" /> : <Pause className="size-4" />}
          {pausado ? "Continuar" : "Pausar"}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A aba Músculos (SPEC §14.2 e §22.14 item 3a): o mapa anatômico
 * frente/costas com a legenda em texto — a cor sozinha nunca é a única pista.
 * A ilustração não se repete aqui: ela é a aba Vídeo.
 */
function AbaMusculos({ exercicioId }: { exercicioId: string }) {
  const exercicio = acharExercicio(exercicioId);

  return (
    <div className="flex flex-col gap-3">
      <MapaAnatomico
        primarios={exercicio.musculos_primarios}
        secundarios={exercicio.musculos_secundarios}
        className="mx-auto max-w-[280px]"
      />

      <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
        <li className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-0.5 size-3 shrink-0 rounded-full"
            style={{ background: "var(--mprim)" }}
          />
          <span>
            <span className="text-foreground font-medium">Principais:</span>{" "}
            {exercicio.musculos_primarios_nome.join(", ") || "—"}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-0.5 size-3 shrink-0 rounded-full"
            style={{ background: "var(--msec)" }}
          />
          <span>
            <span className="text-foreground font-medium">Ajudam:</span>{" "}
            {exercicio.musculos_secundarios_nome.join(", ") || "—"}
          </span>
        </li>
      </ul>
    </div>
  );
}

/** "Área de foco" em chips: primário forte, secundário claro (SPEC §14.2). */
function AreaDeFoco({ exercicioId }: { exercicioId: string }) {
  const exercicio = acharExercicio(exercicioId);
  const primarios = exercicio.musculos_primarios_nome;
  const secundarios = exercicio.musculos_secundarios_nome;
  if (primarios.length === 0 && secundarios.length === 0) return null;

  return (
    <Secao titulo="Área de foco">
      <ul aria-label="Área de foco" className="flex flex-wrap gap-1.5">
        {primarios.map((nome) => (
          <li
            key={`p-${nome}`}
            data-foco="primario"
            className="border-primary bg-primary/15 text-foreground rounded-full border px-2.5 py-1 text-xs font-semibold"
          >
            {nome}
          </li>
        ))}
        {secundarios.map((nome) => (
          <li
            key={`s-${nome}`}
            data-foco="secundario"
            className="border-border text-muted-foreground rounded-full border px-2.5 py-1 text-xs"
          >
            {nome}
          </li>
        ))}
      </ul>
    </Secao>
  );
}

/** Duração / Repetições / Séries — só a prescrição desta sessão (SPEC §14.2). */
function StepperDaSessao({ contexto }: { contexto: ContextoDaFicha }) {
  const rotuloAlvo =
    contexto.tipo === "tempo_s"
      ? "Duração (s)"
      : contexto.tipo === "passos"
        ? "Passos"
        : "Repetições";
  const mostraAlvo = contexto.tipo !== "maximo";

  return (
    <section className="border-border bg-card cartao flex flex-col gap-2 border p-3">
      <Titulo>Só nesta sessão</Titulo>
      {mostraAlvo ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs uppercase">{rotuloAlvo}</span>
          <StepperNumerico
            rotulo={rotuloAlvo}
            valor={contexto.alvo}
            passo={contexto.tipo === "tempo_s" ? 5 : 1}
            minimo={1}
            aoMudar={(v) => contexto.aoMudarAlvo(v ?? 1)}
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs uppercase">Séries</span>
        <StepperNumerico
          rotulo="Séries"
          valor={contexto.series}
          passo={1}
          minimo={MIN_SERIES}
          maximo={MAX_SERIES}
          aoMudar={(v) => contexto.aoMudarSeries(v ?? MIN_SERIES)}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Muda só o treino de hoje. A progressão do exercício continua como está.
      </p>
    </section>
  );
}

function Navegacao({ contexto }: { contexto: ContextoDaFicha }) {
  const ir = contexto.aoIr;
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        className="alvo h-12 px-3"
        disabled={!ir || contexto.indice <= 0}
        onClick={() => ir?.(contexto.indice - 1)}
        aria-label="Exercício anterior"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <span className="numero text-muted-foreground text-sm">
        {contexto.indice + 1}/{contexto.total}
      </span>
      <Button
        variant="outline"
        className="alvo h-12 px-3"
        disabled={!ir || contexto.indice >= contexto.total - 1}
        onClick={() => ir?.(contexto.indice + 1)}
        aria-label="Próximo exercício"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}

/** "Substituir hoje" (SPEC §3.2 e §14.1.2: quem é "evitar" vai para o fim). */
function Substituir({
  exercicioId,
  prefs,
  aoEscolher,
}: {
  exercicioId: string;
  prefs?: Prefs;
  aoEscolher: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const lista = evitadosPorUltimo(substitutosPara(exercicioId), (e) => e.id, prefs);
  if (lista.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="alvo self-start"
        onClick={() => setAberto((v) => !v)}
      >
        <Repeat className="size-4" />
        Substituir
      </Button>
      {aberto ? (
        <ul className="flex flex-col gap-1">
          {lista.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setAberto(false);
                  aoEscolher(e.id);
                }}
                className={cn(
                  "hover:bg-muted alvo flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left",
                )}
              >
                <span className="text-sm font-medium">{e.nome}</span>
                <span className="text-muted-foreground text-xs">
                  {e.prescricao_padrao.texto} · {e.equipamento_texto}
                  {evitado(prefs, e.id) ? " · você marcou como evitar" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A ficha por cima de qualquer tela, sem perder o estado (SPEC §14.2). */
export function FichaEmFolha({
  exercicioId,
  aberto,
  aoMudarAberto,
  temVideo = false,
  contexto,
  prefs,
}: {
  exercicioId: string | null;
  aberto: boolean;
  aoMudarAberto: (v: boolean) => void;
  temVideo?: boolean;
  contexto?: ContextoDaFicha;
  prefs?: Prefs;
}) {
  if (!exercicioId) return null;
  const exercicio = acharExercicio(exercicioId);

  return (
    <Sheet open={aberto} onOpenChange={aoMudarAberto}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto pb-8">
        <SheetHeader className="pb-0">
          <SheetTitle className="text-balance">{exercicio.nome}</SheetTitle>
          <SheetDescription>
            {exercicio.grupo} · {exercicio.equipamento_texto}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <ConteudoDaFicha
            exercicioId={exercicioId}
            temVideo={temVideo}
            contexto={contexto}
            prefs={prefs}
            aoFechar={() => aoMudarAberto(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CabecalhoMais } from "@/components/mais/cabecalho";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { iso } from "@/lib/calendario";
import { formatarData } from "@/lib/formato";
import { gerarIcs, NOME_DO_ARQUIVO_ICS, TIPO_ICS } from "@/lib/ics";
import {
  comLembretes,
  DIAS_DO_LEMBRETE,
  eventosDoCalendario,
  lembretesDasPrefs,
  PASSO_MIN,
  proximoLembrete,
  relogioDeSaoPaulo,
  ROTULO_DO_LEMBRETE,
  textoDoUltimo,
  type ContaDaRegra,
} from "@/lib/lembretes-regra";
import { salvarPrefs } from "@/lib/queries/mais";
import { useCardio, useOverrides, usePerfil, useSessoes } from "@/lib/queries/dados";
import {
  bytesDaChave,
  ehIos,
  estadoDoAparelho,
  instrucoesDoAparelho,
  LINHA_LEMBRETES,
  nomeDoAparelho,
  ROTULO_DO_ESTADO,
  SEM_CONFIGURACAO,
  SEM_TABELA,
  tabelaAusente,
} from "@/lib/lembretes";
import {
  envioLembreteSchema,
  inscricaoLembreteSchema,
  prefsLembretesSchema,
  type EnvioLembrete,
  type InscricaoLembrete,
  type PrefsLembretes,
  type TipoDeLembrete,
} from "@/lib/schemas";
import { clienteNavegador } from "@/lib/supabase/client";

const TABELA = "lembretes_inscricoes";

/** Quanto esperar o service worker ficar pronto antes de desistir. */
const PRAZO_DO_WORKER_MS = 10_000;

type Permissao = "default" | "granted" | "denied";

const LER_FALHOU = "Não deu para ler os aparelhos agora.";

interface Mensagem {
  tipo: "status" | "alert";
  texto: string;
  /**
   * Onde a frase aparece: a de ativar/desativar fica no bloco "Este
   * aparelho", abaixo do estado (e do botão, quando há) e **acima** das
   * instruções (na primeira dobra mesmo com duas instruções, §23.4); a da
   * lista e do teste, entre os dois blocos.
   */
  onde: "aparelho" | "lista";
  /** `role="status"` com a cor de erro: o teste não chegou a nenhum aparelho (§23.4). */
  falha?: boolean;
}

function temSuporte(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** O registro do service worker, ou `null` se ele não ficar pronto a tempo. */
async function registroDoWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PRAZO_DO_WORKER_MS)),
  ]);
}

/**
 * `pushManager.subscribe` com a chave pública do servidor. Uma inscrição
 * antiga feita com outra chave faz o navegador recusar (`InvalidStateError`):
 * ela é cancelada e o pedido refeito uma vez. Uma inscrição sem as duas
 * chaves (`p256dh`, `auth`) não serve para cifrar o aviso: é cancelada e
 * conta como falha do `subscribe` (§23.2).
 */
async function inscrever(
  registro: ServiceWorkerRegistration,
  chavePublica: string,
): Promise<PushSubscription> {
  const opcoes = { userVisibleOnly: true, applicationServerKey: bytesDaChave(chavePublica) };
  let inscricao: PushSubscription;
  try {
    inscricao = await registro.pushManager.subscribe(opcoes);
  } catch (e) {
    if ((e as Error).name !== "InvalidStateError") throw e;
    const antiga = await registro.pushManager.getSubscription();
    await antiga?.unsubscribe();
    inscricao = await registro.pushManager.subscribe(opcoes);
  }
  const chaves = inscricao.toJSON().keys;
  if (!chaves?.p256dh || !chaves.auth) {
    await inscricao.unsubscribe();
    throw new Error("inscrição sem chaves");
  }
  return inscricao;
}

/** O nome que a lista mostra — o mesmo no recado e no `aria-label` do Remover. */
function nomeNaLista(a: InscricaoLembrete): string {
  return a.aparelho || "Aparelho sem nome";
}

/** A linha da tabela: o `user_id` é o da sessão (a coluna não tem default, §23.2). */
function linhaDaInscricao(inscricao: PushSubscription, aparelho: string, userId: string) {
  const chaves = inscricao.toJSON().keys ?? {};
  return {
    user_id: userId,
    endpoint: inscricao.endpoint,
    p256dh: chaves.p256dh ?? "",
    auth: chaves.auth ?? "",
    aparelho,
  };
}

/**
 * Mais → Lembretes (SPEC §23.4): ativar e desativar neste aparelho, a lista
 * dos aparelhos da conta e o lembrete de teste. As decisões (estado,
 * instruções, textos) são de `lib/lembretes.ts`.
 */
export function TelaLembretes({
  userId,
  chavePublica,
}: {
  userId: string;
  chavePublica: string | null;
}) {
  const [carregado, setCarregado] = useState(false);
  const [suportado, setSuportado] = useState(false);
  const [permissao, setPermissao] = useState<Permissao>("default");
  const [endpointAtual, setEndpointAtual] = useState<string | null>(null);
  const [aparelhos, setAparelhos] = useState<InscricaoLembrete[]>([]);
  const [semTabela, setSemTabela] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [sinais, setSinais] = useState({ brave: false, ios: false, instalado: false });
  /** A permissão da última leitura: a volta das configurações compara com ela. */
  const permissaoLida = useRef<Permissao>("default");
  /** Um Ativar/Desativar/Remover/teste em andamento: a volta não relê no meio. */
  const emAndamento = useRef(false);

  function comecar(qual: string) {
    emAndamento.current = true;
    setOcupado(qual);
  }
  function terminar() {
    emAndamento.current = false;
    setOcupado(null);
  }

  /**
   * Lê permissão, inscrição do navegador e linhas da tabela. Na `volta`
   * (a página voltou a ficar visível, §23.4), se a permissão mudou desde a
   * última leitura, a frase e a falha antigas saem: elas falavam de outro
   * estado ("recusou", "bloqueado").
   */
  const carregar = useCallback(async ({ volta = false }: { volta?: boolean } = {}) => {
    const pode = temSuporte();
    setSuportado(pode);
    setSinais({
      brave: "brave" in navigator,
      ios: ehIos(navigator.userAgent, navigator.maxTouchPoints),
      instalado:
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    });
    if (pode) {
      const atual = Notification.permission;
      if (volta && atual !== permissaoLida.current) {
        setFalhou(false);
        setMensagem(null);
      }
      permissaoLida.current = atual;
      setPermissao(atual);
    }
    if (chavePublica === null) {
      setCarregado(true);
      return;
    }
    if (pode) {
      const registro = await registroDoWorker();
      const inscricao = await registro?.pushManager.getSubscription();
      setEndpointAtual(inscricao?.endpoint ?? null);
    }
    const { data, error } = await clienteNavegador()
      .from(TABELA)
      .select("id, endpoint, p256dh, auth, aparelho, criado_em")
      .order("criado_em", { ascending: true });
    if (error) {
      const ausente = tabelaAusente(error);
      setSemTabela(ausente);
      // A frase do aparelho ("recusou", "não conseguiu ativar") fica: ela fala
      // do que a pessoa fez, e uma volta sem internet não muda isso (§23.4).
      // O aviso da lista só entra onde não há frase do aparelho.
      if (!ausente) {
        setMensagem((atual) =>
          atual?.onde === "aparelho" ? atual : { tipo: "alert", texto: LER_FALHOU, onde: "lista" },
        );
      }
    } else {
      setSemTabela(false);
      // a leitura deu certo: o aviso de que não deu para ler sai
      setMensagem((atual) => (atual?.onde === "lista" && atual.texto === LER_FALHOU ? null : atual));
      setAparelhos(
        (data ?? []).flatMap((linha: unknown) => {
          const lida = inscricaoLembreteSchema.safeParse(linha);
          return lida.success ? [lida.data] : [];
        }),
      );
    }
    setCarregado(true);
  }, [chavePublica]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /*
   * A volta das configurações (§23.4): quem liberou a permissão pelo cadeado,
   * pelas Configurações do Android ou pelos Ajustes do iPhone volta sem
   * recarregar — a tela confere de novo ao ficar visível, ao ganhar foco, ao
   * voltar do cache e quando o navegador avisa a troca da permissão.
   */
  useEffect(() => {
    let viva = true;
    let lendo = false;
    const reler = () => {
      if (!viva || lendo || emAndamento.current) return;
      if (document.visibilityState !== "visible") return;
      lendo = true;
      void carregar({ volta: true })
        .catch(() => undefined)
        .finally(() => {
          lendo = false;
        });
    };
    document.addEventListener("visibilitychange", reler);
    window.addEventListener("focus", reler);
    window.addEventListener("pageshow", reler);
    let status: PermissionStatus | null = null;
    if (typeof navigator.permissions?.query === "function") {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((s) => {
          if (!viva) return;
          status = s;
          s.addEventListener("change", reler);
        })
        .catch(() => undefined);
    }
    return () => {
      viva = false;
      document.removeEventListener("visibilitychange", reler);
      window.removeEventListener("focus", reler);
      window.removeEventListener("pageshow", reler);
      status?.removeEventListener("change", reler);
    };
  }, [carregar]);

  const inscrito = endpointAtual !== null && aparelhos.some((a) => a.endpoint === endpointAtual);
  const estado = estadoDoAparelho({
    configurado: chavePublica !== null,
    suportado,
    permissao,
    inscrito,
  });
  const instrucoes = instrucoesDoAparelho({ estado, falhou, ...sinais });

  /** Grava a inscrição; se o aparelho era de outra conta, pede uma nova (§23.2). */
  async function gravar(registro: ServiceWorkerRegistration, chave: string, inscricao: PushSubscription) {
    const supabase = clienteNavegador();
    const aparelho = nomeDoAparelho(navigator.userAgent, sinais.brave);
    // a linha antiga deste mesmo endpoint, se for desta conta (a RLS limita)
    await supabase.from(TABELA).delete().eq("endpoint", inscricao.endpoint);
    let { error } = await supabase.from(TABELA).insert(linhaDaInscricao(inscricao, aparelho, userId));
    if (error?.code === "23505") {
      await inscricao.unsubscribe();
      const nova = await inscrever(registro, chave);
      ({ error } = await supabase.from(TABELA).insert(linhaDaInscricao(nova, aparelho, userId)));
    }
    if (error) throw new Error(error.message);
  }

  async function ativar() {
    if (chavePublica === null) return;
    comecar("ativar");
    setMensagem(null);
    setFalhou(false);
    try {
      const resposta = await Notification.requestPermission();
      permissaoLida.current = resposta;
      setPermissao(resposta);
      if (resposta !== "granted") {
        setFalhou(true);
        setMensagem({
          tipo: "alert",
          onde: "aparelho",
          texto:
            resposta === "denied"
              ? "O navegador recusou as notificações deste app."
              : "Sem a permissão o aviso não chega. Toque em Ativar de novo e escolha Permitir.",
        });
        return;
      }
      const registro = await registroDoWorker();
      if (!registro) {
        setFalhou(true);
        setMensagem({
          tipo: "alert",
          onde: "aparelho",
          texto: "O app ainda está terminando de instalar neste aparelho. Recarregue a página e tente de novo.",
        });
        return;
      }
      let inscricao: PushSubscription;
      try {
        inscricao = await inscrever(registro, chavePublica);
      } catch {
        setFalhou(true);
        setMensagem({ tipo: "alert", onde: "aparelho", texto: "O navegador não conseguiu ativar os avisos neste aparelho." });
        return;
      }
      await gravar(registro, chavePublica, inscricao);
      await carregar();
      setMensagem({ tipo: "status", onde: "aparelho", texto: "Lembretes ativados neste aparelho." });
    } catch {
      setFalhou(true);
      setMensagem({ tipo: "alert", onde: "aparelho", texto: "Não deu para ativar agora. Confira a internet e tente de novo." });
    } finally {
      terminar();
    }
  }

  async function desativar() {
    comecar("desativar");
    setMensagem(null);
    try {
      const registro = await registroDoWorker();
      const inscricao = await registro?.pushManager.getSubscription();
      if (inscricao) {
        const { error } = await clienteNavegador().from(TABELA).delete().eq("endpoint", inscricao.endpoint);
        if (error) throw new Error(error.message);
        await inscricao.unsubscribe();
      }
      await carregar();
      setMensagem({ tipo: "status", onde: "aparelho", texto: "Lembretes desativados neste aparelho." });
    } catch {
      setMensagem({ tipo: "alert", onde: "aparelho", texto: "Não deu para desativar agora. Confira a internet e tente de novo." });
    } finally {
      terminar();
    }
  }

  async function remover(alvo: InscricaoLembrete) {
    comecar(alvo.id);
    setMensagem(null);
    try {
      const { error } = await clienteNavegador().from(TABELA).delete().eq("id", alvo.id);
      if (error) throw new Error(error.message);
      if (alvo.endpoint === endpointAtual) {
        const registro = await registroDoWorker();
        await (await registro?.pushManager.getSubscription())?.unsubscribe();
      }
      await carregar();
      setMensagem({ tipo: "status", onde: "lista", texto: `${nomeNaLista(alvo)} saiu da lista.` });
    } catch {
      setMensagem({ tipo: "alert", onde: "lista", texto: "Não deu para remover agora. Confira a internet e tente de novo." });
    } finally {
      terminar();
    }
  }

  async function enviarTeste() {
    setMensagem(null);
    if (navigator.onLine === false) {
      setMensagem({ tipo: "alert", onde: "lista", texto: "Precisa de internet para enviar o teste." });
      return;
    }
    comecar("teste");
    try {
      const resposta = await fetch("/api/lembretes/teste", { method: "POST" });
      const corpo = (await resposta.json().catch(() => ({}))) as {
        texto?: string;
        erro?: string;
        resultados?: { destino?: string }[];
      };
      if (resposta.ok && corpo.texto) {
        const chegou = (corpo.resultados ?? []).some((r) => r.destino === "enviado");
        setMensagem({ tipo: "status", onde: "lista", texto: corpo.texto, falha: !chegou });
        await carregar();
      } else {
        setMensagem({ tipo: "alert", onde: "lista", texto: corpo.erro ?? "Não deu para enviar agora. Tente de novo." });
      }
    } catch {
      setMensagem({ tipo: "alert", onde: "lista", texto: "Não deu para enviar agora. Confira a internet e tente de novo." });
    } finally {
      terminar();
    }
  }

  const bloco = "bg-card border-border flex flex-col gap-3 rounded-xl border p-4";

  const recado = (onde: Mensagem["onde"]) =>
    mensagem?.onde === onde ? (
      <p
        role={mensagem.tipo}
        data-falha={mensagem.falha ? "" : undefined}
        className={
          mensagem.tipo === "status" && !mensagem.falha
            ? "border-primary/40 bg-primary/10 rounded-lg border px-3 py-2 text-sm font-medium text-balance"
            : "border-destructive/40 text-destructive rounded-lg border px-3 py-2 text-sm text-balance"
        }
      >
        {mensagem.texto}
      </p>
    ) : null;

  return (
    <section className="flex flex-col gap-4">
      <CabecalhoMais
        titulo={LINHA_LEMBRETES.titulo}
        descricao="Avisos no celular, mesmo com o app fechado. Ative em cada aparelho em que quiser receber."
      />

      {chavePublica === null || semTabela ? (
        <div className={bloco}>
          <p data-estado="sem-configuracao" className="text-sm text-balance">
            {chavePublica === null ? SEM_CONFIGURACAO : SEM_TABELA}
          </p>
          {/* §23.9: sem push, os horários e o calendário continuam */}
          <p className="text-muted-foreground text-sm text-balance">
            Os horários e o calendário abaixo funcionam mesmo assim.
          </p>
        </div>
      ) : !carregado ? (
        <p className="text-muted-foreground text-sm">Conferindo este aparelho…</p>
      ) : (
        <>
          <section aria-labelledby="titulo-este-aparelho" className={bloco}>
            <h2 id="titulo-este-aparelho" className="text-base font-semibold">
              Este aparelho
            </h2>
            <p data-estado={estado} className="text-sm font-medium">
              {ROTULO_DO_ESTADO[estado]}
            </p>
            {estado === "desativado" ? (
              <Button
                type="button"
                className="alvo h-12 w-full"
                disabled={ocupado !== null}
                onClick={() => void ativar()}
              >
                {ocupado === "ativar" ? "Ativando…" : "Ativar lembretes neste aparelho"}
              </Button>
            ) : null}
            {estado === "ativado" ? (
              <Button
                type="button"
                variant="outline"
                className="alvo h-12 w-full"
                disabled={ocupado !== null}
                onClick={() => void desativar()}
              >
                {ocupado === "desativar" ? "Desativando…" : "Desativar neste aparelho"}
              </Button>
            ) : null}

            {recado("aparelho")}

            {instrucoes.map((instrucao) => (
              <section
                key={instrucao.id}
                data-instrucao={instrucao.id}
                aria-labelledby={`instrucao-${instrucao.id}`}
                className="border-border flex flex-col gap-2 rounded-lg border p-3"
              >
                <h3 id={`instrucao-${instrucao.id}`} className="text-sm font-semibold text-balance">
                  {instrucao.titulo}
                </h3>
                <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
                  {instrucao.passos.map((passo) => (
                    <li key={passo}>{passo}</li>
                  ))}
                </ol>
              </section>
            ))}
          </section>

          {recado("lista")}

          <section aria-labelledby="titulo-aparelhos" className={bloco}>
            <h2 id="titulo-aparelhos" className="text-base font-semibold">
              Aparelhos desta conta
            </h2>
            {aparelhos.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum aparelho com lembretes ainda.</p>
            ) : (
              <ul className="divide-border flex flex-col divide-y">
                {aparelhos.map((a) => (
                  <li key={a.id} data-aparelho={a.id} className="flex items-center gap-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {nomeNaLista(a)}
                        {a.endpoint === endpointAtual ? " (este)" : ""}
                      </span>
                      <span className="text-muted-foreground text-xs">desde {formatarData(a.criado_em)}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="alvo ml-auto shrink-0"
                      aria-label={`Remover ${nomeNaLista(a)} (desde ${formatarData(a.criado_em)})`}
                      disabled={ocupado !== null}
                      onClick={() => void remover(a)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {aparelhos.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="alvo h-12 w-full"
                disabled={ocupado !== null}
                onClick={() => void enviarTeste()}
              >
                {ocupado === "teste" ? "Enviando…" : "Enviar um lembrete de teste"}
              </Button>
            ) : null}
          </section>
        </>
      )}

      <BlocoHorarios userId={userId} />
    </section>
  );
}

/** Dia de hoje ± n, em ISO (a janela que a regra lê, como o tick). */
function diaMais(hoje: string, n: number): string {
  return iso(addDays(new Date(`${hoje}T12:00:00`), n));
}

/** Arredonda `HH:MM` para baixo no passo do disparo (5 min). */
function noPasso(hora: string): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  const minutos = Math.floor(Number(m[2]) / PASSO_MIN) * PASSO_MIN;
  const saida = `${m[1]}:${String(minutos).padStart(2, "0")}`;
  return prefsLembretesSchema.shape.treino.shape.hora.safeParse(saida).success ? saida : null;
}

const TIPOS: readonly TipoDeLembrete[] = ["treino", "corrida"];

/**
 * Os horários (SPEC §23.9), o "Próximo"/"Último lembrete" (§23.13) e o
 * calendário (§23.12). Não dependem do push: aparecem e funcionam sem as
 * variáveis VAPID, sem a tabela de inscrições e em aparelho sem suporte.
 */
function BlocoHorarios({ userId }: { userId: string }) {
  const cliente = useQueryClient();
  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => setAgora(new Date()), []);
  const hoje = agora ? relogioDeSaoPaulo(agora).dia : null;
  const de = hoje ? diaMais(hoje, -8) : null;
  const ate = hoje ? diaMais(hoje, 7) : null;
  const overridesQ = useOverrides(de, ate);
  const sessoesQ = useSessoes();
  const cardioQ = useCardio(de, hoje);
  const [enviados, setEnviados] = useState<EnvioLembrete[]>([]);
  /*
   * Os lembretes saem SEMPRE do perfil do cache (gravar já o atualiza na hora,
   * `salvarPrefs` → `setQueryData`): o cache persistido pode abrir com um valor
   * velho e a leitura do servidor corrigir logo depois — um estado local lido
   * uma vez só ficaria com o velho.
   */
  const lembretes = useMemo(() => (perfil ? lembretesDasPrefs(perfil.prefs) : null), [perfil]);
  const [horas, setHoras] = useState<Record<TipoDeLembrete, string>>({ treino: "", corrida: "" });
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const espera = useRef<Partial<Record<TipoDeLembrete, ReturnType<typeof setTimeout>>>>({});
  const perfilAtual = useRef(perfil);
  perfilAtual.current = perfil;

  // o campo mostra o gravado, menos enquanto a pessoa ainda está digitando nele
  useEffect(() => {
    if (!lembretes) return;
    setHoras((h) => ({
      treino: espera.current.treino ? h.treino : lembretes.treino.hora,
      corrida: espera.current.corrida ? h.corrida : lembretes.corrida.hora,
    }));
  }, [lembretes]);

  // "Último lembrete" (RLS: só os desta conta). Sem a tabela, não aparece.
  useEffect(() => {
    let viva = true;
    void (async () => {
      const { data, error } = await clienteNavegador()
        .from("lembretes_enviados")
        .select("tipo, dia, enviado_em")
        .order("enviado_em", { ascending: false })
        .limit(5);
      if (!viva || error) return;
      setEnviados(
        (data ?? []).flatMap((linha: unknown) => {
          const lida = envioLembreteSchema.safeParse(linha);
          return lida.success ? [lida.data] : [];
        }),
      );
    })().catch(() => undefined);
    return () => {
      viva = false;
    };
  }, []);

  const conta: ContaDaRegra | null = useMemo(() => {
    if (!perfil || !lembretes) return null;
    return {
      perfil: { ...perfil, prefs: comLembretes(perfil.prefs, lembretes) },
      overrides: overridesQ.data ?? [],
      sessoes: sessoesQ.data ?? [],
      cardios: cardioQ.data ?? [],
      enviados: hoje ? enviados.filter((e) => e.dia === hoje) : [],
    };
  }, [perfil, lembretes, overridesQ.data, sessoesQ.data, cardioQ.data, enviados, hoje]);

  const proximo = conta && agora ? proximoLembrete(conta, agora) : null;
  const ultimo = agora ? textoDoUltimo(enviados, agora) : null;

  /** Muda um tipo sobre o que está gravado AGORA (não sobre o de quando o toque começou). */
  async function gravar(tipo: TipoDeLembrete, mudanca: Partial<PrefsLembretes[TipoDeLembrete]>) {
    const atual = perfilAtual.current;
    if (!atual) return;
    const lidos = lembretesDasPrefs(atual.prefs);
    const validos = prefsLembretesSchema.safeParse({ ...lidos, [tipo]: { ...lidos[tipo], ...mudanca } });
    if (!validos.success) return;
    try {
      await salvarPrefs({ userId, prefs: comLembretes(atual.prefs, validos.data), cliente });
      setRecado({ texto: "Horários salvos.", erro: false });
    } catch {
      setRecado({ texto: "Não deu para salvar agora. Confira a internet e tente de novo.", erro: true });
    }
  }

  function ligar(tipo: TipoDeLembrete, ligado: boolean) {
    void gravar(tipo, { ligado });
  }

  function mudarHora(tipo: TipoDeLembrete, valor: string) {
    setHoras((h) => ({ ...h, [tipo]: valor }));
    clearTimeout(espera.current[tipo]);
    const hora = noPasso(valor);
    if (!hora) {
      espera.current[tipo] = undefined;
      return;
    }
    // o campo de hora do computador muda a cada dígito: grava quando parar
    espera.current[tipo] = setTimeout(() => {
      espera.current[tipo] = undefined;
      setHoras((h) => ({ ...h, [tipo]: hora }));
      void gravar(tipo, { hora });
    }, 600);
  }

  function baixarCalendario() {
    if (!perfil || !lembretes) return;
    const momento = new Date();
    const eventos = eventosDoCalendario(
      { ...perfil, prefs: comLembretes(perfil.prefs, lembretes) },
      momento,
    );
    const arquivo = new Blob([gerarIcs(eventos, userId, momento)], { type: TIPO_ICS });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = NOME_DO_ARQUIVO_ICS;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const bloco = "bg-card border-border flex flex-col gap-3 rounded-xl border p-4";

  return (
    <>
      <section aria-labelledby="titulo-horarios" data-horarios className={bloco}>
        <h2 id="titulo-horarios" className="text-base font-semibold">
          Horários
        </h2>
        <p className="text-muted-foreground text-sm text-balance">
          Nos dias do seu plano (Mais → Preferências → Dias de treino), no horário de Brasília.
        </p>
        {!lembretes ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : (
          TIPOS.map((tipo) => (
            <div key={tipo} data-lembrete={tipo} className="border-border flex flex-col gap-2 border-t pt-3">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor={`lembrete-${tipo}`} className="text-base">
                    {ROTULO_DO_LEMBRETE[tipo]}
                  </Label>
                  <p className="text-muted-foreground text-xs text-balance">{DIAS_DO_LEMBRETE[tipo]}</p>
                </div>
                <Switch
                  id={`lembrete-${tipo}`}
                  className="-mr-1.5"
                  checked={lembretes[tipo].ligado}
                  onCheckedChange={(v) => ligar(tipo, v)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor={`hora-${tipo}`} className="text-sm">
                  Hora
                </Label>
                <Input
                  id={`hora-${tipo}`}
                  type="time"
                  step={PASSO_MIN * 60}
                  value={horas[tipo]}
                  onChange={(e) => mudarHora(tipo, e.target.value)}
                  className="alvo numero h-12 w-40"
                />
              </div>
            </div>
          ))
        )}
        {recado ? (
          <p
            aria-live="polite"
            data-recado-horarios
            className={recado.erro ? "text-destructive text-sm" : "text-sm font-medium"}
          >
            {recado.texto}
          </p>
        ) : null}
        {proximo ? (
          <p data-proximo className="text-sm text-balance">
            {proximo}
          </p>
        ) : null}
        {ultimo ? (
          <p data-ultimo className="text-muted-foreground text-sm">
            {ultimo}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="titulo-calendario" className={bloco}>
        <h2 id="titulo-calendario" className="text-base font-semibold">
          No calendário do celular
        </h2>
        <p className="text-muted-foreground text-sm text-balance">
          Um evento por semana em cada dia de treino, com alarme na hora escolhida. Funciona em qualquer
          celular, mesmo onde a notificação do app não chega.
        </p>
        <Button
          type="button"
          variant="outline"
          className="alvo h-12 w-full"
          disabled={!lembretes}
          onClick={baixarCalendario}
        >
          Adicionar ao meu calendário
        </Button>
      </section>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CabecalhoMais } from "@/components/mais/cabecalho";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/formato";
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
import { inscricaoLembreteSchema, type InscricaoLembrete } from "@/lib/schemas";
import { clienteNavegador } from "@/lib/supabase/client";

const TABELA = "lembretes_inscricoes";

/** Quanto esperar o service worker ficar pronto antes de desistir. */
const PRAZO_DO_WORKER_MS = 10_000;

type Permissao = "default" | "granted" | "denied";

interface Mensagem {
  tipo: "status" | "alert";
  texto: string;
  /**
   * Onde a frase aparece: a de ativar/desativar fica no bloco "Este
   * aparelho", logo abaixo do estado e **acima** das instruções (na primeira
   * dobra mesmo com duas instruções, §23.4); a da lista e do teste, entre os
   * dois blocos.
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
      setSemTabela(tabelaAusente(error));
      if (!tabelaAusente(error)) {
        setMensagem({ tipo: "alert", texto: "Não deu para ler os aparelhos agora.", onde: "lista" });
      }
    } else {
      setSemTabela(false);
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
        <p data-estado="sem-configuracao" className={`${bloco} text-sm text-balance`}>
          {chavePublica === null ? SEM_CONFIGURACAO : SEM_TABELA}
        </p>
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
    </section>
  );
}

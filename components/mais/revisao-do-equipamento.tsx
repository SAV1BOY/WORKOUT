"use client";

import { useId, useRef, useState } from "react";
import { nomeDoMaterial } from "@/components/exercicio/equipamento-de-hoje";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { equipamentoDisponivel, exercicioPorId } from "@/lib/dados";
import { formatarDataCompleta, paraData } from "@/lib/formato";
import { resolverMaterialPendente, type MaterialPendente } from "@/lib/material-pendente";
import { acaoDaFolha } from "./controles-de-contagem";

const lista = new Intl.ListFormat("pt-BR", { type: "conjunction" });
const nomesDoMaterial = new Map<string, string>([...equipamentoDisponivel()].map(tag => [tag, nomeDoMaterial(tag)]));

function descreverMaterial(tags: string[] | null) {
  if (tags === null) return "Todo o equipamento";
  if (!tags.length) return "Só peso do corpo";
  const nomes = tags.map(tag => nomesDoMaterial.get(tag) ?? tag).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return lista.format(nomes);
}

function nomeDoExercicio(id: string) {
  return exercicioPorId.get(id)?.nome ?? id;
}

export function RevisaoDoEquipamento({ conta, materiais, online, aoFecharSemPendencias }: {
  conta: string; materiais: MaterialPendente[]; online: boolean; aoFecharSemPendencias: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const aviso = useRef<HTMLParagraphElement>(null);
  if (!aberta && !materiais.length) return null;

  return (
    <Sheet open={aberta} onOpenChange={valor => {
      setAberta(valor);
      if (valor) setMensagem("");
    }}>
      <SheetTrigger asChild>
        <Button variant="outline" className={`${acaoDaFolha} scroll-mb-24 justify-self-start`}>Rever equipamento do treino</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-2 overflow-hidden pb-3" onCloseAutoFocus={evento => {
        if (materiais.length) return;
        evento.preventDefault();
        aoFecharSemPendencias();
      }}>
        <SheetHeader className="shrink-0 pr-14 pb-0">
          <SheetTitle>Rever equipamento do treino</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-3">
          <SheetDescription>Compare o equipamento salvo neste aparelho com o do treino sincronizado.</SheetDescription>
          <p ref={aviso} tabIndex={-1} role="status" className="mt-2 font-medium">
            {mensagem || (!materiais.length && "O equipamento deste treino já foi resolvido.")}
          </p>
          {materiais.map(atual => <EscolhaDoEquipamento key={atual.sessaoId} conta={conta} atual={atual} online={online}
            aoEscolher={copia => {
              setMensagem(copia
                ? "Escolha salva. Quando o treino for confirmado, consulte a cópia em Cópias de edições do treino."
                : "Escolha salva neste aparelho.");
              aviso.current?.focus();
            }} />)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EscolhaDoEquipamento({ conta, atual, online, aoEscolher }: {
  conta: string; atual: MaterialPendente; online: boolean; aoEscolher: (copia: boolean) => void;
}) {
  const id = useId();
  const [revisaoVista, setRevisaoVista] = useState(atual.revisao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmarCopia, setConfirmarCopia] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const abrirConfirmacao = useRef<HTMLButtonElement>(null);
  const emCurso = useRef(false);
  const mudou = revisaoVista !== atual.revisao;
  const data = atual.data ? paraData(atual.data) : null;
  const guardar = new Set(atual.seriesParaGuardar.map(serie => serie.id));
  const enviar = atual.seriesNaFila.filter(serie => !guardar.has(serie.id));

  async function decidir(escolha: "aparelho" | "sincronizado" | "guardar-copia") {
    if (emCurso.current || mudou) return;
    emCurso.current = true;
    setSalvando(true);
    setErro("");
    try {
      await resolverMaterialPendente(conta, atual, escolha);
      aoEscolher(escolha === "guardar-copia");
    } catch {
      setErro("Não foi possível salvar a escolha. Confira o equipamento atual e tente de novo.");
    } finally {
      emCurso.current = false;
      setSalvando(false);
    }
  }

  return (
    <section aria-labelledby={id} className="border-border grid min-w-0 gap-3 border-b py-4 wrap-anywhere last:border-0">
      <div>
        <h3 id={id} ref={titulo} tabIndex={-1} className="font-semibold">{atual.titulo || "Treino"}</h3>
        <p className="text-muted-foreground text-sm">
          {data && Number.isFinite(data.getTime()) && <><time dateTime={atual.data}>{formatarDataCompleta(data)}</time>{" · "}</>}
          Treino {atual.sessaoId.slice(-8)}
        </p>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2">
        <div className="border-border min-w-0 rounded-md border p-2">
          <dt className="text-muted-foreground">Neste aparelho</dt>
          <dd className="font-medium">{descreverMaterial(atual.local)}</dd>
        </div>
        <div className="border-border min-w-0 rounded-md border p-2">
          <dt className="text-muted-foreground">No treino sincronizado</dt>
          <dd className="font-medium">{descreverMaterial(atual.sincronizado)}</dd>
        </div>
      </dl>
      {atual.exerciciosAcrescentados.length > 0 && <p>
        {atual.exerciciosAcrescentados.length === 1 ? "Acrescentado no treino sincronizado" : "Acrescentados no treino sincronizado"}
        {" · "}{lista.format(atual.exerciciosAcrescentados.map(nomeDoExercicio))}
      </p>}
      {enviar.length > 0 && <div>
        <p className="font-medium">Séries aguardando envio</p>
        <ul className="list-inside list-disc">{enviar.map(s => (
          <li key={s.id}>{nomeDoExercicio(s.exercicioId)} · Série {s.indice}</li>
        ))}</ul>
      </div>}
      {atual.seriesParaGuardar.length > 0 && <div>
        <p className="font-medium">Séries que ficarão só na cópia</p>
        <ul className="list-inside list-disc">{atual.seriesParaGuardar.map(s => (
          <li key={s.id}>{nomeDoExercicio(s.exercicioId)} · Série {s.indice}</li>
        ))}</ul>
      </div>}
      {mudou ? (
        <>
          <p role="status">O treino mudou. Confira os registros atualizados antes de escolher.</p>
          <Button variant="outline" className={`${acaoDaFolha} justify-self-start`}
            onClick={() => {
              setRevisaoVista(atual.revisao);
              setConfirmarCopia(false);
              setErro("");
              titulo.current?.focus();
            }}>Rever equipamento atualizado</Button>
        </>
      ) : atual.outrasEdicoes ? (
        <div className="grid min-w-0 gap-3">
          <p>As edições deste aparelho diferem do plano sincronizado. Você pode guardar a versão local em uma cópia e continuar com o plano sincronizado.</p>
          <Button ref={abrirConfirmacao} variant="outline" className={`${acaoDaFolha} justify-self-start`}
            aria-expanded={confirmarCopia} aria-controls={`${id}-confirmar`} disabled={salvando}
            onClick={() => setConfirmarCopia(!confirmarCopia)}>Guardar cópia e manter treino sincronizado</Button>
          {confirmarCopia && <div id={`${id}-confirmar`} className="border-border grid gap-3 rounded-md border p-3">
            <p>A cópia será guardada neste aparelho com a edição original e as séries incompatíveis. As séries compatíveis seguem para o treino sincronizado.</p>
            {!online && <p className="text-muted-foreground">A cópia ficará disponível quando a conexão voltar e o treino for confirmado.</p>}
            <div className="flex flex-wrap gap-2">
              <Button className={acaoDaFolha} disabled={salvando}
                onClick={() => void decidir("guardar-copia")}>Confirmar e guardar cópia</Button>
              <Button variant="outline" className={acaoDaFolha} disabled={salvando}
                onClick={() => { setConfirmarCopia(false); abrirConfirmacao.current?.focus(); }}>Voltar</Button>
            </div>
          </div>}
        </div>
      ) : (
        <>
          <p>{atual.sessaoEncerrada
            ? "Este treino já foi encerrado. Você pode manter o equipamento sincronizado."
            : "A escolha vale só para o equipamento. Os exercícios e as séries continuam no treino."}</p>
          {!online && <p className="text-muted-foreground">Sem rede. Sua escolha será enviada quando a conexão voltar.</p>}
          <div className="flex flex-wrap gap-2">
            <Button className={acaoDaFolha} disabled={salvando} onClick={() => void decidir("sincronizado")}>
              Manter equipamento sincronizado
            </Button>
            {!atual.sessaoEncerrada && <Button variant="outline" className={acaoDaFolha} disabled={salvando}
              onClick={() => void decidir("aparelho")}>Usar equipamento deste aparelho</Button>}
          </div>
        </>
      )}
      {erro && <p role="alert" className="text-destructive">{erro}</p>}
    </section>
  );
}

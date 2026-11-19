"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { formatarDataCompleta, paraData } from "@/lib/formato";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { confirmarSaltosPendentes, resolverConciliacaoDeSaltos, type ConciliacaoDeSaltos, type SaltosPendentes } from "@/lib/saltos-pendentes";
import { acaoDaFolha, CampoInteiroRecusado, EscolhaDoRegistro, lerInteiro, numero } from "./controles-de-contagem";

type Registro = Record<string, unknown>;
const horario = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const tipos: Record<string, string> = { corrida: "Corrida", corda: "Corda", caminhada: "Caminhada", outro: "Outro cardio" };

function tituloDoCardio(linha: Registro, id: string) {
  const tipo = typeof linha.tipo === "string" ? tipos[linha.tipo] ?? "Cardio" : "Cardio";
  const data = typeof linha.data === "string" ? paraData(linha.data) : null;
  const dia = data && Number.isFinite(data.getTime()) ? formatarDataCompleta(data) : "Data não registrada";
  return `${tipo} · ${dia} · Treino ${id.slice(-8)}`;
}

function contextoDoCardio(linha: Registro) {
  const inicio = typeof linha.created_at === "string" ? Date.parse(linha.created_at) : NaN;
  const partes = [];
  if (Number.isFinite(inicio)) partes.push(`Registrado às ${horario.format(inicio)}`);
  if (typeof linha.duracao_min === "number") partes.push(`${numero.format(linha.duracao_min)} min`);
  if (typeof linha.distancia_km === "number") partes.push(`${numero.format(linha.distancia_km)} km`);
  return partes.join(" · ");
}

export function CorrecaoDosSaltos({ conta, atual, aoGuardar }: {
  conta: string; atual: SaltosPendentes; aoGuardar: () => void;
}) {
  const id = useId();
  const [base, setBase] = useState(atual);
  const [texto, setTexto] = useState("");
  const [semContagem, setSemContagem] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const emCurso = useRef(false);
  const mudou = base.revisao !== atual.revisao;
  const valor = base.posterior !== undefined ? base.posterior : semContagem ? null : lerInteiro(texto);
  const faltaValor = base.posterior === undefined && !semContagem && valor === null;
  const contexto = contextoDoCardio(base.local);

  const confirmar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (emCurso.current || mudou || faltaValor) return;
    emCurso.current = true;
    setSalvando(true);
    setErro("");
    try {
      await confirmarSaltosPendentes(conta, base, valor);
      await confirmarContaDoTreino(conta, "A conta deste treino mudou.");
      aoGuardar();
    } catch {
      setErro("Não foi possível confirmar a correção. Confira se o treino mudou e tente de novo.");
    } finally {
      emCurso.current = false;
      setSalvando(false);
    }
  };

  return (
    <form aria-labelledby={id} onSubmit={e => void confirmar(e)} className="border-border flex min-w-0 flex-col gap-3 border-b py-4 last:border-0">
      <div>
        <h3 id={id} className="font-semibold wrap-anywhere">{tituloDoCardio(base.local, base.cardioId)}</h3>
        {contexto && <p className="text-muted-foreground text-sm">{contexto}</p>}
        {typeof base.local.notas === "string" && base.local.notas && (
          <p className="mt-1 text-sm whitespace-pre-wrap wrap-anywhere">{base.local.notas}</p>
        )}
      </div>
      <CampoInteiroRecusado rotulo="Saltos" fracionario={base.fracionario} posterior={base.posterior}
        texto={semContagem ? "" : texto} aoDigitar={setTexto} bloqueado={salvando || mudou || semContagem}
        ajuda="Informe o número de saltos, sem casas decimais." />
      {base.posterior === undefined && (
        <label className="alvo flex cursor-pointer items-center gap-2 self-start text-sm">
          <input type="checkbox" className="foco accent-primary size-5 shrink-0" checked={semContagem}
            disabled={salvando || mudou} onChange={e => setSemContagem(e.target.checked)} />
          Deixar sem contagem
        </label>
      )}
      {mudou ? (
        <>
          <p role="status" className="text-sm">O treino mudou neste aparelho. Confira os valores atuais.</p>
          <Button type="button" variant="outline" className={`${acaoDaFolha} self-start`} onClick={() => {
            setBase(atual); setTexto(""); setSemContagem(false); setErro("");
          }}>Rever valores</Button>
        </>
      ) : (
        <Button type="submit" className={`${acaoDaFolha} self-start`} disabled={salvando || faltaValor}>
          {salvando ? "Confirmando…" : "Confirmar correção"}
        </Button>
      )}
      {erro && <p role="alert" className="text-destructive text-sm">{erro}</p>}
    </form>
  );
}

function ValoresDoCardio({ origem, linha, id }: { origem: string; linha: Registro; id: string }) {
  const contexto = contextoDoCardio(linha);
  return (
    <div className="border-border min-w-0 rounded-md border p-2 text-sm wrap-anywhere">
      <h4 className="font-medium">{origem}</h4>
      <p className="mt-1 font-medium">{tituloDoCardio(linha, id)}</p>
      {contexto && <p className="text-muted-foreground">{contexto}</p>}
      <dl className="mt-1 grid gap-1">
        <div><dt className="text-muted-foreground">Saltos</dt>
          <dd>{typeof linha.saltos === "number" ? numero.format(linha.saltos) : "Sem contagem"}</dd></div>
        {typeof linha.esforco === "string" && <div><dt className="text-muted-foreground">Esforço</dt>
          <dd>{linha.esforco === "facil" ? "Fácil" : linha.esforco === "moderado" ? "Moderado" : linha.esforco === "forte" ? "Forte" : linha.esforco}</dd></div>}
        {typeof linha.semana_plano === "number" && <div><dt className="text-muted-foreground">Semana do plano</dt><dd>{linha.semana_plano}</dd></div>}
        {typeof linha.concluida === "boolean" && <div><dt className="text-muted-foreground">Situação</dt><dd>{linha.concluida ? "Concluído" : "Em andamento"}</dd></div>}
        {typeof linha.notas === "string" && linha.notas && <div><dt className="text-muted-foreground">Nota</dt><dd className="whitespace-pre-wrap">{linha.notas}</dd></div>}
      </dl>
    </div>
  );
}

export function EscolhaDosSaltos({ conta, atual, revisaoEscolhida, aoEscolher }: {
  conta: string; atual: ConciliacaoDeSaltos; revisaoEscolhida?: string; aoEscolher: () => void;
}) {
  const ausente = atual.estado === "ausente";
  const local = ausente ? atual.origem ?? atual.local : atual.local;
  const outra = ausente ? atual.insercao : atual.remota;
  return (
    <EscolhaDoRegistro tipo="treino" titulo={tituloDoCardio(local, atual.cardioId)} atual={atual} conta={conta}
      revisaoEscolhida={revisaoEscolhida} salvar={escolha => resolverConciliacaoDeSaltos(conta, atual, escolha)} aoEscolher={aoEscolher}>
      {ausente ? <p className="text-sm">Este treino está ausente do histórico. Confira os dados do backup antes de decidir.</p>
        : !atual.mesmaIdentidade && <p className="text-sm">O registro no histórico pertence a outro treino. Confira a atividade e a data.</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2">
        <ValoresDoCardio origem="No aparelho" linha={local} id={atual.cardioId} />
        {outra && <ValoresDoCardio origem={ausente ? "Treino do backup" : "No histórico"} linha={outra} id={atual.cardioId} />}
      </div>
      {ausente && <p className="text-sm">{atual.permiteCriar
        ? "O treino será criado com os dados de “Treino do backup”."
        : "O backup tem dados insuficientes para criar este treino."}</p>}
    </EscolhaDoRegistro>
  );
}

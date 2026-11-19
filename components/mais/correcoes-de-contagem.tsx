"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CampoInteiroRecusado, EscolhaDoRegistro, acaoDaFolha, lerInteiro, numero } from "./controles-de-contagem";
import { CorrecaoDosSaltos, EscolhaDosSaltos } from "./correcao-dos-saltos";
import type { ConciliacaoDeSaltos, SaltosPendentes } from "@/lib/saltos-pendentes";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  confirmarContagemPendente, resolverConciliacaoDeContagem,
  type CampoContagem, type ConciliacaoDeContagem, type ContagemPendente,
} from "@/lib/contagens-pendentes";
import { CAMPOS_DE_CONTAGEM } from "@/lib/campos-de-contagem";
import { nomeDaAssistencia } from "@/lib/sessao";
import { exercicioPorId } from "@/lib/dados";
import { corrigirConsultasDaSerie } from "@/lib/espelhos-da-contagem";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";

const rotulos: Record<CampoContagem, string> = {
  reps: "Repetições", reps_lado2: "Repetições (lado esquerdo)",
  tempo_s: "Tempo em segundos", tempo_s_lado2: "Tempo em segundos (lado esquerdo)",
  passos: "Passos", reps_alvo_min: "Meta mínima de repetições", reps_alvo_max: "Meta máxima de repetições",
};
const momento = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function rotuloDaContagem(campo: CampoContagem, unilateral: boolean | undefined) {
  return unilateral && (campo === "reps" || campo === "tempo_s")
    ? `${rotulos[campo]} (lado direito)` : rotulos[campo];
}

export function CorrecoesDeContagem({ conta, pendencias, comparacoes, saltos, comparacoesDeSaltos, online, tentando, tentar, aoFecharSemPendencias }: {
  conta: string; pendencias: ContagemPendente[]; comparacoes: ConciliacaoDeContagem[];
  saltos: SaltosPendentes[]; comparacoesDeSaltos: ConciliacaoDeSaltos[];
  online: boolean; tentando: boolean; tentar: () => Promise<void>; aoFecharSemPendencias: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [decididas, setDecididas] = useState<Record<string, string>>({});
  const aviso = useRef<HTMLParagraphElement>(null);
  const conflitos = comparacoes.filter(c => c.estado !== "aguardando");
  const conflitosDeSaltos = comparacoesDeSaltos.filter(c => c.estado !== "aguardando");
  const seriesNaEspera = comparacoes.filter(c => c.estado === "aguardando");
  const cordasNaEspera = comparacoesDeSaltos.filter(c => c.estado === "aguardando");
  const aguardando = [...seriesNaEspera, ...cordasNaEspera];
  const haEscolha = pendencias.length + conflitos.length + saltos.length + conflitosDeSaltos.length > 0;
  const aoGuardar = (texto: string) => {
    setMensagem(texto);
    aviso.current?.focus();
  };
  const escolhaSalva = (id: string, revisao: string) => {
    setDecididas(anteriores => ({ ...anteriores, [id]: revisao }));
    aoGuardar("Escolha salva neste aparelho.");
  };
  const falhas = [...new Set(aguardando.flatMap(c => c.erro ? [c.erro] : []))];
  const espera = aguardando.length > 0 && (
    <div className="grid gap-1">
      <p role="status" className="text-muted-foreground text-sm">
        {seriesNaEspera.length > 0 && (seriesNaEspera.length === 1 ? "Uma série aguarda comparação com o histórico." : `${seriesNaEspera.length} séries aguardam comparação com o histórico.`)}
        {cordasNaEspera.length > 0 && (cordasNaEspera.length === 1 ? " Um treino de corda aguarda comparação com o histórico." : ` ${cordasNaEspera.length} treinos de corda aguardam comparação com o histórico.`)}
        {!online && " A comparação será feita quando a conexão voltar."}
      </p>
      {falhas.length > 0 && (
        <>
          <p role="alert" className="text-sm wrap-anywhere">
            Não foi possível concluir a comparação com o histórico. {falhas.join(" ")}
          </p>
          {aberta && <Button variant="outline" className={`${acaoDaFolha} justify-self-start`} disabled={!online || tentando}
            onClick={() => void tentar()}>Tentar comparar de novo</Button>}
        </>
      )}
    </div>
  );
  if (!haEscolha && !aberta) return espera || null;

  return (
    <Sheet open={aberta} onOpenChange={valor => {
      setAberta(valor);
      if (valor) setMensagem("");
    }}>
      {!aberta && espera}
      <SheetTrigger asChild><Button variant="outline" className="alvo justify-self-start">Corrigir contagens</Button></SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-2 overflow-hidden pb-3"
        onCloseAutoFocus={evento => {
          if (haEscolha) return;
          evento.preventDefault();
          aoFecharSemPendencias();
        }}>
        <SheetHeader className="shrink-0 pr-14 pb-0">
          <SheetTitle>Corrigir contagens</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-3">
          <SheetDescription className="mb-3">Confira as contagens que precisam de correção ou que diferem do histórico.</SheetDescription>
          <p ref={aviso} tabIndex={-1} role="status" className="text-sm font-medium">{mensagem}</p>
          {espera}
          {conflitos.map(c => (
            <EscolhaDaContagem key={c.serieId} conta={conta} atual={c} revisaoEscolhida={decididas[c.serieId]}
              aoEscolher={() => escolhaSalva(c.serieId, c.revisao)} />
          ))}
          {pendencias.map(pendencia => (
            <CorrecaoDaSerie key={`${pendencia.sessaoId}/${pendencia.serieId}`} conta={conta} atual={pendencia}
              aoGuardar={() => aoGuardar("Correção salva neste aparelho.")} />
          ))}
          {conflitosDeSaltos.map(c => (
            <EscolhaDosSaltos key={`corda:${c.cardioId}`} conta={conta} atual={c}
              revisaoEscolhida={decididas[`corda:${c.cardioId}`]}
              aoEscolher={() => escolhaSalva(`corda:${c.cardioId}`, c.revisao)} />
          ))}
          {saltos.map(p => (
            <CorrecaoDosSaltos key={p.cardioId} conta={conta} atual={p}
              aoGuardar={() => aoGuardar("Correção salva neste aparelho.")} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function tituloDaLinha(linha: Record<string, unknown>) {
  const movimento = typeof linha.exercise_id === "string" ? exercicioPorId.get(linha.exercise_id)?.nome ?? linha.exercise_id : "Exercício";
  const tipo = linha.tipo === "aquecimento" ? "Aquecimento" : "Série";
  return `${movimento} · ${tipo}${typeof linha.set_index === "number" ? ` ${linha.set_index}` : ""}`;
}

function contextoDaLinha(linha: Record<string, unknown>) {
  const instante = typeof linha.registrada_em === "string" ? Date.parse(linha.registrada_em) : NaN;
  const partes = [];
  if (Number.isFinite(instante)) partes.push(momento.format(instante));
  if (typeof linha.session_id === "string") partes.push(`Treino ${linha.session_id.slice(-8)}`);
  if (typeof linha.ordem_ex === "number") partes.push(`Exercício ${linha.ordem_ex}`);
  return partes.join(" · ");
}

function MedidasDaContagem({ origem, linha, campos, mostrarIdentidade, mostrarProposta = false }: {
  origem: string; linha: Record<string, unknown>; campos: readonly CampoContagem[]; mostrarIdentidade: boolean; mostrarProposta?: boolean;
}) {
  const exercicio = typeof linha.exercise_id === "string" ? exercicioPorId.get(linha.exercise_id) : undefined;
  const unilateral = linha.reps_lado2 != null || linha.tempo_s_lado2 != null || exercicio?.prescricao_padrao.unilateral;
  return (
    <div className="border-border min-w-0 rounded-md border p-2 wrap-anywhere">
      <h4 className="font-medium">{origem}</h4>
      {mostrarIdentidade && (
        <div className="mt-1 text-sm">
          <p className="font-medium wrap-anywhere">{tituloDaLinha(linha)}</p>
          <p className="text-muted-foreground">{contextoDaLinha(linha)}</p>
          {typeof linha.concluida === "boolean" && <p>{linha.concluida ? "Concluída" : "Pendente"}</p>}
        </div>
      )}
      <dl className="mt-1 grid gap-1 text-sm">
        {campos.map(campo => {
          const rotulo = rotuloDaContagem(campo, unilateral);
          const valor = linha[campo];
          return <div key={campo}><dt className="text-muted-foreground">{rotulo}</dt>
            <dd className="font-medium">{typeof valor === "number" && Number.isFinite(valor) ? numero.format(valor) : "Sem registro"}</dd></div>;
        })}
        {(typeof linha.carga_kg === "number" || mostrarProposta) && <div>
          <dt className="text-muted-foreground">Carga</dt>
          <dd>{typeof linha.carga_kg === "number" && Number.isFinite(linha.carga_kg) ? `${numero.format(linha.carga_kg)} kg` : "Sem registro"}</dd>
        </div>}
        {mostrarProposta && typeof linha.assistencia === "string" && <div>
          <dt className="text-muted-foreground">Assistência</dt><dd>{nomeDaAssistencia(linha.assistencia)}</dd>
        </div>}
        {mostrarProposta && typeof linha.rpe === "number" && <div>
          <dt className="text-muted-foreground">Esforço percebido</dt><dd>{numero.format(linha.rpe)}</dd>
        </div>}
        {mostrarProposta && typeof linha.ultima_firme === "boolean" && <div>
          <dt className="text-muted-foreground">Última repetição firme</dt><dd>{linha.ultima_firme ? "Sim" : "Não"}</dd>
        </div>}
      </dl>
    </div>
  );
}

function EscolhaDaContagem({ conta, atual, revisaoEscolhida, aoEscolher }: {
  conta: string; atual: ConciliacaoDeContagem; revisaoEscolhida?: string; aoEscolher: () => void;
}) {
  const ausente = atual.estado === "ausente";
  const local = ausente ? atual.origem ?? atual.local : atual.local;
  const outra = ausente ? atual.insercao : atual.remota;
  const campos = ausente ? CAMPOS_DE_CONTAGEM.filter(campo =>
    atual.campos.includes(campo) || local[campo] != null || outra?.[campo] != null) : atual.campos;
  const mostrarIdentidade = ausente || !atual.mesmaIdentidade;
  return (
    <EscolhaDoRegistro tipo="série" titulo={tituloDaLinha(local)} conta={conta} atual={atual}
      revisaoEscolhida={revisaoEscolhida} salvar={escolha => resolverConciliacaoDeContagem(conta, atual, escolha)}
      aoEscolher={aoEscolher}>
      {ausente ? (
        <p className="text-sm">O histórico está sem esta série. O backup mudou sua identificação. Confira o registro do backup antes de decidir.</p>
      ) : atual.mesmaIdentidade ? (
        <p className="text-muted-foreground text-sm">{contextoDaLinha(local)}</p>
      ) : (
        <p className="text-sm">A identificação ou a marcação desta série mudou no histórico. Confira os dois registros.</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2">
        <MedidasDaContagem origem="No aparelho" linha={local} campos={campos} mostrarIdentidade={mostrarIdentidade} mostrarProposta={ausente} />
        {outra ? <MedidasDaContagem origem={ausente ? "Série do backup" : "No histórico"} linha={outra} campos={campos}
          mostrarIdentidade={mostrarIdentidade} mostrarProposta={ausente} /> : ausente && (
          <div className="border-border rounded-md border p-2">
            <h4 className="font-medium">Série do backup</h4><p className="text-muted-foreground text-sm">Identificação indisponível.</p>
          </div>
        )}
      </div>
      {ausente && <p className="text-sm">{atual.permiteCriar
        ? "A nova série usará os valores mostrados em “Série do backup”."
        : "O backup tem dados insuficientes para criar esta série."}</p>}
      {!ausente && atual.mesmaIdentidade && campos.length > 1 && <p className="text-sm">A escolha vale para as {campos.length} contagens exibidas.</p>}
    </EscolhaDoRegistro>
  );
}

function CorrecaoDaSerie({ conta, atual, aoGuardar }: {
  conta: string; atual: ContagemPendente; aoGuardar: () => void;
}) {
  const id = useId();
  const cliente = useQueryClient();
  const [base, setBase] = useState(atual);
  const [digitados, setDigitados] = useState<Partial<Record<CampoContagem, string>>>({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const exercicio = base.exercicioId ? exercicioPorId.get(base.exercicioId) : undefined;
  const unilateral = base.unilateral || exercicio?.prescricao_padrao.unilateral;
  const tipo = base.tipo === "aquecimento" ? "Aquecimento" : "Série";
  const titulo = `${exercicio?.nome ?? base.exercicioId ?? "Exercício"} · ${tipo}${base.indice == null ? "" : ` ${base.indice}`}`;
  const horario = base.registradaEm ? Date.parse(base.registradaEm) : NaN;
  const mudou = atual.revisao !== base.revisao;
  const faltaValor = base.campos.some(c => c.posterior === null && lerInteiro(digitados[c.campo]) === null);

  const confirmar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (emCurso.current || mudou || faltaValor) return;
    emCurso.current = true;
    setSalvando(true);
    setErro("");
    try {
      const valores: Partial<Record<CampoContagem, number>> = {};
      for (const c of base.campos) {
        if (c.posterior === null) valores[c.campo] = lerInteiro(digitados[c.campo])!;
      }
      const correcoes = await confirmarContagemPendente(conta, base, valores);
      await confirmarContaDoTreino(conta, "A conta desta série mudou.");
      corrigirConsultasDaSerie(cliente, conta, base.sessaoId, base.serieId, correcoes);
      aoGuardar();
    } catch {
      setErro("Não foi possível confirmar a correção. Confira se a série mudou e tente de novo.");
    } finally {
      emCurso.current = false;
      setSalvando(false);
    }
  };

  return (
    <form aria-labelledby={id} onSubmit={evento => void confirmar(evento)} className="border-border flex flex-col gap-3 border-b py-4 last:border-0">
      <div>
        <h3 id={id} className="font-semibold wrap-anywhere">{titulo}</h3>
        <p className="text-muted-foreground text-sm">
          {Number.isFinite(horario) ? momento.format(horario) : `Treino ${base.sessaoId.slice(-8)}`}
          {base.ordemEx != null && ` · Exercício ${base.ordemEx}`}
        </p>
      </div>
      {base.campos.map(({ campo, fracionario, posterior }) => (
        <CampoInteiroRecusado key={campo} rotulo={rotuloDaContagem(campo, unilateral)} fracionario={fracionario}
          posterior={posterior ?? undefined} texto={digitados[campo] ?? ""} aoDigitar={valor => setDigitados({ ...digitados, [campo]: valor })}
          bloqueado={salvando || mudou} ajuda="Digite o valor desta série, sem casas decimais." />
      ))}
      {mudou ? (
        <>
          <p role="status" className="text-sm">A série mudou neste aparelho. Confira os valores atuais.</p>
          <Button type="button" variant="outline" className={`${acaoDaFolha} self-start`} onClick={() => { setBase(atual); setDigitados({}); setErro(""); }}>
            Rever valores
          </Button>
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

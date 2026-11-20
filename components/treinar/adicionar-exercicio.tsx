"use client";

import { Plus, Search, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { EquipamentoDeHoje, nomeDoMaterial, type MaterialDoTreino } from "@/components/exercicio/equipamento-de-hoje";
import { FiltroGrupoMuscular } from "@/components/exercicio/filtro-grupo-muscular";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Miniatura } from "@/components/ui/miniatura";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { equipamentosDaAlternativa } from "@/lib/alternativas";
import { filtrarExercicios, type FiltrosCatalogo } from "@/lib/catalogo";
import { acharExercicio, exerciciosComVariacoes } from "@/lib/dados";
import { evitado, evitadosPorUltimo } from "@/lib/preferencias";
import { MENSAGEM_EQUIPAMENTO_ALTERADO, MENSAGEM_INCLUSAO_ALTERADA } from "@/lib/queries/sessao";
import type { Exercicio } from "@/lib/schemas";
import { exerciciosOcupadosNaSessao, ultimaInclusaoDesfazivel, type SessaoLocal } from "@/lib/sessao";
import type { Prefs } from "@/lib/types";

export function AdicionarExercicio({ sessao, material, prefs, aoAdicionar, aoDesfazer }: {
  sessao: SessaoLocal;
  material: MaterialDoTreino;
  prefs: Prefs;
  aoAdicionar: (id: string) => Promise<void>;
  aoDesfazer: (idDaInclusao: string) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<FiltrosCatalogo["grupo"]>("todos");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroAoDesfazer, setErroAoDesfazer] = useState("");
  const [aviso, setAviso] = useState("");
  const emGravacao = useRef(false);
  const botaoAdicionar = useRef<HTMLButtonElement>(null);
  const inclusao = ultimaInclusaoDesfazivel(sessao);
  const ocupados = exerciciosOcupadosNaSessao(sessao);
  const opcoes = aberto ? evitadosPorUltimo(
    filtrarExercicios(exerciciosComVariacoes, { busca, grupo }).filter(e => !ocupados.has(e.id)),
    e => e.id, prefs,
  ).flatMap(exercicio => {
    const kits = equipamentosDaAlternativa(exercicio, material.disponiveis);
    if (!kits.length) return [];
    const equipamento = kits.map(kit => kit.length ? kit.map(nomeDoMaterial).join(" + ") : "Peso do corpo").join(" ou ");
    return [{ exercicio, equipamento }];
  }) : [];

  function mudarAberto(valor: boolean) {
    setAberto(valor);
    if (valor) {
      setBusca("");
      setGrupo("todos");
      setErro("");
      setErroAoDesfazer("");
      setAviso("");
    }
  }

  async function escolher(exercicio: Exercicio) {
    if (emGravacao.current) return;
    emGravacao.current = true;
    setSalvando(true);
    setErro("");
    try {
      await aoAdicionar(exercicio.id);
      setAberto(false);
      setAviso(`${exercicio.nome} entrou no fim do treino.`);
    } catch (falha) {
      setErro(falha instanceof Error && falha.message === MENSAGEM_EQUIPAMENTO_ALTERADO
        ? MENSAGEM_EQUIPAMENTO_ALTERADO : "Não foi possível adicionar o exercício. Tente de novo.");
    } finally {
      emGravacao.current = false;
      setSalvando(false);
    }
  }

  async function desfazer() {
    if (!inclusao || emGravacao.current) return;
    emGravacao.current = true;
    setSalvando(true);
    setErroAoDesfazer("");
    setAviso("");
    try {
      await aoDesfazer(inclusao.id);
      setAviso(`Inclusão de ${acharExercicio(inclusao.exercicio_id).nome} desfeita.`);
      botaoAdicionar.current?.focus();
    } catch (falha) {
      if (falha instanceof Error && falha.message === MENSAGEM_INCLUSAO_ALTERADA) {
        setErroAoDesfazer(MENSAGEM_INCLUSAO_ALTERADA);
        botaoAdicionar.current?.focus();
      } else {
        setErroAoDesfazer("Não foi possível desfazer a inclusão. Tente de novo.");
      }
    } finally {
      emGravacao.current = false;
      setSalvando(false);
    }
  }

  return (
    <div>
      <Sheet open={aberto} onOpenChange={mudarAberto}>
        <SheetTrigger asChild>
          <Button ref={botaoAdicionar} type="button" variant="outline" className="alvo w-full"
            aria-disabled={salvando} onClick={e => { if (emGravacao.current) e.preventDefault(); }}>
            <Plus aria-hidden="true" /> Adicionar exercício
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col overflow-y-auto pb-4 [&>*]:shrink-0">
          <SheetHeader className="pr-16 pb-0">
            <SheetTitle>Adicionar exercício</SheetTitle>
            <SheetDescription>Escolha um exercício para o fim deste treino.</SheetDescription>
          </SheetHeader>
          <div className="relative mx-4">
            <Search aria-hidden="true" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input type="search" inputMode="search" aria-label="Buscar exercício pelo nome"
              placeholder="Buscar exercício" value={busca} onChange={e => setBusca(e.target.value)}
              className="alvo h-12 pl-9 text-base" />
          </div>
          {erro && <p role="alert" className="text-destructive px-4 text-sm">{erro}</p>}
          {salvando && <p role="status" className="px-4 text-sm">Adicionando exercício…</p>}
          <div className="flex flex-col gap-2 px-4 pb-2">
            <FiltroGrupoMuscular grupo={grupo} aoMudar={setGrupo} />
            <EquipamentoDeHoje material={material} noSeletor />
            {opcoes.length ? (
              <ul aria-label="Exercícios disponíveis" className="divide-y">
                {opcoes.map(({ exercicio, equipamento }) => (
                  <li key={exercicio.id}>
                    <button type="button" aria-label={`Adicionar ${exercicio.nome}`}
                      aria-describedby={`detalhes-adicionar-${exercicio.id}`}
                      aria-disabled={salvando} onClick={() => void escolher(exercicio)}
                      className="alvo hover:bg-muted/40 flex w-full items-center gap-3 rounded-md py-2 text-left">
                      <Miniatura exercicioId={exercicio.id} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium">{exercicio.nome}</span>
                        <span id={`detalhes-adicionar-${exercicio.id}`} className="text-muted-foreground text-xs">
                          {exercicio.prescricao_padrao.texto} · {equipamento}
                          {evitado(prefs, exercicio.id) && <span className="mt-0.5 block">Você marcou como evitar.</span>}
                        </span>
                      </span>
                      <Plus aria-hidden="true" className="size-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-muted-foreground py-2 text-sm">
                {grupo !== "todos" ? "Nenhum exercício disponível para esse grupo com os filtros atuais. Escolha outro grupo ou ajuste a busca e o equipamento."
                  : busca.trim() ? "Nenhum exercício disponível com esse nome. Tente outra busca ou ajuste o equipamento."
                  : "Você já usou todos os exercícios disponíveis com esse equipamento neste treino."}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <p role="status" className="text-muted-foreground text-sm empty:hidden">{aviso}</p>
      {erroAoDesfazer && <p role="alert" className="text-destructive text-sm">{erroAoDesfazer}</p>}
      {inclusao && (
        <Button type="button" variant="ghost" aria-disabled={salvando} onClick={() => void desfazer()}
          className="alvo h-auto max-w-full justify-start py-2 text-left whitespace-normal">
          <Undo2 aria-hidden="true" /> Desfazer inclusão de {acharExercicio(inclusao.exercicio_id).nome}
        </Button>
      )}
    </div>
  );
}

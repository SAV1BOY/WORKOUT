"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Bookmark, Check, Plus, Search, SearchX, X } from "lucide-react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSessaoLivre } from "@/components/colecoes/usar-sessao-livre";
import { EquipamentoDeHoje, nomeDoMaterial } from "@/components/exercicio/equipamento-de-hoje";
import { OpcoesDeAlternativa, recolherExecucaoDaAlternativa } from "@/components/exercicio/seletor-alternativa";
import { EscolhidosDoPersonalizado } from "@/components/treino/escolhidos-do-personalizado";
import { OrdemDosEscolhidos } from "@/components/treino/ordem-dos-escolhidos";
import { SeriesDosEscolhidos, type EdicaoDosDescansos } from "@/components/treino/series-dos-escolhidos";
import { ConfirmacaoDoModelo, NomeDoTreino, TreinosSalvos, type PainelDosModelos } from "@/components/treino/treinos-salvos";
import { Button } from "@/components/ui/button";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Input } from "@/components/ui/input";
import { Miniatura } from "@/components/ui/miniatura";
import { Vazio } from "@/components/ui/vazio";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { equipamentosDaAlternativa } from "@/lib/alternativas";
import { filtrarExercicios } from "@/lib/catalogo";
import { acharExercicio, equipamentoDisponivel, exerciciosComVariacoes } from "@/lib/dados";
import { lerSelecaoDeEquipamento, tagsDoEquipamento } from "@/lib/equipamento-da-sessao";
import { ajustesDoModeloConfirmados } from "@/lib/modelo-de-treino";
import { mover } from "@/lib/ordem";
import { descansoPadraoS, evitadosPorUltimo } from "@/lib/preferencias";
import { excluirModeloDeTreino, salvarModeloDeTreino, type ModeloDeTreino } from "@/lib/queries/modelos-de-treino";
import { novoId } from "@/lib/queries/sessao";
import { desfazerTrocaNaMontagem, podeDesfazerTrocaNaMontagem, trocarEscolhido, type EscolhaNaMontagem, type TrocaNaMontagem } from "@/lib/troca-na-montagem";
import type { Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";

const inventarioCompleto = equipamentoDisponivel();
type Painel = { tipo: "editor" | "ordem" | "series" } | { tipo: "trocar"; id: string } | PainelDosModelos;

function mapaAlterado(atual: Record<string, number>, salvo: Record<string, number>) {
  return Object.keys(atual).length !== Object.keys(salvo).length
    || Object.entries(atual).some(([id, valor]) => valor !== salvo[id]);
}

function comAjuste(atual: Record<string, number>, id: string, valor?: number) {
  if (atual[id] === valor) return atual;
  const proximo = { ...atual };
  if (valor === undefined) delete proximo[id];
  else proximo[id] = valor;
  return proximo;
}

/**
 * Começa um treino livre com os movimentos do catálogo e suas variações,
 * na ordem escolhida antes de começar.
 */
export function Personalizar({ conta, prefs }: { conta: string; prefs?: Prefs }) {
  const cliente = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [seriesPorExercicio, setSeriesPorExercicio] = useState<Record<string, number>>({});
  const [descansosPorExercicio, setDescansosPorExercicio] = useState<Record<string, number>>({});
  const [ultimaTroca, setUltimaTroca] = useState<TrocaNaMontagem | null>(null);
  const [material, setMaterial] = useState(inventarioCompleto);
  const [tela, setTela] = useState<Painel>({ tipo: "editor" });
  const [carregado, setCarregado] = useState<ModeloDeTreino | null>(null);
  const [nome, setNome] = useState("");
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const gatilhoDaOrdem = useRef<HTMLButtonElement>(null);
  const gatilhoDasSeries = useRef<HTMLButtonElement>(null);
  const edicaoDosDescansos = useRef<EdicaoDosDescansos>(null);
  const gatilhoDosSalvos = useRef<HTMLButtonElement>(null);
  const gatilhoDeSalvar = useRef<HTMLButtonElement>(null);
  const gatilhoDaConfirmacao = useRef<HTMLButtonElement | null>(null);
  const iniciando = useRef(false);
  const mutando = useRef(false);
  const idDoEditor = useId();
  const focoAoAlternar = useRef<HTMLElement | string | null>(null);

  function idDoBotaoDeTroca(id: string) {
    return `${idDoEditor}-trocar-${id}`;
  }

  useLayoutEffect(() => {
    const foco = focoAoAlternar.current;
    if (!foco) return;
    focoAoAlternar.current = null;
    // O botão do substituto é montado no mesmo commit que retorna ao editor.
    const alvo = foco === "titulo" ? titulo.current : typeof foco === "string" ? document.getElementById(foco) : foco;
    (alvo?.isConnected ? alvo : titulo.current)?.focus();
  }, [tela]);

  function mostrar(proxima: Painel, foco?: HTMLElement | string | null) {
    focoAoAlternar.current = foco ?? "titulo";
    setErro(null);
    setTela(proxima);
  }

  function voltar() {
    if (mutando.current) return;
    switch (tela.tipo) {
      case "excluir":
      case "descartar":
        mostrar({ tipo: "salvos" }, gatilhoDaConfirmacao.current);
        break;
      case "trocar": mostrar({ tipo: "editor" }, idDoBotaoDeTroca(tela.id)); break;
      case "ordem": mostrar({ tipo: "editor" }, gatilhoDaOrdem.current); break;
      case "series":
        edicaoDosDescansos.current?.aplicarValidos();
        mostrar({ tipo: "editor" }, gatilhoDasSeries.current);
        break;
      case "salvos": mostrar({ tipo: "editor" }, gatilhoDosSalvos.current); break;
      case "salvar": mostrar({ tipo: "editor" }, gatilhoDeSalvar.current); break;
    }
  }

  const equipamentoPorExercicio = useMemo(() => {
    const disponiveis = new Map<string, string>();
    for (const e of exerciciosComVariacoes) {
      const kits = equipamentosDaAlternativa(e, material);
      if (!kits.length) continue;
      const montagem = material.size === inventarioCompleto.size ? e.equipamento_texto
        : kits.map(kit => kit.length ? kit.map(nomeDoMaterial).join(" + ") : "Peso do corpo").join(" ou ");
      disponiveis.set(e.id, montagem);
    }
    return disponiveis;
  }, [material]);

  const achados = useMemo(
    () =>
      evitadosPorUltimo(
        filtrarExercicios(exerciciosComVariacoes, { busca }).filter(e => equipamentoPorExercicio.has(e.id)),
        (e) => e.id,
        prefs,
      ),
    [busca, equipamentoPorExercicio, prefs],
  );

  // O modelo lê as cargas da conta ao iniciar. Só o avulso antecipa a consulta pela seleção.
  const { comecar, ocupado, pronto } = useSessaoLivre(carregado ? [] : escolhidos);
  const materialSalvo = lerSelecaoDeEquipamento(carregado?.equipamento_disponivel);
  const ordemSalva = carregado?.exercicios ?? [];
  const seriesAlteradas = mapaAlterado(seriesPorExercicio, carregado?.series_por_exercicio ?? {});
  const descansosAlterados = mapaAlterado(descansosPorExercicio, carregado?.descansos_por_exercicio ?? {});
  const alterado = seriesAlteradas || descansosAlterados || escolhidos.length !== ordemSalva.length || escolhidos.some((id, i) => id !== ordemSalva[i])
    || material.size !== materialSalvo.size || [...material].some(tag => !materialSalvo.has(tag));

  function carregar(modelo: ModeloDeTreino | null, destino: Painel = { tipo: "editor" }) {
    setCarregado(modelo);
    setUltimaTroca(null);
    setEscolhidos(modelo?.exercicios ?? []);
    setSeriesPorExercicio(modelo?.series_por_exercicio ?? {});
    setDescansosPorExercicio(modelo?.descansos_por_exercicio ?? {});
    setMaterial(lerSelecaoDeEquipamento(modelo?.equipamento_disponivel));
    setBusca("");
    mostrar(destino);
  }

  function escolher(modelo: ModeloDeTreino | null, gatilho: HTMLButtonElement) {
    if (!alterado) return carregar(modelo);
    gatilhoDaConfirmacao.current = gatilho;
    mostrar({ tipo: "descartar", proximo: modelo });
  }

  async function salvar() {
    if (tela.tipo !== "salvar" || mutando.current || !nome.trim() || !escolhidos.length) return;
    mutando.current = true;
    setGravando(true);
    setErro(null);
    const modelo: ModeloDeTreino = {
      id: tela.id, user_id: conta, nome: nome.trim(), exercicios: [...escolhidos],
      equipamento_disponivel: material.size === inventarioCompleto.size ? null : tagsDoEquipamento(material),
      ...(!carregado || seriesAlteradas ? {
        series_por_exercicio: Object.keys(seriesPorExercicio).length ? seriesPorExercicio : null,
      } : {}),
      ...(!carregado || descansosAlterados ? {
        descansos_por_exercicio: Object.keys(descansosPorExercicio).length ? descansosPorExercicio : null,
      } : {}),
    };
    try {
      const salvo = await salvarModeloDeTreino(cliente, modelo);
      if (!ajustesDoModeloConfirmados(salvo)) {
        // Outra aba com a versão antiga pode ter trocado a cópia enquanto o nome era editado.
        carregar(null, { tipo: "salvos" });
      } else {
        setCarregado(salvo);
        setSeriesPorExercicio(salvo.series_por_exercicio ?? {});
        setDescansosPorExercicio(salvo.descansos_por_exercicio ?? {});
        mostrar({ tipo: "editor" }, gatilhoDeSalvar.current);
      }
      toast.success(carregado ? "Treino atualizado." : "Treino salvo.");
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      mutando.current = false;
      setGravando(false);
    }
  }

  async function excluir(modelo: ModeloDeTreino) {
    if (mutando.current) return;
    mutando.current = true;
    setGravando(true);
    setErro(null);
    try {
      await excluirModeloDeTreino(cliente, conta, modelo.id);
      if (modelo.id === carregado?.id) setCarregado(null);
      mostrar({ tipo: "salvos" });
      toast.success("Treino excluído.");
    } catch {
      setErro("Não foi possível excluir. Tente novamente.");
    } finally {
      mutando.current = false;
      setGravando(false);
    }
  }

  function ajustarSeries(id: string, quantidade?: number) {
    setSeriesPorExercicio(atuais => comAjuste(atuais, id, quantidade));
  }

  function aplicarEscolha(escolha: EscolhaNaMontagem) {
    setEscolhidos(escolha.escolhidos);
    setSeriesPorExercicio(escolha.seriesPorExercicio);
    setDescansosPorExercicio(escolha.descansosPorExercicio);
  }

  function substituir(substituto: string) {
    if (tela.tipo !== "trocar") return;
    const resultado = trocarEscolhido({ escolhidos, seriesPorExercicio, descansosPorExercicio }, tela.id, substituto, material);
    if (!resultado) return;
    aplicarEscolha(resultado);
    setUltimaTroca(resultado.troca);
    mostrar({ tipo: "editor" }, idDoBotaoDeTroca(substituto));
  }

  function desfazerTroca() {
    if (!ultimaTroca) return;
    const resultado = desfazerTrocaNaMontagem({ escolhidos, seriesPorExercicio, descansosPorExercicio }, ultimaTroca);
    if (!resultado) return;
    aplicarEscolha(resultado);
    setUltimaTroca(null);
    mostrar({ tipo: "editor" }, idDoBotaoDeTroca(ultimaTroca.anterior));
  }

  function alternar(id: string) {
    if (id === ultimaTroca?.substituto) setUltimaTroca(null);
    ajustarSeries(id, undefined);
    setDescansosPorExercicio(atuais => comAjuste(atuais, id, undefined));
    setEscolhidos((atuais) =>
      atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
    );
  }

  function moverEscolhido(id: string, direcao: -1 | 1) {
    setEscolhidos(atuais => {
      const indice = atuais.indexOf(id);
      return mover(atuais, indice, indice + direcao);
    });
  }

  async function iniciar() {
    if (iniciando.current || ocupado || !pronto || escolhidos.length === 0) return;
    iniciando.current = true;
    try {
      await comecar(escolhidos, {
        titulo: carregado?.nome ?? "Treino personalizado",
        equipamentosDisponiveis: material,
        seriesPorExercicio,
        descansosPorExercicio,
        contaDoModelo: carregado?.user_id,
      });
    } finally {
      iniciando.current = false;
    }
  }

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (!v && (ocupado || mutando.current)) return;
        if (!v && tela.tipo === "series") edicaoDosDescansos.current?.aplicarValidos();
        setAberto(v);
        if (!v) {
          focoAoAlternar.current = null;
          if (tela.tipo !== "salvar") setTela({ tipo: "editor" });
          setBusca("");
        }
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          className="cartao border-border bg-card hover:bg-muted/40 alvo flex w-full items-center gap-3 border border-dashed px-4 py-4 text-left"
        >
          <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
            <Plus aria-hidden="true" className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">Personalizar treino</span>
            <span className="text-muted-foreground text-xs">
              Crie o seu próprio, com os exercícios que quiser.
            </span>
          </span>
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className={cn("flex max-h-[90dvh] flex-col pb-8",
        tela.tipo === "editor" && "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        (tela.tipo === "series" || tela.tipo === "trocar") && "overflow-y-auto")}
        showCloseButton={tela.tipo !== "editor" && !ocupado && !gravando}
        onEscapeKeyDown={evento => {
          if (tela.tipo === "trocar") {
            recolherExecucaoDaAlternativa(evento);
            if (evento.defaultPrevented) return;
          }
          if (tela.tipo !== "editor") {
            evento.preventDefault();
            voltar();
          }
        }}>
        {tela.tipo !== "editor" && <SheetHeader className="pb-0">
          <SheetTitle ref={titulo} className="pr-10 wrap-anywhere">
            {tela.tipo === "ordem" && "Reordenar escolhidos"}
            {tela.tipo === "series" && "Séries e descanso"}
            {tela.tipo === "trocar" && "Trocar exercício"}
            {tela.tipo === "salvos" && "Treinos salvos"}
            {tela.tipo === "salvar" && (carregado ? "Atualizar treino" : "Salvar treino")}
            {tela.tipo === "excluir" && "Excluir treino?"}
            {tela.tipo === "descartar" && "Descartar alterações?"}
          </SheetTitle>
          {tela.tipo === "ordem" && <SheetDescription>{escolhidos.length} exercícios no treino.</SheetDescription>}
          {tela.tipo === "trocar" && <SheetDescription className="wrap-anywhere">
            Escolha uma alternativa para {acharExercicio(tela.id).nome}.
          </SheetDescription>}
          {tela.tipo === "series" && <SheetDescription>O descanso vale para as séries de trabalho.</SheetDescription>}
          {tela.tipo === "salvos" && <SheetDescription>Escolha um treino para abrir no editor.</SheetDescription>}
          {tela.tipo === "salvar" && <SheetDescription>Guarde a seleção, a ordem, as séries, o descanso e os equipamentos para outro dia.</SheetDescription>}
        </SheetHeader>}

        {tela.tipo === "trocar" && (
          <div className="flex flex-none flex-col gap-3 px-4">
            <OpcoesDeAlternativa key={tela.id} exercicioId={tela.id} ocupados={escolhidos.filter(id => id !== tela.id)}
              material={{ disponiveis: material, aoMudar: setMaterial }} prefs={prefs} aoSubstituir={substituir} />
            <Button type="button" variant="outline" className="alvo h-auto self-start py-2" onClick={voltar}>Voltar</Button>
          </div>
        )}
        {tela.tipo === "ordem" && <OrdemDosEscolhidos ids={escolhidos} aoMover={moverEscolhido} aoFechar={voltar} />}
        {tela.tipo === "series" && <SeriesDosEscolhidos ref={edicaoDosDescansos} ids={escolhidos} ajustes={seriesPorExercicio}
          descansos={descansosPorExercicio} descansoDaConta={descansoPadraoS(prefs)} aoMudar={ajustarSeries}
          aoConfirmarDescansos={setDescansosPorExercicio} aoFechar={() => mostrar({ tipo: "editor" }, gatilhoDasSeries.current)} />}
        {(tela.tipo === "salvos" || tela.tipo === "excluir" || tela.tipo === "descartar") && (
          <TreinosSalvos conta={conta} oculto={tela.tipo !== "salvos"} aoVoltar={voltar} aoEscolher={escolher}
            aoExcluir={(modelo, gatilho) => {
              gatilhoDaConfirmacao.current = gatilho;
              mostrar({ tipo: "excluir", modelo });
            }} />
        )}
        {tela.tipo === "salvar" && <NomeDoTreino nome={nome} aoMudar={setNome} atualizando={!!carregado}
          gravando={gravando} erro={erro} aoSalvar={() => void salvar()} aoVoltar={voltar} />}
        {tela.tipo === "excluir" && <ConfirmacaoDoModelo gravando={gravando} erro={erro} aoCancelar={voltar}
          descricao={`“${tela.modelo.nome}” será removido dos seus treinos salvos.`}
          acao="Excluir treino" aoConfirmar={() => void excluir(tela.modelo)} />}
        {tela.tipo === "descartar" && <ConfirmacaoDoModelo gravando={false} erro={null} aoCancelar={voltar}
          descricao="A seleção atual tem alterações que ainda não foram salvas."
          acao="Descartar alterações" aoConfirmar={() => carregar(tela.proximo)} />}
        {/* Cabeçalho e catálogo rolam juntos. O rodapé tem seu próprio espaço e não encobre o controle focado. */}
        <div className={cn("flex min-h-0 flex-1 flex-col gap-2 px-4", tela.tipo !== "editor" && "hidden")}>
          <div className="min-h-0 overflow-y-auto px-1">
            {tela.tipo === "editor" && (
              <SheetHeader className="relative px-0 pt-4 pb-3">
                <SheetTitle ref={titulo} className="pr-12 wrap-anywhere">Crie o seu próprio</SheetTitle>
                <SheetDescription className="mt-2">
                  {carregado ? <strong className="text-foreground wrap-anywhere">{carregado.nome}</strong>
                    : "Escolha os exercícios, a ordem, as séries e o descanso. As cargas seguem a sua progressão."}
                </SheetDescription>
                {!ocupado && <SheetClose asChild>
                  <Button type="button" variant="ghost" size="icon-sm" className="alvo absolute top-3 right-0" aria-label="Fechar">
                    <X aria-hidden="true" />
                  </Button>
                </SheetClose>}
              </SheetHeader>
            )}
            <div className="mb-3 flex flex-wrap gap-2">
              <Button ref={gatilhoDosSalvos} type="button" variant="outline" disabled={ocupado}
                className="alvo h-auto max-w-full whitespace-normal py-2" onClick={() => mostrar({ tipo: "salvos" })}>
                <Bookmark aria-hidden="true" /> Treinos salvos
              </Button>
              {escolhidos.length > 0 && (
                <Button ref={gatilhoDeSalvar} type="button" variant="outline" disabled={ocupado}
                  className="alvo h-auto max-w-full whitespace-normal py-2" onClick={() => {
                    setNome(carregado?.nome ?? "");
                    mostrar({ tipo: "salvar", id: carregado?.id ?? novoId() });
                  }}>
                  {carregado ? "Atualizar treino" : "Salvar treino"}
                </Button>
              )}
            </div>
            <div className="relative flex items-center gap-1">
              {!busca && <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />}
              <Input
                ref={campoBusca}
                type="search"
                inputMode="search"
                value={busca}
                disabled={ocupado}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar exercício"
                aria-label="Buscar exercício pelo nome"
                className={cn("alvo h-12 min-w-0 flex-1 text-base [&::-webkit-search-cancel-button]:appearance-none", busca ? "px-2" : "pl-9")}
              />
              {busca && (
                <Button type="button" size="icon" variant="ghost" aria-label="Limpar busca" disabled={ocupado}
                  className="alvo w-[max(44px,2rem)] shrink-0" onClick={() => { setBusca(""); campoBusca.current?.focus(); }}>
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="mt-3">
              <EquipamentoDeHoje material={{ disponiveis: material, aoMudar: setMaterial }} noSeletor
                desabilitado={ocupado} descricao="O catálogo mostra os exercícios que você pode fazer com o material marcado." />
            </div>

            {escolhidos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button ref={gatilhoDasSeries} type="button" variant="outline" disabled={ocupado}
                  className="alvo h-auto max-w-full whitespace-normal py-2" onClick={() => mostrar({ tipo: "series" })}>
                  Séries e descanso
                </Button>
                {escolhidos.length >= 2 && (
                  <Button ref={gatilhoDaOrdem} type="button" variant="outline" disabled={ocupado}
                    className="alvo h-auto max-w-full whitespace-normal py-2" onClick={() => mostrar({ tipo: "ordem" })}>
                    <ArrowUpDown aria-hidden="true" className="size-4 shrink-0" />
                    Reordenar escolhidos
                  </Button>
                )}
              </div>
            )}
            {escolhidos.length > 0 && (
              <EscolhidosDoPersonalizado ids={escolhidos} series={seriesPorExercicio} descansos={descansosPorExercicio}
                equipamento={equipamentoPorExercicio} ocupado={ocupado} idDoBotaoDeTroca={idDoBotaoDeTroca}
                aoTirar={alternar} aoTrocar={id => mostrar({ tipo: "trocar", id })} />
            )}
            {ultimaTroca && podeDesfazerTrocaNaMontagem(escolhidos, ultimaTroca) && (
              <Button type="button" variant="outline" disabled={ocupado} className="alvo mt-2 h-auto max-w-full whitespace-normal py-2"
                onClick={desfazerTroca}>Desfazer troca</Button>
            )}

            <ul
              aria-label="Catálogo"
              className="@container mt-3 divide-y"
            >
              {achados.map((e) => {
                const marcado = escolhidos.includes(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-pressed={marcado}
                      disabled={ocupado}
                      onClick={() => alternar(e.id)}
                      className="hover:bg-muted/40 alvo grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-2 text-left @2xs:flex @2xs:gap-3"
                    >
                      <Miniatura exercicioId={e.id} className="col-start-1 row-start-2 size-11 @2xs:size-14" />
                      <span className="col-span-full row-start-1 flex min-w-0 flex-1 flex-col gap-0.5 wrap-anywhere">
                        <span className="text-sm font-medium text-balance">{e.nome}</span>
                        <span className="numero text-muted-foreground text-xs">
                          {e.prescricao_padrao.texto} · {equipamentoPorExercicio.get(e.id)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "col-start-2 row-start-2 flex size-6 shrink-0 items-center justify-center rounded-full border",
                          marcado
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {marcado ? (
                          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
              {achados.length === 0 ? (
                <li>
                  <Vazio
                    icone={SearchX}
                    titulo="Nenhum exercício com os filtros atuais"
                    frase="Tente outro nome ou ajuste os equipamentos disponíveis."
                    className="border-0"
                  />
                </li>
              ) : null}
            </ul>
          </div>

          <BotaoLargo
            className="h-auto min-h-14 shrink-0 px-2 py-2 whitespace-normal"
            disabled={!pronto || ocupado || escolhidos.length === 0}
            onClick={() => void iniciar()}
          >
            {/* SPEC §22.7 item 8: "Começar com 3 exercícios", não "Começar (3)" */}
            {ocupado
              ? "Começando…"
              : escolhidos.length === 0
                ? "Escolha os exercícios"
                : `Começar com ${escolhidos.length} ${
                    escolhidos.length === 1 ? "exercício" : "exercícios"
                  }`}
          </BotaoLargo>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { FilterX, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FILTROS_VAZIOS,
  NOME_EQUIPAMENTO,
  rotuloDoImplemento,
  chipsDosFiltros,
  filtrarExercicios,
  idsDoPrograma,
  opcoesDoCatalogo,
  quantosFiltrosLigados,
  rotuloDoVerResultados,
  semFiltrosDaFolha,
  semOFiltro,
  temFiltro,
  type FiltrosCatalogo,
} from "@/lib/catalogo";
import { Miniatura } from "@/components/ui/miniatura";
import { Vazio } from "@/components/ui/vazio";
import { exercicios } from "@/lib/dados";
import { evitado, evitadosPorUltimo } from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";
import type { EquipamentoTag, Exercicio, Grupo, Implemento } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * O catálogo dos 81 exercícios (SPEC §3.6): busca sem acento e filtros por
 * grupo, equipamento, implemento e "está no meu programa".
 *
 * O conteúdo vem de `data/exercicios.json` (nada é escrito aqui) e a filtragem
 * é de `lib/catalogo.ts`, que os testes cobrem.
 */
/**
 * Quantos cartões entram de uma vez (SPEC §22.9 item 2). Os 81 de uma tacada
 * eram 81 `<img>` e 1.146 kB numa tela só.
 */
export const POR_PAGINA = 20;

export function ListaExercicios({
  busca,
  limite,
  filtros: filtrosDeFora,
  aoMudarFiltros,
}: {
  /**
   * Busca vinda de fora (a barra única do Explorar, SPEC §14.4). Quando vem,
   * a caixa daqui some: duas buscas na mesma tela confundem.
   */
  busca?: string;
  /**
   * Prévia de N cartões, sem paginação nem "Ver mais" (SPEC §22.9 item 1):
   * é assim que a vitrine do Explorar mostra o catálogo sem virar catálogo.
   */
  limite?: number;
  /**
   * Filtros controlados de fora (SPEC §22.9 item 10). Quem escreve a contagem
   * num título acima desta lista — o Explorar — precisa filtrar com os MESMOS
   * valores que ela; com o estado só aqui dentro, o título dizia 6 enquanto a
   * lista mostrava 0. Vem sempre em par com `aoMudarFiltros`; sem os dois, o
   * estado continua sendo local.
   */
  filtros?: FiltrosCatalogo;
  aoMudarFiltros?: (filtros: FiltrosCatalogo) => void;
} = {}) {
  const [filtrosLocais, setFiltrosLocais] = useState<FiltrosCatalogo>(FILTROS_VAZIOS);
  const filtros = filtrosDeFora ?? filtrosLocais;
  const aplicar = (proximos: FiltrosCatalogo) => {
    if (filtrosDeFora !== undefined) aoMudarFiltros?.(proximos);
    else setFiltrosLocais(proximos);
  };
  const deFora = busca !== undefined;
  const doPrograma = useMemo(() => idsDoPrograma(), []);
  const opcoes = useMemo(() => opcoesDoCatalogo(exercicios), []);
  const prefs = usePerfil().data?.prefs;
  // SPEC §14.1.2: o que foi marcado como "não gosto" aparece por último
  const usados = useMemo(
    () => (deFora ? { ...filtros, busca: busca ?? "" } : filtros),
    [deFora, filtros, busca],
  );
  const achados = useMemo(
    () => evitadosPorUltimo(filtrarExercicios(exercicios, usados, doPrograma), (e) => e.id, prefs),
    [usados, doPrograma, prefs],
  );

  /*
   * A página volta ao começo sozinha quando a busca ou um filtro muda: o
   * estado guarda a chave do que estava valendo quando o "Ver mais" foi
   * tocado, e uma chave diferente já nasce mostrando os 20 primeiros. Sem
   * `useEffect`: nada pisca e nada renderiza duas vezes.
   */
  const chave = JSON.stringify(usados);
  const [pagina, setPagina] = useState({ chave, quantos: POR_PAGINA });
  const quantos = limite ?? (pagina.chave === chave ? pagina.quantos : POR_PAGINA);
  const mostrados = achados.slice(0, quantos);
  const faltam = achados.length - mostrados.length;

  /*
   * SPEC §22.12 item 1: os filtros moram numa folha inferior. Na tela ficam só
   * a busca, o botão "Filtros" (com quantos estão ligados) e os chips do que
   * está ligado — o primeiro exercício cabe na primeira tela a 360×740.
   */
  const [folhaAberta, setFolhaAberta] = useState(false);
  const ligados = quantosFiltrosLigados(filtros);
  const chips = chipsDosFiltros(filtros);
  const comControles = limite === undefined;
  /** O CTA "Ver N exercícios" fecha a folha e leva ao primeiro resultado. */
  const irAoResultado = useRef(false);
  const refPrimeiro = useRef<HTMLLIElement>(null);

  const mudar = (parte: Partial<FiltrosCatalogo>) => aplicar({ ...filtros, ...parte });

  return (
    <div className="flex flex-col gap-3">
      {deFora || limite !== undefined ? null : (
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          inputMode="search"
          value={filtros.busca}
          onChange={(e) => mudar({ busca: e.target.value })}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício pelo nome"
          className="alvo h-12 pl-9 text-base"
        />
        {filtros.busca ? (
          <button
            type="button"
            onClick={() => mudar({ busca: "" })}
            aria-label="Limpar a busca"
            className="alvo text-muted-foreground absolute top-1/2 right-0 flex -translate-y-1/2 items-center justify-center"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      )}

      {comControles ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Sheet open={folhaAberta} onOpenChange={setFolhaAberta}>
              {/*
                O gatilho é do Radix: `aria-haspopup`, `aria-expanded` e
                `aria-controls` saem geridos por ele (SPEC §22.12 item 1).
              */}
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="alvo">
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  Filtros
                  {ligados > 0 ? (
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-micro"
                      data-filtros-ligados={ligados}
                    >
                      {ligados}
                    </Badge>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="pb-segura max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl"
                onCloseAutoFocus={() => {
                  if (!irAoResultado.current) return;
                  irAoResultado.current = false;
                  // o foco volta ao gatilho (Radix); a lista mostra o primeiro
                  requestAnimationFrame(() =>
                    refPrimeiro.current?.scrollIntoView({ block: "nearest" }),
                  );
                }}
              >
                <SheetHeader className="pr-16">
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>
                    Grupo, implemento, equipamento e o que está no seu programa.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 px-4">
                  {/*
                    SPEC §22.17 item 1: "Barra maciça (principal)" não cabe na
                    meia largura a 360 px — um seletor por linha.
                  */}
                  <div className="grid grid-cols-1 gap-2">
                    <Selecao
                      rotulo="Grupo"
                      valor={filtros.grupo}
                      aoMudar={(v) => mudar({ grupo: v as Grupo | "todos" })}
                      opcoes={opcoes.grupos.map((g) => ({ valor: g, nome: g }))}
                    />
                    <Selecao
                      rotulo="Implemento"
                      valor={filtros.implemento}
                      aoMudar={(v) => mudar({ implemento: v as Implemento | "todos" })}
                      opcoes={opcoes.implementos.map((i) => ({
                        valor: i,
                        nome: rotuloDoImplemento(i),
                      }))}
                    />
                    <Selecao
                      rotulo="Equipamento"
                      valor={filtros.equipamento}
                      aoMudar={(v) => mudar({ equipamento: v as EquipamentoTag | "todos" })}
                      opcoes={opcoes.equipamentos.map((e) => ({
                        valor: e,
                        nome: NOME_EQUIPAMENTO[e],
                      }))}
                    />
                  </div>
                  {/* chip de alternância, não botão de largura inteira */}
                  <button
                    type="button"
                    aria-pressed={filtros.soPrograma}
                    onClick={() => mudar({ soPrograma: !filtros.soPrograma })}
                    className={cn(
                      "alvo foco self-start rounded-full border px-4 text-sm font-medium transition-colors",
                      filtros.soPrograma
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent",
                    )}
                  >
                    No meu programa
                  </button>
                </div>
                <SheetFooter className="flex-row items-center gap-2">
                  {ligados > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="alvo"
                      onClick={() => aplicar(semFiltrosDaFolha(filtros))}
                    >
                      Limpar
                    </Button>
                  ) : null}
                  <SheetClose asChild>
                    <Button
                      type="button"
                      className="alvo h-12 flex-1 text-base"
                      data-ver-resultados={achados.length}
                      onClick={() => {
                        irAoResultado.current = true;
                      }}
                    >
                      {rotuloDoVerResultados(achados.length)}
                    </Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            {/*
              SPEC §22.9 item 10: com a busca vinda do Explorar, o título da
              seção logo acima («Exercícios (6)») já é o contador. No catálogo
              ele fica na mesma linha do "Filtros", para não gastar altura.
            */}
            {deFora ? null : (
              <p
                className="text-muted-foreground text-xs"
                aria-live="polite"
                data-contador
              >
                {achados.length === exercicios.length
                  ? `${exercicios.length} exercícios`
                  : `${achados.length} de ${exercicios.length} exercícios`}
              </p>
            )}
          </div>
          {chips.length > 0 ? (
            <ul aria-label="Filtros ligados" className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c.chave}>
                  <button
                    type="button"
                    onClick={() => aplicar(semOFiltro(filtros, c.chave))}
                    aria-label={`Tirar o filtro ${c.rotulo}`}
                    data-chip={c.chave}
                    className="alvo foco border-border bg-secondary text-secondary-foreground hover:bg-accent flex items-center gap-1 rounded-full border pr-2 pl-3 text-sm"
                  >
                    {c.rotulo}
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {achados.length === 0 ? (
        /*
          SPEC §22.9 item 4: a mensagem de filtro só quando há mesmo filtro
          AQUI. Com a busca vinda do Explorar e nada marcado, quem fala é o
          vazio de lá — este some, para a tela não empilhar duas mensagens, a
          segunda delas mentindo sobre filtros que ninguém pôs.
        */
        temFiltro(filtros) ? (
          <Vazio
            icone={FilterX}
            titulo="Nenhum exercício com esses filtros"
            frase="Solte um filtro de cada vez para ver o que volta."
            acao={{ rotulo: "Limpar filtros", aoTocar: () => aplicar(FILTROS_VAZIOS) }}
          />
        ) : null
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Exercícios">
            {mostrados.map((e, i) => (
              <li key={e.id} ref={i === 0 ? refPrimeiro : undefined}>
                <CardDoExercicio
                  exercicio={e}
                  noPrograma={doPrograma.has(e.id)}
                  evitar={evitado(prefs, e.id)}
                />
              </li>
            ))}
          </ul>
          {limite === undefined && faltam > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="alvo w-full"
              onClick={() =>
                setPagina({ chave, quantos: quantos + POR_PAGINA })
              }
            >
              Ver mais {Math.min(POR_PAGINA, faltam)} de {achados.length}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function Selecao({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  className,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: { valor: string; nome: string }[];
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-muted-foreground text-rotulo tracking-wide uppercase">
        {rotulo}
      </span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="alvo border-input bg-background h-11 rounded-md border px-2 text-sm"
      >
        <option value="todos">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

function CardDoExercicio({
  exercicio,
  noPrograma,
  evitar,
}: {
  exercicio: Exercicio;
  noPrograma: boolean;
  evitar: boolean;
}) {
  return (
    <Link
      href={`/exercicios/${exercicio.id}`}
      /*
        SPEC §22.3 item 11: a linha do grupo e do equipamento é cortada em
        duas pelo `line-clamp`; o texto inteiro fica no `title` do link. Sem
        `aria-label`: ele apagaria os selos ("no programa", "evitar") do nome
        acessível, que hoje saem do próprio conteúdo.
      */
      title={`${exercicio.nome} · ${exercicio.grupo} · ${exercicio.equipamento_texto}`}
      className="alvo border-border bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-2 transition-colors"
    >
      {/* marco Mídia: a ilustração vem na frente da figura e da foto */}
      <Miniatura exercicioId={exercicio.id} className="rounded-lg" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm leading-tight font-medium text-balance">
          {exercicio.nome}
        </span>
        <span className="text-muted-foreground line-clamp-2 text-xs">
          {exercicio.grupo} · {exercicio.equipamento_texto}
        </span>
        <span className="flex items-center gap-2">
          <span className="numero text-xs">{exercicio.prescricao_padrao.texto}</span>
          {noPrograma ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-micro">
              no programa
            </Badge>
          ) : null}
          {evitar ? (
            <Badge variant="outline" className="px-1.5 py-0 text-micro">
              você marcou como evitar
            </Badge>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

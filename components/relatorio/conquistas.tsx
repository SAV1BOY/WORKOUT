"use client";

import {
  CalendarCheck,
  ChevronsUp,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Route,
  Timer,
  Trophy,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TOTAL_DE_CONQUISTAS,
  totalConquistado,
  type ConquistaAvaliada,
  type IconeDaConquista,
} from "@/lib/conquistas";
import { Vazio } from "@/components/ui/vazio";
import {
  formatarData,
  formatarDataCompleta,
  formatarNumero,
  formatarPercentual,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

/** O ícone lucide de cada conquista (a lib guarda só o nome, SPEC §19.3). */
const ICONE: Record<IconeDaConquista, LucideIcon> = {
  CalendarCheck,
  ChevronsUp,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Route,
  Timer,
  Trophy,
  Weight,
  Zap,
};

export function IconeDaCelula({
  nome,
  className,
}: {
  nome: IconeDaConquista;
  className?: string;
}) {
  const Icone = ICONE[nome];
  return <Icone aria-hidden="true" className={className} />;
}

/**
 * "Conquistas" (SPEC §19.4 e §22.6 itens 4 e 5): barra de progresso, dois
 * grupos rotulados — Conquistadas e A conquistar — e uma grade de **duas**
 * colunas a 360 px, com a data quando fechou e o que falta quando não. O
 * toque abre a folha com a regra.
 */
export function Conquistas({ lista }: { lista: ConquistaAvaliada[] }) {
  const [aberta, setAberta] = useState<ConquistaAvaliada | null>(null);
  const feitas = totalConquistado(lista);
  const pct = Math.round((feitas / TOTAL_DE_CONQUISTAS) * 100);

  /* SPEC §22.6 item 5: dá para ver quantas faltam sem contar cartão a cartão */
  const conquistadas = lista.filter((c) => c.atingida);
  const aConquistar = lista.filter((c) => !c.atingida);

  return (
    <section aria-label="Conquistas" className="flex flex-col gap-3">
      {/*
        A barra fina de progresso: o mesmo par "N de 26" do cabeçalho da
        seção, agora como forma, não só como número.
      */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="numero text-sm">
            <span className="font-semibold">{formatarNumero(feitas)}</span> de{" "}
            {formatarNumero(TOTAL_DE_CONQUISTAS)}
          </p>
          <p className="numero text-muted-foreground text-xs">
            {formatarPercentual(pct)}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Conquistas fechadas"
          aria-valuemin={0}
          aria-valuemax={TOTAL_DE_CONQUISTAS}
          aria-valuenow={feitas}
          aria-valuetext={`${formatarNumero(feitas)} de ${formatarNumero(TOTAL_DE_CONQUISTAS)}`}
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        >
          <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/*
        SPEC §22.3 item 9: sem avaliação na mão (conta nova, leitura que
        falhou) a seção ficava como um título solto sobre o nada.
      */}
      {lista.length === 0 ? (
        <Vazio
          icone={Trophy}
          titulo="Nenhuma conquista avaliada ainda"
          frase="Elas saem dos seus registros: conclua um treino e a contagem começa."
          acao={{ rotulo: "Ver o treino de hoje", href: "/" }}
        />
      ) : null}

      <Grupo
        rotulo="Conquistadas"
        lista={conquistadas}
        vazio="Nenhuma ainda — a primeira fecha com o primeiro treino."
        aoAbrir={setAberta}
      />
      <Grupo
        rotulo="A conquistar"
        lista={aConquistar}
        vazio="Todas fechadas. Não sobrou nenhuma."
        aoAbrir={setAberta}
      />

      <Sheet open={aberta !== null} onOpenChange={(v) => !v && setAberta(null)}>
        <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto pb-6">
          {aberta ? <Detalhe conquista={aberta} /> : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

/**
 * Um grupo da grade (SPEC §22.6 itens 4 e 5). A 360 px são **duas** colunas:
 * com três o cartão ficava com ~100 px e o nome quebrava em três linhas. A
 * altura é travada — nome e legenda com `line-clamp`, o texto inteiro no
 * `title` (§22.3 item 11) —, então todas as linhas medem igual.
 */
function Grupo({
  rotulo,
  lista,
  vazio,
  aoAbrir,
}: {
  rotulo: string;
  lista: ConquistaAvaliada[];
  vazio: string;
  aoAbrir: (c: ConquistaAvaliada) => void;
}) {
  return (
    <div data-grupo={rotulo} className="flex flex-col gap-1.5">
      <h3 className="text-muted-foreground text-rotulo font-medium tracking-wide uppercase">
        {rotulo} · {formatarNumero(lista.length)}
      </h3>
      {lista.length === 0 ? (
        <p className="text-muted-foreground text-xs">{vazio}</p>
      ) : (
        <ul
          aria-label={rotulo}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {lista.map((c) => {
            const legenda = (c.atingida && c.em ? formatarData(c.em) : c.falta) ?? "";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-conquista={c.id}
                  data-atingida={c.atingida ? "sim" : "nao"}
                  aria-pressed={c.atingida}
                  aria-label={`${c.nome}${legenda ? ` · ${legenda}` : ""}`}
                  onClick={() => aoAbrir(c)}
                  className={cn(
                    "cartao alvo grid h-full w-full grid-rows-[auto_1fr_auto] justify-items-center gap-1 border px-1.5 py-2 text-center",
                    c.atingida
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      c.atingida
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <IconeDaCelula nome={c.icone} className="size-4" />
                  </span>
                  <span
                    title={c.nome}
                    className={cn(
                      "text-rotulo line-clamp-2 leading-tight font-medium text-balance",
                      c.atingida ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {c.nome}
                  </span>
                  <span
                    title={legenda}
                    className={cn(
                      "text-micro line-clamp-1 leading-tight",
                      c.atingida ? "numero text-primary" : "text-muted-foreground",
                    )}
                  >
                    {legenda}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detalhe({ conquista: c }: { conquista: ConquistaAvaliada }) {
  return (
    <>
      <SheetHeader className="pb-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              c.atingida
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <IconeDaCelula nome={c.icone} className="size-5" />
          </span>
          <SheetTitle>{c.nome}</SheetTitle>
        </div>
        <SheetDescription className="pt-1">{c.descricao}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-2 px-4">
        <p className="border-border text-muted-foreground rounded-xl border border-dashed px-3 py-2 text-xs">
          <span className="text-foreground font-medium">Como fecha:</span> {c.regra}
        </p>
        {c.atingida && c.em ? (
          <p className="numero text-primary text-sm">
            Conquistada em {formatarDataCompleta(c.em)}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            <span className="numero text-foreground">
              {formatarNumero(c.atual)} de {formatarNumero(c.alvo)}
            </span>
            {c.falta ? ` · ${c.falta}` : ""}
          </p>
        )}
      </div>
    </>
  );
}

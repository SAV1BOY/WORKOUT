"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { AjustesDoTreino } from "@/components/mais/ajustes-do-treino";
import { CabecalhoMais } from "@/components/mais/cabecalho";
import { DiasDeTreino } from "@/components/mais/dias-de-treino";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acharExercicio, acharFase, acharTreino } from "@/lib/dados";
import { formatarKg, formatarNumero, lerNumero } from "@/lib/formato";
import {
  TEMAS,
  comTema,
  temaDasPrefs,
  temaDoNextThemes,
  type TemaPref,
} from "@/lib/preferencias";
import { comMetaSemanal, metaSemanal, metaSemanalPadrao } from "@/lib/metas";
import { incrementoDe, type EstadoExercicio } from "@/lib/progressao";
import { estadosPorExercicio } from "@/lib/hoje";
import { useEstados, usePerfil } from "@/lib/queries/dados";
import { salvarIncremento, salvarPrefs } from "@/lib/queries/mais";
import type { Exercicio } from "@/lib/schemas";
import type { LinhaPerfil } from "@/lib/types";

/** `/mais/preferencias` (SPEC §3.9). */
export function TelaPreferencias({ userId }: { userId: string }) {
  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;

  if (perfilQ.isError) {
    return (
      <Tela>
        <Erro
          mensagem={(perfilQ.error as Error).message}
          aoTentarDeNovo={() => void perfilQ.refetch()}
        />
      </Tela>
    );
  }

  if (!perfil) {
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Tema userId={userId} perfil={perfil} />
      <DiasDeTreino userId={userId} perfil={perfil} />
      <MetaSemanal userId={userId} perfil={perfil} />
      <Treino userId={userId} perfil={perfil} />
      <Incrementos userId={userId} perfil={perfil} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créditos das imagens</CardTitle>
          <CardDescription>
            Autor, licença e link de cada ilustração e do mapa muscular (SPEC §15).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/mais/creditos"
            className="alvo border-border bg-card hover:bg-accent flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium"
          >
            Ver os créditos
            <span aria-hidden="true">→</span>
          </Link>
        </CardContent>
      </Card>
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <CabecalhoMais
        titulo="Preferências"
        descricao="Como o app se comporta no treino."
      />
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- tema */

function Tema({ userId, perfil }: { userId: string; perfil: LinhaPerfil }) {
  const cliente = useQueryClient();
  const { setTheme } = useTheme();
  const atual = temaDasPrefs(perfil.prefs);
  const [salvando, setSalvando] = useState<TemaPref | null>(null);

  const escolher = async (tema: TemaPref) => {
    // o tema muda na hora; a preferência sobe pela fila (§8)
    setTheme(temaDoNextThemes(tema));
    setSalvando(tema);
    try {
      await salvarPrefs({ userId, prefs: comTema(perfil.prefs, tema), cliente });
    } catch {
      toast.error("O tema mudou aqui, mas não consegui salvar.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Card id="tema" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-base">Tema</CardTitle>
        <CardDescription>
          Automático segue o celular. O escuro é preto de verdade, para ler no
          sol.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="group"
          aria-label="Tema"
          className="grid grid-cols-3 gap-2"
        >
          {TEMAS.map(({ valor, rotulo }) => (
            <Button
              key={valor}
              variant={atual === valor ? "default" : "outline"}
              aria-pressed={atual === valor}
              className="alvo h-12"
              disabled={salvando !== null}
              onClick={() => void escolher(valor)}
            >
              {rotulo}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------- meta semanal (SPEC §13.7) */

function MetaSemanal({ userId, perfil }: { userId: string; perfil: LinhaPerfil }) {
  const cliente = useQueryClient();
  const padrao = metaSemanalPadrao(perfil.fase_atual, perfil.prefs);
  const atual = metaSemanal(perfil.prefs, perfil.fase_atual);
  const escolhida = perfil.prefs?.meta_semanal;
  const [texto, setTexto] = useState(
    typeof escolhida === "number" ? String(escolhida) : "",
  );
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const limpo = texto.trim();
    const n = limpo === "" ? null : lerNumero(limpo);
    if (limpo !== "" && (n === null || !Number.isInteger(n) || n < 1)) {
      toast.error("Digite quantas sessões por semana, por exemplo 5.");
      return;
    }
    setSalvando(true);
    try {
      await salvarPrefs({
        userId,
        prefs: comMetaSemanal(perfil.prefs, n),
        cliente,
      });
      toast.success(
        n === null
          ? `Meta semanal: de volta ao padrão da fase (${padrao}).`
          : `Meta semanal: ${n} ${n === 1 ? "sessão" : "sessões"}.`,
      );
    } catch {
      toast.error("Não consegui salvar agora.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card id="meta" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-base">Meta semanal</CardTitle>
        <CardDescription>
          Quantas sessões (força + cardio) contam como semana cumprida na aba
          Treino. Vazio = o padrão da fase ({padrao}).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="meta-semanal">Sessões por semana</Label>
          <p className="text-muted-foreground text-xs">
            usando {atual} por semana
          </p>
        </div>
        <Input
          id="meta-semanal"
          type="text"
          inputMode="numeric"
          placeholder={String(padrao)}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="alvo numero h-12 w-20"
        />
        <Button
          variant="outline"
          className="alvo h-12"
          aria-label="Salvar meta semanal"
          disabled={salvando}
          onClick={() => void salvar()}
        >
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------- treino e player (SPEC §14.4) */

function Treino({ userId, perfil }: { userId: string; perfil: LinhaPerfil }) {
  return (
    <Card id="treino" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-base">Treino</CardTitle>
        <CardDescription>
          Como o player se comporta: preparação, descanso, avisos e tela.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AjustesDoTreino userId={userId} perfil={perfil} />
      </CardContent>
    </Card>
  );
}

/* --------------------------------- incremento por exercício (§6.2) */

/** Só exercícios com carga têm incremento em kg para ajustar. */
function exerciciosComCarga(faseId: LinhaPerfil["fase_atual"]): Exercicio[] {
  const ids = new Set<string>();
  for (const treinoId of acharFase(faseId).treinos) {
    for (const item of acharTreino(treinoId).exercicios) ids.add(item.exercicio_id);
  }
  return [...ids]
    .map((id) => acharExercicio(id))
    .filter((e) => e.progressao.tipo === "carga")
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function Incrementos({
  userId,
  perfil,
}: {
  userId: string;
  perfil: LinhaPerfil;
}) {
  const exercicios = useMemo(
    () => exerciciosComCarga(perfil.fase_atual),
    [perfil.fase_atual],
  );
  const ids = useMemo(() => exercicios.map((e) => e.id), [exercicios]);
  const estadosQ = useEstados(ids);
  const estados = estadosPorExercicio(estadosQ.data ?? []);

  return (
    <Card id="incrementos" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-base">Incremento por exercício</CardTitle>
        <CardDescription>
          Quanto a carga sobe quando o treino fecha no topo da faixa. Vazio =
          o valor do programa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {exercicios.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum exercício com carga nesta fase.
          </p>
        ) : (
          exercicios.map((exercicio) => (
            <LinhaDoIncremento
              key={exercicio.id}
              exercicio={exercicio}
              estado={estados[exercicio.id] ?? null}
              userId={userId}
              ids={ids}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function LinhaDoIncremento({
  exercicio,
  estado,
  userId,
  ids,
}: {
  exercicio: Exercicio;
  estado: EstadoExercicio | null;
  userId: string;
  ids: readonly string[];
}) {
  const cliente = useQueryClient();
  const override = estado?.incremento_kg ?? null;
  const [texto, setTexto] = useState(
    override === null ? "" : formatarNumero(override),
  );
  const [salvando, setSalvando] = useState(false);
  const padrao = exercicio.progressao.incremento_kg ?? 0;
  const usado = incrementoDe(exercicio, estado);

  const salvar = async () => {
    const kg = texto.trim() === "" ? null : lerNumero(texto);
    if (texto.trim() !== "" && (kg === null || kg <= 0)) {
      toast.error("Digite o incremento em kg, por exemplo 2.");
      return;
    }
    setSalvando(true);
    try {
      await salvarIncremento({
        userId,
        exercicioId: exercicio.id,
        incrementoKg: kg,
        cliente,
        idsEmTela: ids,
      });
      toast.success(
        kg === null
          ? `${exercicio.nome}: voltou a ${formatarKg(padrao)}.`
          : `${exercicio.nome}: ${formatarKg(kg)} por subida.`,
      );
    } catch {
      toast.error("Não consegui salvar agora.");
    } finally {
      setSalvando(false);
    }
  };

  const id = `incremento-${exercicio.id}`;

  return (
    <div className="flex items-end gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor={id} className="text-balance">
          {exercicio.nome}
        </Label>
        <p className="text-muted-foreground text-xs">
          programa {formatarKg(padrao)} · usando {formatarKg(usado)}
        </p>
      </div>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={formatarNumero(padrao)}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="alvo numero h-12 w-20"
      />
      <Button
        variant="outline"
        className="alvo h-12"
        aria-label={`Salvar incremento: ${exercicio.nome}`}
        disabled={salvando}
        onClick={() => void salvar()}
      >
        Salvar
      </Button>
    </div>
  );
}

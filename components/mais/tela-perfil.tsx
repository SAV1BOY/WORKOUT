"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { CabecalhoMais } from "@/components/mais/cabecalho";
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
import {
  SEMANAS_PARA_FASE2,
  SESSOES_PARA_FASE2,
  semanaDaFase,
  sugerirFase2,
} from "@/lib/calendario";
import { type PlanoSemanal } from "@/lib/cardio";
import { acharFase, cardio, programa } from "@/lib/dados";
import { formatarData, formatarNumero, lerNumero } from "@/lib/formato";
import { usePerfil } from "@/lib/queries/dados";
import {
  aceitarFase2,
  adiarSugestaoDaFase2,
  salvarPerfil,
  useTotalDeSessoesConcluidas,
} from "@/lib/queries/mais";
import { avancarSemana, repetirSemana } from "@/lib/queries/perfil";
import { useHoje } from "@/lib/relogio";
import type { LinhaPerfil } from "@/lib/types";

const PLANOS: { plano: PlanoSemanal; nome: string; maximo: number }[] = [
  { plano: "corrida", nome: "Corrida", maximo: cardio.corrida.semanas.length },
  { plano: "corda", nome: "Corda", maximo: 12 },
  { plano: "fixa", nome: "Barra fixa", maximo: 12 },
];

const CAMPO: Record<PlanoSemanal, keyof LinhaPerfil> = {
  corrida: "semana_corrida",
  corda: "semana_corda",
  fixa: "semana_fixa",
};

/** `/mais/perfil` (SPEC §3.9): quem treina, em que fase e em que semana. */
export function TelaPerfil({ userId }: { userId: string }) {
  const hoje = useHoje();
  const perfilQ = usePerfil();
  const sessoesQ = useTotalDeSessoesConcluidas();
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

  if (!perfil || !hoje) {
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  return (
    <Tela>
      <DadosDoPerfil userId={userId} perfil={perfil} />
      <Fase
        userId={userId}
        perfil={perfil}
        hoje={hoje}
        sessoes={sessoesQ.data ?? 0}
      />
      <Semanas userId={userId} perfil={perfil} />
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <CabecalhoMais titulo="Perfil" descricao="Seus dados e a fase do programa." />
      {children}
    </section>
  );
}

/* ------------------------------------------------- nome, altura, início */

function DadosDoPerfil({
  userId,
  perfil,
}: {
  userId: string;
  perfil: LinhaPerfil;
}) {
  const cliente = useQueryClient();
  const [nome, setNome] = useState(perfil.nome);
  const [altura, setAltura] = useState(
    perfil.altura_cm === null ? "" : formatarNumero(perfil.altura_cm),
  );
  const [inicio, setInicio] = useState(perfil.data_inicio);
  const [salvando, setSalvando] = useState(false);

  const mudou =
    nome !== perfil.nome ||
    inicio !== perfil.data_inicio ||
    (lerNumero(altura) ?? null) !== perfil.altura_cm;

  const salvar = async () => {
    if (nome.trim() === "") {
      toast.error("O nome não pode ficar vazio.");
      return;
    }
    const cm = lerNumero(altura);
    if (altura.trim() !== "" && (cm === null || cm <= 0)) {
      toast.error("Digite a altura em cm, por exemplo 190.");
      return;
    }
    setSalvando(true);
    try {
      await salvarPerfil({
        userId,
        mudanca: {
          nome: nome.trim(),
          altura_cm: altura.trim() === "" ? null : cm,
          data_inicio: inicio,
        },
        cliente,
      });
      toast.success("Perfil salvo.");
    } catch {
      toast.error("Não consegui salvar agora.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seus dados</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="perfil-nome">Nome</Label>
          <Input
            id="perfil-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="alvo h-12"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="perfil-altura">Altura (cm)</Label>
            <Input
              id="perfil-altura"
              type="text"
              inputMode="decimal"
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
              className="alvo numero h-12"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="perfil-inicio">Comecei em</Label>
            <Input
              id="perfil-inicio"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="alvo h-12"
            />
          </div>
        </div>
        <Button
          className="alvo h-12"
          disabled={!mudou || salvando}
          onClick={() => void salvar()}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------- fase (SPEC §5.1) */

function Fase({
  userId,
  perfil,
  hoje,
  sessoes,
}: {
  userId: string;
  perfil: LinhaPerfil;
  hoje: string;
  sessoes: number;
}) {
  const cliente = useQueryClient();
  const [mexendo, setMexendo] = useState(false);
  const fase = acharFase(perfil.fase_atual);
  const semanas = semanaDaFase(hoje, perfil.fase_desde);
  const sugestao = sugerirFase2(perfil, sessoes, hoje);
  const fase2 = programa.fases.find((f) => f.id === "fase2");

  const aceitar = async () => {
    setMexendo(true);
    try {
      await aceitarFase2({ userId, perfil, hoje, cliente });
      toast.success("Fase 2 começando hoje.");
    } catch {
      toast.error("Não consegui trocar de fase agora.");
    } finally {
      setMexendo(false);
    }
  };

  const adiar = async () => {
    setMexendo(true);
    try {
      await adiarSugestaoDaFase2({ userId, perfil, hoje, cliente });
      toast.success("Combinado: pergunto de novo em 2 semanas.");
    } catch {
      toast.error("Não consegui adiar agora.");
    } finally {
      setMexendo(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{fase.nome}</CardTitle>
        <CardDescription>
          Desde {formatarData(perfil.fase_desde)} · semana {semanas} ·{" "}
          {sessoes} {sessoes === 1 ? "treino concluído" : "treinos concluídos"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {perfil.fase_atual === "fase1" ? (
          sugestao.sugerir ? (
            <div className="border-primary/40 bg-primary/5 flex flex-col gap-3 rounded-lg border p-3">
              <p className="text-sm text-balance">
                Você já tem {sugestao.semanas} semanas de Fase 1 e {sessoes}{" "}
                treinos concluídos. Dá para passar para a{" "}
                {fase2 ? fase2.nome : "Fase 2"}.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  className="alvo h-12"
                  disabled={mexendo}
                  onClick={() => void aceitar()}
                >
                  Passar para a Fase 2
                </Button>
                <Button
                  variant="outline"
                  className="alvo h-12"
                  disabled={mexendo}
                  onClick={() => void adiar()}
                >
                  Adiar 2 semanas
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-balance">
              A Fase 2 é sugerida com {SEMANAS_PARA_FASE2} semanas de Fase 1 e{" "}
              {SESSOES_PARA_FASE2} treinos de força concluídos (você tem{" "}
              {sugestao.semanas} e {sessoes}). {fase.quando_mudar}
              {sugestao.adiadaAte
                ? ` Adiada até ${formatarData(sugestao.adiadaAte)}.`
                : ""}
            </p>
          )
        ) : (
          <p className="text-muted-foreground text-sm text-balance">
            {fase.quando_mudar}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------- semanas dos planos (§5.5) */

function Semanas({ userId, perfil }: { userId: string; perfil: LinhaPerfil }) {
  const cliente = useQueryClient();
  const [mexendo, setMexendo] = useState<PlanoSemanal | null>(null);

  const mexer = async (plano: PlanoSemanal, direcao: 1 | -1) => {
    setMexendo(plano);
    try {
      const acao = direcao === 1 ? avancarSemana : repetirSemana;
      await acao({ userId, plano, perfil, cliente });
    } catch {
      toast.error("Não consegui ajustar a semana agora.");
    } finally {
      setMexendo(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Semanas dos planos</CardTitle>
        <CardDescription>
          O app avança sozinho quando as 2 sessões da semana são concluídas;
          aqui dá para corrigir à mão.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {PLANOS.map(({ plano, nome, maximo }) => {
          const atual = Number(perfil[CAMPO[plano]] ?? 1);
          return (
            <div key={plano} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{nome}</p>
                <p className="text-muted-foreground text-xs">
                  Semana {atual} de {maximo}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="alvo size-12"
                aria-label={`Repetir semana de ${nome.toLowerCase()}`}
                disabled={mexendo !== null || atual <= 1}
                onClick={() => void mexer(plano, -1)}
              >
                <Minus className="size-5" />
              </Button>
              <span className="numero w-10 text-center text-lg font-semibold">
                {atual}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="alvo size-12"
                aria-label={`Avançar semana de ${nome.toLowerCase()}`}
                disabled={mexendo !== null || atual >= maximo}
                onClick={() => void mexer(plano, 1)}
              >
                <Plus className="size-5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

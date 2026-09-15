"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { GraficoLinha, LegendaDoGrafico, SemDados } from "@/components/graficos";
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
  dominioFolgado,
  faltaParaMeta,
  mediaMovel,
  metaDePeso,
  ultimoPeso,
  variacaoPorSemana,
  type PesoBruto,
} from "@/lib/corpo";
import { formatarData, formatarKg, formatarNumero, lerNumero } from "@/lib/formato";
import { gravarPerfil } from "@/lib/queries/perfil";
import { registrarPeso } from "@/lib/queries/corpo";
import type { LinhaPerfil } from "@/lib/types";

const SERIES = [
  { chave: "peso", nome: "Peso" },
  { chave: "media", nome: "Média de 7 dias", cor: "var(--chart-3)", tracejada: true },
];

/** Aba Peso (SPEC §3.8): registrar, média móvel de 7 dias, variação e meta. */
export function AbaPeso({
  userId,
  hoje,
  pesos,
  perfil,
}: {
  userId: string;
  hoje: string;
  pesos: PesoBruto[];
  perfil: LinhaPerfil;
}) {
  const cliente = useQueryClient();
  const [data, setData] = useState(hoje);
  const [peso, setPeso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [meta, setMeta] = useState(() => {
    const atual = metaDePeso(perfil.prefs);
    return atual === null ? "" : formatarNumero(atual);
  });

  const pontos = mediaMovel(pesos);
  // sem isto o eixo vai de 0 a 100 e a média de 7 dias some dentro da linha
  const dominioY = dominioFolgado(pontos.flatMap((p) => [p.peso, p.media]), 1);
  const semanas = variacaoPorSemana(pesos).slice(-8).reverse();
  const ultimo = ultimoPeso(pesos);
  const alvo = metaDePeso(perfil.prefs);
  const falta = faltaParaMeta(ultimo?.peso ?? null, alvo);

  const salvar = async () => {
    const valor = lerNumero(peso);
    if (valor === null || valor <= 0) {
      toast.error("Digite o peso, por exemplo 82,4.");
      return;
    }
    setSalvando(true);
    try {
      await registrarPeso({ userId, data, pesoKg: valor, cliente });
      setPeso("");
      toast.success(`Peso de ${formatarData(data)} registrado.`);
    } catch {
      toast.error("Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarMeta = async () => {
    const valor = lerNumero(meta);
    try {
      await gravarPerfil({
        userId,
        mudanca: {
          prefs: { ...perfil.prefs, meta_peso: valor !== null && valor > 0 ? valor : null },
        },
        cliente,
      });
      toast.success(valor ? `Meta de ${formatarKg(valor)} guardada.` : "Meta removida.");
    } catch {
      toast.error("Não consegui guardar a meta agora.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar peso</CardTitle>
          <CardDescription>Uma pesagem por dia — a última vale.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="peso-data">Data</Label>
              <Input
                id="peso-data"
                type="date"
                value={data}
                max={hoje}
                onChange={(e) => setData(e.target.value)}
                className="alvo h-12"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="peso-kg">Peso (kg)</Label>
              <Input
                id="peso-kg"
                type="text"
                inputMode="decimal"
                placeholder="82,4"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                className="alvo numero h-12 text-lg"
              />
            </div>
          </div>
          <Button
            className="alvo h-12 w-full text-base font-semibold"
            disabled={salvando}
            onClick={() => void salvar()}
          >
            {salvando ? "Registrando…" : "Registrar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ultimo ? `${formatarKg(ultimo.peso)} em ${formatarData(ultimo.data)}` : "Sem pesagem"}
          </CardTitle>
          <CardDescription>
            {/*
              A meta pode estar para baixo (secar) ou para cima (o objetivo do
              perfil é ganhar músculo): o que falta é a distância, nos dois
              sentidos.
            */}
            {falta === null
              ? "Defina uma meta embaixo, se quiser."
              : falta === 0
                ? `Você está na meta de ${formatarKg(alvo ?? 0)}.`
                : `Faltam ${formatarKg(Math.abs(falta))} para a meta de ${formatarKg(alvo ?? 0)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pontos.length === 0 ? (
            <SemDados>O gráfico aparece com a primeira pesagem.</SemDados>
          ) : (
            <>
              <GraficoLinha
                titulo="Peso por data, com a média de 7 dias"
                dados={pontos}
                x="rotulo"
                sufixo=" kg"
                dominioY={dominioY}
                series={SERIES}
              />
              <LegendaDoGrafico series={SERIES} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variação por semana</CardTitle>
        </CardHeader>
        <CardContent>
          {semanas.length === 0 ? (
            <SemDados>Duas semanas de pesagem e a variação aparece aqui.</SemDados>
          ) : (
            <ul className="divide-border divide-y">
              {semanas.map((s) => (
                <li key={s.inicio} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm">semana de {formatarData(s.inicio)}</span>
                  <span className="numero text-sm">{formatarKg(s.peso)}</span>
                  <span
                    className={
                      s.variacao === null
                        ? "text-muted-foreground numero text-xs"
                        : s.variacao > 0
                          ? "numero text-primary text-xs"
                          : "numero text-xs"
                    }
                  >
                    {s.variacao === null
                      ? "—"
                      : s.variacao === 0
                        ? "0 kg"
                        : `${s.variacao > 0 ? "+" : "−"}${formatarNumero(Math.abs(s.variacao))} kg`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta (opcional)</CardTitle>
          <CardDescription>Fica guardada no seu perfil.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="peso-meta">Meta (kg)</Label>
            <Input
              id="peso-meta"
              type="text"
              inputMode="decimal"
              placeholder="78,0"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              className="alvo numero h-12"
            />
          </div>
          <Button variant="outline" className="alvo h-12" onClick={() => void salvarMeta()}>
            Guardar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

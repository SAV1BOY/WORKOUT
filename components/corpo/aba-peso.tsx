"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { mensagemDeRegistro } from "@/lib/outbox";
import { toast } from "sonner";
import { SemDados } from "@/components/graficos";
import { CardImc } from "@/components/corpo/card-imc";
import { GraficoDoPeso } from "@/components/corpo/grafico-peso";
import { Button } from "@/components/ui/button";
import { CampoData, useDataDoRegistro } from "@/components/ui/campo-data";
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
  faltaParaMeta,
  metaDePeso,
  textoDaVariacao,
  ultimoPeso,
  variacaoPorSemana,
  type PesoBruto,
} from "@/lib/corpo";
import { formatarData, formatarKg, formatarNumero, lerNumero } from "@/lib/formato";
import { gravarPerfil } from "@/lib/queries/perfil";
import { registrarPeso } from "@/lib/queries/corpo";
import type { LinhaPerfil } from "@/lib/types";

/**
 * Aba Peso (SPEC §3.8): registrar, média móvel de 7 dias, variação e meta.
 *
 * A ordem é a do que se veio ver (SPEC §22.19 item 2): o peso atual e o
 * gráfico, Registrar, IMC, variação por semana e a meta.
 */
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
  const { data, escolher, voltarParaHoje } = useDataDoRegistro(hoje);
  const [peso, setPeso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [meta, setMeta] = useState(() => {
    const atual = metaDePeso(perfil.prefs);
    return atual === null ? "" : formatarNumero(atual);
  });

  const campoMeta = useRef<HTMLInputElement>(null);

  const semanas = variacaoPorSemana(pesos).slice(-8).reverse();
  const ultimo = ultimoPeso(pesos);
  const alvo = metaDePeso(perfil.prefs);
  const falta = faltaParaMeta(ultimo?.peso ?? null, alvo);
  const variacao = textoDaVariacao(pesos);

  /*
   * SPEC §22.19 item 4: no lugar de "Defina uma meta embaixo" (orientação por
   * posição), um link que leva ao campo da meta — rola até ele e põe o foco.
   */
  const irParaAMeta = (evento: React.MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault();
    const campo = campoMeta.current;
    if (!campo) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    campo.scrollIntoView({ block: "center", behavior: reduzir ? "auto" : "smooth" });
    campo.focus({ preventScroll: true });
  };

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
      voltarParaHoje();
      toast.success(mensagemDeRegistro(`Peso de ${formatarData(data)} registrado.`));
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
      toast.success(valor ? `Meta de ${formatarKg(valor)} salva.` : "Meta removida.");
    } catch {
      toast.error("Não consegui salvar a meta agora.");
    }
  };

  const mudarAltura = async (cm: number) => {
    try {
      await gravarPerfil({ userId, mudanca: { altura_cm: cm }, cliente });
      toast.success(`Altura de ${cm} cm salva.`);
    } catch {
      toast.error("Não consegui salvar a altura agora.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            {ultimo ? `${formatarKg(ultimo.peso)} em ${formatarData(ultimo.data)}` : "Sem pesagem"}
          </CardTitle>
          <CardDescription className="flex flex-col items-start gap-0.5">
            {variacao ? <span className="numero">{variacao}</span> : null}
            {/*
              A meta pode estar para baixo (secar) ou para cima (o objetivo do
              perfil é ganhar músculo): o que falta é a distância, nos dois
              sentidos.
            */}
            {alvo === null ? (
              <a
                href="#peso-meta"
                onClick={irParaAMeta}
                className="alvo text-primary inline-flex items-center underline underline-offset-4"
              >
                Definir uma meta
              </a>
            ) : falta === null ? (
              <span>Meta de {formatarKg(alvo)}.</span>
            ) : falta === 0 ? (
              <span>Você está na meta de {formatarKg(alvo)}.</span>
            ) : (
              <span>
                Faltam {formatarKg(Math.abs(falta))} para a meta de {formatarKg(alvo)}.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pesos.length === 0 ? (
            <SemDados>O gráfico aparece com a primeira pesagem.</SemDados>
          ) : (
            <GraficoDoPeso pesos={pesos} meta={alvo} comMedia />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">Registrar peso</CardTitle>
          <CardDescription>Uma pesagem por dia — a última vale.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
          <CampoData id="peso-data" valor={data} hoje={hoje} aoMudar={escolher} />
          <Button
            className="alvo h-12 w-full text-base font-semibold"
            disabled={salvando}
            onClick={() => void salvar()}
          >
            {salvando ? "Registrando…" : "Registrar"}
          </Button>
        </CardContent>
      </Card>

      {/* O IMC da §13.7: o mesmo card do Relatório e da conclusão do treino. */}
      <CardImc
        nivel={2}
        pesoKg={ultimo?.peso ?? null}
        alturaCm={perfil.altura_cm}
        aoMudarAltura={(cm) => void mudarAltura(cm)}
      />

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">Variação por semana</CardTitle>
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
          <CardTitle role="heading" aria-level={2} className="text-base">Meta (opcional)</CardTitle>
          <CardDescription>Fica salva no seu perfil.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="peso-meta">Meta (kg)</Label>
            <Input
              ref={campoMeta}
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
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

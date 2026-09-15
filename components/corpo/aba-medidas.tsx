"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { GraficoLinha, SemDados } from "@/components/graficos";
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
  MEDIDAS,
  medidasPorData,
  serieDeMedida,
  variacaoDaMedida,
  type CampoDeMedida,
  type MedidasBrutas,
} from "@/lib/corpo";
import { formatarCm, formatarData, formatarNumero, lerNumero } from "@/lib/formato";
import { registrarMedidas, type ValoresDeMedida } from "@/lib/queries/corpo";

type Rascunho = Partial<Record<CampoDeMedida, string>>;

/** Aba Medidas (SPEC §3.8): os 8 campos em cm, tabela e gráfico por medida. */
export function AbaMedidas({
  userId,
  hoje,
  medidas,
}: {
  userId: string;
  hoje: string;
  medidas: MedidasBrutas[];
}) {
  const cliente = useQueryClient();
  const [data, setData] = useState(hoje);
  const [valores, setValores] = useState<Rascunho>({});
  const [salvando, setSalvando] = useState(false);
  const [campo, setCampo] = useState<CampoDeMedida>("cintura_cm");

  const serie = serieDeMedida(medidas, campo);
  const tabela = medidasPorData(medidas).slice(0, 12);
  const variacao = variacaoDaMedida(medidas, campo);

  const salvar = async () => {
    const preenchidos: ValoresDeMedida = {};
    let quantos = 0;
    for (const m of MEDIDAS) {
      const bruto = valores[m.campo];
      if (bruto === undefined || bruto.trim() === "") continue;
      const valor = lerNumero(bruto);
      if (valor === null || valor <= 0) {
        toast.error(`${m.nome}: use números, por exemplo 91,5.`);
        return;
      }
      preenchidos[m.campo] = valor;
      quantos += 1;
    }
    if (quantos === 0) {
      toast.error("Preencha pelo menos uma medida.");
      return;
    }
    setSalvando(true);
    try {
      await registrarMedidas({ userId, data, valores: preenchidos, cliente });
      setValores({});
      toast.success(`Medidas de ${formatarData(data)} registradas.`);
    } catch {
      toast.error("Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar medidas</CardTitle>
          <CardDescription>
            Fita sem apertar, sempre no mesmo ponto. Um registro por dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="medidas-data">Data</Label>
            <Input
              id="medidas-data"
              type="date"
              value={data}
              max={hoje}
              onChange={(e) => setData(e.target.value)}
              className="alvo h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {MEDIDAS.map((m) => (
              <div key={m.campo} className="flex flex-col gap-1">
                <Label htmlFor={`medida-${m.campo}`} className="text-xs">
                  {m.nome} (cm)
                </Label>
                <Input
                  id={`medida-${m.campo}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  value={valores[m.campo] ?? ""}
                  onChange={(e) =>
                    setValores((atual) => ({ ...atual, [m.campo]: e.target.value }))
                  }
                  className="alvo numero h-12"
                />
                <span className="text-muted-foreground text-[10px] text-balance">
                  {m.onde}
                </span>
              </div>
            ))}
          </div>

          <Button
            className="alvo h-12 w-full text-base font-semibold"
            disabled={salvando}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar medidas"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução</CardTitle>
          <CardDescription>
            {variacao === null
              ? "Dois registros e a variação aparece."
              : variacao === 0
                ? "Igual ao registro anterior"
                : `${variacao > 0 ? "+" : "−"}${formatarNumero(Math.abs(variacao))} cm desde o registro anterior`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
              Medida
            </span>
            <select
              value={campo}
              onChange={(e) => setCampo(e.target.value as CampoDeMedida)}
              aria-label="Escolher a medida do gráfico"
              className="alvo border-input bg-background h-11 rounded-md border px-2 text-sm"
            >
              {MEDIDAS.map((m) => (
                <option key={m.campo} value={m.campo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>

          {serie.length === 0 ? (
            <SemDados>Sem registro desta medida ainda.</SemDados>
          ) : (
            <GraficoLinha
              titulo="Medida por data"
              dados={serie}
              x="rotulo"
              sufixo=" cm"
              series={[{ chave: "valor", nome: "cm" }]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {tabela.length === 0 ? (
            <SemDados>Nenhuma medida registrada até agora.</SemDados>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <caption className="sr-only">Medidas registradas</caption>
                <thead className="text-muted-foreground border-border border-b text-xs">
                  <tr>
                    <th scope="col" className="py-1 pr-2">
                      Data
                    </th>
                    {MEDIDAS.map((m) => (
                      <th key={m.campo} scope="col" className="py-1 pr-2 text-right">
                        {m.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {tabela.map((linha) => (
                    <tr key={linha.data}>
                      <td className="py-1.5 pr-2">{formatarData(linha.data)}</td>
                      {MEDIDAS.map((m) => (
                        <td key={m.campo} className="numero py-1.5 pr-2 text-right">
                          {linha[m.campo] === null || linha[m.campo] === undefined
                            ? "—"
                            : formatarCm(Number(linha[m.campo]))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

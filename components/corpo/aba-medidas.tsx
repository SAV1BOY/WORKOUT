"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Ruler } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GraficoLinha, SemDados } from "@/components/graficos";
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
  MEDIDAS,
  dominioFolgado,
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
  const { data, escolher, voltarParaHoje } = useDataDoRegistro(hoje);
  const [valores, setValores] = useState<Rascunho>({});
  const [salvando, setSalvando] = useState(false);
  const [campo, setCampo] = useState<CampoDeMedida>("cintura_cm");

  const serie = serieDeMedida(medidas, campo);
  // cintura de 88 cm num eixo de 0 a 100 é uma reta: o eixo cerca os valores
  const dominioY = dominioFolgado(serie.map((p) => p.valor), 2);
  const tabela = medidasPorData(medidas).slice(0, 12);
  const variacao = variacaoDaMedida(medidas, campo);
  const nomeDaMedida = MEDIDAS.find((m) => m.campo === campo)?.nome ?? "Medida";

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
      voltarParaHoje();
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
          <CardTitle role="heading" aria-level={2} className="text-base">Evolução</CardTitle>
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
            <span className="text-muted-foreground text-rotulo tracking-wide uppercase">
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
              dominioY={dominioY}
              /*
               * O nome da série é o da medida (SPEC §22.19 item 1): é o que a
               * dica e a leitura em texto dizem — "Cintura: 91,5 cm em 12/09",
               * não "cm: 91,5 cm".
               */
              series={[{ chave: "valor", nome: nomeDaMedida }]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {tabela.length === 0 ? (
            <SemDados icone={Ruler} titulo="Sem registros ainda">
              Nenhuma medida registrada até agora.
            </SemDados>
          ) : (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Medidas registradas</caption>
              <thead className="text-muted-foreground border-border border-b text-xs">
                <tr>
                  <th scope="col" className="py-1 pr-2">
                    Data
                  </th>
                  <th scope="col" className="py-1 text-right">{nomeDaMedida}</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {tabela.map((linha) => (
                  <tr key={linha.data}>
                    <td className="py-1.5 pr-2">{formatarData(linha.data)}</td>
                    <td className="numero py-1.5 text-right">
                      {linha[campo] == null ? "—" : formatarCm(Number(linha[campo]))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">Registrar medidas</CardTitle>
          <CardDescription>
            Fita sem apertar, sempre no mesmo ponto. Um registro por dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CampoData id="medidas-data" valor={data} hoje={hoje} aoMudar={escolher} />

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
                <details className="text-muted-foreground text-xs">
                  <summary className="alvo flex cursor-pointer items-center underline" aria-label={`Como medir: ${m.nome}`}>
                    Como medir
                  </summary>
                  <p>{m.onde}</p>
                </details>
              </div>
            ))}
          </div>

          <Button
            className="alvo h-12 w-full text-base font-semibold"
            disabled={salvando}
            onClick={() => void salvar()}
          >
            {salvando ? "Registrando…" : "Registrar medidas"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

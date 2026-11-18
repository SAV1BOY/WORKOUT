"use client";

import { useRede } from "@/lib/usar-rede";

import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CabecalhoMais } from "@/components/mais/cabecalho";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  contarLinhas,
  lerBackup,
  nomeDoArquivoBackup,
  previaDaImportacao,
  textoDoBackup,
  type Backup,
  type Previa,
} from "@/lib/backup";
import { formatarDataCompleta } from "@/lib/formato";
import {
  exportarBackup,
  importarBackup,
  lerChavesExistentes,
} from "@/lib/queries/mais";

/** `/mais/backup` (SPEC §9): exportar tudo e importar de volta. */
export function TelaBackup({ userId }: { userId: string }) {
  const online = useRede();
  return (
    <section className="flex flex-col gap-4">
      <CabecalhoMais
        titulo="Backup"
        descricao="Um arquivo com tudo que é seu: treinos, séries, cardio, peso, medidas e ajustes."
      />
      {!online && <p role="status">Precisa de rede para ler os seus registros no servidor.</p>}
      <Exportar userId={userId} />
      <Importar userId={userId} />
      <p className="text-muted-foreground text-xs text-balance">
        As fotos de progresso ficam guardadas à parte, só para você. O resto volta igual: importar o mesmo arquivo duas vezes não
        duplica nada.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------- exportar */

function Exportar({ userId }: { userId: string }) {
  const online = useRede();
  const [ocupado, setOcupado] = useState(false);

  const baixar = async () => {
    setOcupado(true);
    try {
      const agora = new Date().toISOString();
      const backup = await exportarBackup({ userId, agora });
      const nome = nomeDoArquivoBackup(agora);

      const blob = new Blob([textoDoBackup(backup)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.append(link);
      link.click();
      link.remove();
      // o navegador precisa do blob até o download começar
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      toast.success(`${contarLinhas(backup)} linhas em ${nome}.`);
    } catch (e) {
      toast.error(
        (e as Error).message || "Não consegui exportar agora. Precisa de rede.",
      );
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exportar</CardTitle>
        <CardDescription>
          Baixa um arquivo com tudo que você registrou.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="alvo h-12 w-full gap-2"
          disabled={!online || ocupado}
          onClick={() => void baixar()}
        >
          <Download className="size-5" />
          {ocupado ? "Juntando tudo…" : "Exportar backup"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------- importar */

interface Escolhido {
  nome: string;
  backup: Backup;
  previa: Previa;
}

function Importar({ userId }: { userId: string }) {
  const cliente = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [escolhido, setEscolhido] = useState<Escolhido | null>(null);
  const online = useRede();
  const [ocupado, setOcupado] = useState(false);

  const escolher = async (arquivo: File) => {
    setOcupado(true);
    try {
      const backup = lerBackup(await arquivo.text());
      const existentes = await lerChavesExistentes(userId);
      setEscolhido({
        nome: arquivo.name,
        backup,
        previa: previaDaImportacao(backup, existentes, userId),
      });
    } catch (e) {
      setEscolhido(null);
      toast.error((e as Error).message || "Não consegui ler o arquivo.");
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const confirmar = async () => {
    if (!escolhido) return;
    setOcupado(true);
    try {
      const linhas = await importarBackup({
        backup: escolhido.backup,
        userId,
        cliente,
      });
      setEscolhido(null);
      toast.success(`${linhas} linhas importadas.`);
    } catch {
      toast.error("Não consegui importar agora.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Importar</CardTitle>
        <CardDescription>
          Escolha um arquivo exportado por este app. Nada entra antes de você
          ver a prévia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <input
          ref={entrada}
          id="arquivo-backup"
          type="file"
          disabled={!online || ocupado}
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void escolher(arquivo);
          }}
        />
        <Button
          variant="outline"
          className="alvo h-12 w-full gap-2"
          disabled={!online || ocupado}
          onClick={() => entrada.current?.click()}
        >
          <Upload className="size-5" />
          Escolher arquivo
        </Button>

        {escolhido ? (
          <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
            <div>
              <p className="font-medium break-all">{escolhido.nome}</p>
              <p className="text-muted-foreground text-xs">
                Exportado em{" "}
                {formatarDataCompleta(escolhido.backup.exportado_em)}
              </p>
            </div>

            {escolhido.previa.total === 0 ? (
              <p className="text-muted-foreground text-sm">
                Este backup não tem nenhuma linha para importar.
              </p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left text-xs">
                      <th className="font-normal">Tabela</th>
                      <th className="font-normal text-right">Novas</th>
                      <th className="font-normal text-right">Atualiza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escolhido.previa.itens.map((item) => (
                      <tr key={item.tabela}>
                        <td className="py-1">{item.nome}</td>
                        <td className="numero py-1 text-right">{item.novas}</td>
                        <td className="numero py-1 text-right">
                          {item.atualizadas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-muted-foreground text-xs text-balance">
                  {escolhido.previa.novas} linhas novas e{" "}
                  {escolhido.previa.atualizadas} que já existem (serão
                  sobrescritas).
                </p>
                <Button
                  className="alvo h-12"
                  disabled={!online || ocupado}
                  onClick={() => void confirmar()}
                >
                  {ocupado ? "Importando…" : "Importar tudo"}
                </Button>
              </>
            )}
            {escolhido.previa.invalidas > 0 && (
              <p className="text-muted-foreground text-xs">
                Registros ignorados por dados inválidos: {escolhido.previa.invalidas}.
              </p>
            )}
            <Button
              variant="ghost"
              className="alvo h-12"
              disabled={ocupado}
              onClick={() => setEscolhido(null)}
            >
              Cancelar
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

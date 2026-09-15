"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { CabecalhoMais } from "@/components/mais/cabecalho";
import { Badge } from "@/components/ui/badge";
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
  anilhasDoKit,
  barrasDoTerraco,
  itensDoTerraco,
  notaDasAnilhas,
  oQueFalta,
  presilhas,
  totalDeAnilhasKg,
  type BarraDoTerraco,
} from "@/lib/equipamento";
import { formatarKg, formatarNumero, lerNumero } from "@/lib/formato";
import { PESO_BARRA_A_PESAR } from "@/lib/montagem";
import {
  PESO_BARRA_MAX,
  PESO_BARRA_MIN,
  comPesoDaBarra,
  pesoDeBarraValido,
} from "@/lib/preferencias";
import { usePerfil } from "@/lib/queries/dados";
import { salvarPrefs } from "@/lib/queries/mais";
import type { LinhaPerfil } from "@/lib/types";

/** `/mais/equipamento` (SPEC §3.9): o que tem no terraço e quanto pesa. */
export function TelaEquipamento({ userId }: { userId: string }) {
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
      <Barras userId={userId} perfil={perfil} />
      <Anilhas />
      <Itens />
      <Falta />
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <CabecalhoMais
        titulo="Equipamento"
        descricao="O que está montado no terraço. O peso da barra muda a carga que o app pede."
      />
      {children}
    </section>
  );
}

/* --------------------------------------------- barras (peso editável) */

function Barras({ userId, perfil }: { userId: string; perfil: LinhaPerfil }) {
  const barras = barrasDoTerraco(perfil.prefs);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Barras</CardTitle>
        <CardDescription>
          A barra W e a reta oca ainda serão pesadas: até lá o app usa{" "}
          {formatarKg(PESO_BARRA_A_PESAR)} e avisa. Pese na balança e anote aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {barras.map((barra) => (
          <LinhaDaBarra
            key={barra.id}
            barra={barra}
            userId={userId}
            perfil={perfil}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function LinhaDaBarra({
  barra,
  userId,
  perfil,
}: {
  barra: BarraDoTerraco;
  userId: string;
  perfil: LinhaPerfil;
}) {
  const cliente = useQueryClient();
  const [texto, setTexto] = useState(
    barra.pesoDoPerfil === null ? "" : formatarNumero(barra.pesoDoPerfil),
  );
  const [salvando, setSalvando] = useState(false);

  const gravar = async (kg: number | null) => {
    setSalvando(true);
    try {
      await salvarPrefs({
        userId,
        prefs: comPesoDaBarra(perfil.prefs, barra.id, kg),
        cliente,
      });
      toast.success(
        kg === null
          ? `${barra.nome}: voltou ao peso do kit.`
          : `${barra.nome}: ${formatarKg(kg)}.`,
      );
    } catch {
      toast.error("Não consegui salvar agora.");
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    const kg = lerNumero(texto);
    if (kg === null || !pesoDeBarraValido(kg)) {
      toast.error(
        `Digite o peso entre ${formatarKg(PESO_BARRA_MIN)} e ${formatarKg(PESO_BARRA_MAX)}.`,
      );
      return;
    }
    await gravar(kg);
  };

  const limpar = async () => {
    setTexto("");
    await gravar(null);
  };

  const id = `barra-${barra.id}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-balance">{barra.nome}</p>
          <p className="text-muted-foreground text-xs text-balance">
            {barra.uso}
          </p>
        </div>
        {barra.origem === "provisorio" ? (
          <Badge variant="outline" className="shrink-0">
            a pesar
          </Badge>
        ) : null}
      </div>

      <p className="text-sm">
        Vale hoje: <strong className="numero">{formatarKg(barra.pesoKg)}</strong>
        {barra.capacidadeKg !== null
          ? ` · aguenta ${formatarKg(barra.capacidadeKg)}`
          : ""}
        {barra.origem === "perfil" ? " · medido por você" : ""}
      </p>

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor={id}>Peso na balança (kg)</Label>
          <Input
            id={id}
            type="text"
            inputMode="decimal"
            placeholder={
              barra.pesoDoJson === null ? "" : formatarNumero(barra.pesoDoJson)
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="alvo numero h-12"
          />
        </div>
        <Button
          className="alvo h-12"
          aria-label={`Salvar peso: ${barra.nome}`}
          disabled={salvando || texto.trim() === ""}
          onClick={() => void salvar()}
        >
          Salvar
        </Button>
        {barra.pesoDoPerfil !== null ? (
          <Button
            variant="outline"
            className="alvo h-12"
            aria-label={`Limpar peso: ${barra.nome}`}
            disabled={salvando}
            onClick={() => void limpar()}
          >
            Limpar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- anilhas */

function Anilhas() {
  const anilhas = anilhasDoKit();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Anilhas</CardTitle>
        <CardDescription>
          {formatarKg(totalDeAnilhasKg())} no total · {presilhas()} presilhas
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2">
          {anilhas.map((a) => (
            <li
              key={a.kg}
              className="border-border rounded-md border px-2 py-1 text-sm"
            >
              <span className="numero font-semibold">{formatarKg(a.kg)}</span>
              <span className="text-muted-foreground"> × {a.qtd}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs text-balance">
          {notaDasAnilhas()}
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------ os 10 itens */

function Itens() {
  const itens = itensDoTerraco();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">No terraço</CardTitle>
        <CardDescription>{itens.length} itens</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-border divide-y">
          {itens.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto estática do kit, sem otimização do Next */}
              <img
                src={item.foto}
                alt={item.nome}
                loading="lazy"
                className="bg-muted size-16 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0">
                <p className="font-medium text-balance">{item.nome}</p>
                <p className="text-muted-foreground text-xs text-balance">
                  {item.specs}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Falta() {
  const falta = oQueFalta();
  if (falta.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ainda falta</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="text-muted-foreground list-disc pl-5 text-sm">
          {falta.map((f) => (
            <li key={f} className="text-balance">
              {f}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

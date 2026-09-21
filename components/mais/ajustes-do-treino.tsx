"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { lerNumero } from "@/lib/formato";
import { PREPARACAO_PADRAO_S } from "@/lib/player";
import {
  comDescansoPadraoS,
  comLigado,
  comPreparacaoS,
  descansoPadraoS,
  evitarExercicios,
  ligado,
  preparacaoS,
  semEvitados,
  type ChaveLigada,
} from "@/lib/preferencias";
import { salvarPrefs } from "@/lib/queries/mais";
import type { LinhaPerfil } from "@/lib/types";

/** Os interruptores do treino (SPEC §14.4). */
const INTERRUPTORES: { chave: ChaveLigada; titulo: string; descricao: string }[] = [
  {
    chave: "avancar_sozinho",
    titulo: "Avançar sozinho",
    descricao: "Ao zerar o descanso, o player já vai para o próximo passo.",
  },
  {
    chave: "descanso_som",
    titulo: "Som no fim do descanso",
    descricao: "Um apito curto quando o timer zera.",
  },
  {
    chave: "descanso_vibra",
    titulo: "Vibração",
    descricao: "O celular vibra quando o timer zera (onde existir).",
  },
  {
    chave: "cardio_voz",
    titulo: "Voz no cardio",
    descricao: "Fala o próximo bloco (“corrida”, “caminhada”).",
  },
  {
    chave: "manter_tela",
    titulo: "Manter a tela acesa",
    descricao: "Durante o treino e o cardio a tela não apaga sozinha.",
  },
  {
    chave: "mostrar_raios",
    titulo: "Mostrar raios de dificuldade",
    descricao: "Os raios de cada exercício e de cada treino (1 a 3).",
  },
];

/**
 * Os ajustes do treino (SPEC §14.4): preparação, descanso padrão, avançar
 * sozinho, voz, vibração, tela acesa, raios e "limpar não gosto".
 *
 * O mesmo bloco serve Mais → Preferências e o "Ajustar" (engrenagem) do
 * player — são as mesmas chaves em `profiles.prefs`.
 */
export function AjustesDoTreino({
  userId,
  perfil,
}: {
  userId: string;
  perfil: LinhaPerfil;
}) {
  const cliente = useQueryClient();
  const prefs = perfil.prefs;
  const preparacaoGravada = preparacaoS(prefs);
  const descansoGravado = descansoPadraoS(prefs);
  const [preparacao, setPreparacao] = useState(String(preparacaoGravada));
  const [descansoTexto, setDescansoTexto] = useState(
    descansoGravado === null ? "" : String(descansoGravado),
  );
  const [salvando, setSalvando] = useState(false);
  const evitados = evitarExercicios(prefs);

  const gravar = useCallback(
    async (novas: Parameters<typeof salvarPrefs>[0]["prefs"]) => {
      setSalvando(true);
      try {
        await salvarPrefs({ userId, prefs: novas, cliente });
      } catch {
        toast.error("Não consegui salvar agora.");
      } finally {
        setSalvando(false);
      }
    },
    [userId, cliente],
  );

  /*
   * SPEC §22.7 item 3: os dois campos gravam sozinhos, como os interruptores
   * ao lado — dois modelos de gravação na mesma folha faziam duvidar se o
   * interruptor tinha pegado. Enquanto se digita a gravação é silenciosa (um
   * texto pela metade não vira erro); ao sair do campo, o que não for número
   * volta ao valor gravado e diz por quê.
   */
  const gravarPreparacao = useCallback(
    async (texto: string, aoSair: boolean) => {
      const n = lerNumero(texto.trim());
      if (n === null || n < 0) {
        if (aoSair) {
          toast.error("Digite os segundos da preparação, por exemplo 10.");
          setPreparacao(String(preparacaoGravada));
        }
        return;
      }
      if (n === preparacaoGravada) return;
      await gravar(comPreparacaoS(prefs, n));
      toast.success(n === 0 ? "Sem tela de preparação." : `Preparação: ${n} s.`);
    },
    [gravar, prefs, preparacaoGravada],
  );

  const gravarDescanso = useCallback(
    async (texto: string, aoSair: boolean) => {
      const limpo = texto.trim();
      const n = limpo === "" ? null : lerNumero(limpo);
      if (limpo !== "" && (n === null || n <= 0)) {
        if (aoSair) {
          toast.error("Digite os segundos do descanso, por exemplo 90.");
          setDescansoTexto(descansoGravado === null ? "" : String(descansoGravado));
        }
        return;
      }
      if (n === descansoGravado) return;
      await gravar(comDescansoPadraoS(prefs, n));
      toast.success(
        n === null ? "Descanso: o do exercício." : `Descanso padrão: ${n} s.`,
      );
    },
    [gravar, prefs, descansoGravado],
  );

  /* o mesmo atraso dos campos numéricos do player: grava quem parou de digitar */
  useEffect(() => {
    if (preparacao === String(preparacaoGravada)) return;
    const relogio = window.setTimeout(() => void gravarPreparacao(preparacao, false), 700);
    return () => window.clearTimeout(relogio);
  }, [preparacao, preparacaoGravada, gravarPreparacao]);

  useEffect(() => {
    const gravadoTexto = descansoGravado === null ? "" : String(descansoGravado);
    if (descansoTexto === gravadoTexto) return;
    const relogio = window.setTimeout(() => void gravarDescanso(descansoTexto, false), 700);
    return () => window.clearTimeout(relogio);
  }, [descansoTexto, descansoGravado, gravarDescanso]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="pref-preparacao">Preparação (s)</Label>
          <p className="text-muted-foreground text-xs">
            A contagem antes do primeiro exercício. 0 = sem preparação (padrão{" "}
            {PREPARACAO_PADRAO_S}).
          </p>
        </div>
        <Input
          id="pref-preparacao"
          type="text"
          inputMode="numeric"
          value={preparacao}
          onChange={(e) => setPreparacao(e.target.value)}
          onBlur={() => void gravarPreparacao(preparacao, true)}
          className="alvo numero h-12 w-24"
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="pref-descanso">Descanso padrão (s)</Label>
          <p className="text-muted-foreground text-xs">
            Vale para todos os exercícios. Vazio = o descanso do próprio
            exercício, como está no guia.
          </p>
        </div>
        {/* a frase acima já diz o que o vazio significa: aqui cabia só
            "do exercí…", uma palavra pela metade (SPEC §22.7 item 3) */}
        <Input
          id="pref-descanso"
          type="text"
          inputMode="numeric"
          placeholder="—"
          value={descansoTexto}
          onChange={(e) => setDescansoTexto(e.target.value)}
          onBlur={() => void gravarDescanso(descansoTexto, true)}
          className="alvo numero h-12 w-24"
        />
      </div>

      {INTERRUPTORES.map(({ chave, titulo, descricao }) => (
        <div key={chave} className="flex min-h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor={`pref-${chave}`} className="text-base">
              {titulo}
            </Label>
            <p className="text-muted-foreground text-xs text-balance">{descricao}</p>
          </div>
          {/* o pill tem 18 px; a caixa de toque de 44 px é o próprio botão */}
          <Switch
            id={`pref-${chave}`}
            className="-mr-1.5"
            checked={ligado(prefs, chave)}
            onCheckedChange={(v) => void gravar(comLigado(prefs, chave, v))}
          />
        </div>
      ))}

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label className="text-base">Exercícios marcados como “não gosto”</Label>
          <p className="text-muted-foreground text-xs">
            {evitados.length === 0
              ? "Nenhum por enquanto. Quando você marcar algum, ele passa a aparecer por último nas listas."
              : `${evitados.length} marcado(s); aparecem por último nas listas.`}
          </p>
        </div>
        <Button
          variant="outline"
          className="alvo h-12"
          disabled={salvando || evitados.length === 0}
          onClick={() => {
            void gravar(semEvitados(prefs));
            toast.success("Lista de “não gosto” limpa.");
          }}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}

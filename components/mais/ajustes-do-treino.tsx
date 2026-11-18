"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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
import { salvarPrefsOuDesfazer } from "@/lib/queries/mais";
import type { LinhaPerfil } from "@/lib/types";

/** Os interruptores do treino (SPEC §14.4). */
const INTERRUPTORES: { chave: ChaveLigada; titulo: string; descricao: string }[] = [
  {
    chave: "avancar_sozinho",
    titulo: "Avançar sozinho",
    descricao: "Quando o descanso termina, o treino avança para o próximo passo.",
  },
  {
    chave: "descanso_som",
    titulo: "Som no fim do descanso",
    descricao: "Um apito curto quando a contagem termina.",
  },
  {
    chave: "descanso_vibra",
    titulo: "Vibração",
    descricao: "O celular vibra no fim da contagem, quando há suporte.",
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
    async (novas: Parameters<typeof salvarPrefsOuDesfazer>[0]["prefs"]) => {
      setSalvando(true);
      try {
        await salvarPrefsOuDesfazer({ userId, prefs: novas, cliente });
        return true;
      } catch {
        toast.error("Não consegui salvar agora.");
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [userId, cliente],
  );

  // Confirmar ao sair do campo ou com Enter evita guardar só o primeiro dígito.
  const gravarPreparacao = useCallback(
    async (texto: string) => {
      const n = lerNumero(texto.trim());
      if (n === null || n < 0) {
        toast.error("Digite os segundos da preparação, por exemplo 10.");
        setPreparacao(String(preparacaoGravada));
        return;
      }
      if (n === preparacaoGravada) return;
      if (!(await gravar(comPreparacaoS(prefs, n)))) return;
      toast.success(n === 0 ? "Sem tela de preparação." : `Preparação: ${n} s.`);
    },
    [gravar, prefs, preparacaoGravada],
  );

  const gravarDescanso = useCallback(
    async (texto: string) => {
      const limpo = texto.trim();
      const n = limpo === "" ? null : lerNumero(limpo);
      if (limpo !== "" && (n === null || n <= 0)) {
        toast.error("Digite os segundos do descanso, por exemplo 90.");
        setDescansoTexto(descansoGravado === null ? "" : String(descansoGravado));
        return;
      }
      if (n === descansoGravado) return;
      if (!(await gravar(comDescansoPadraoS(prefs, n)))) return;
      toast.success(
        n === null ? "Descanso: o do exercício." : `Descanso padrão: ${n} s.`,
      );
    },
    [gravar, prefs, descansoGravado],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="pref-preparacao">Preparação (segundos)</Label>
          <p className="text-muted-foreground text-xs">
            Use 0 para pular a preparação. O padrão é {PREPARACAO_PADRAO_S} segundos.
          </p>
        </div>
        <Input
          id="pref-preparacao"
          type="text"
          inputMode="numeric"
          value={preparacao}
          onChange={(e) => setPreparacao(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          onBlur={() => void gravarPreparacao(preparacao)}
          className="alvo numero h-12 w-24"
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="pref-descanso">Descanso padrão (segundos)</Label>
          <p className="text-muted-foreground text-xs">
            Deixe em branco para usar o descanso de cada exercício.
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
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          onBlur={() => void gravarDescanso(descansoTexto)}
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
              : evitados.length === 1
                ? "1 marcado. Aparece por último nas listas."
                : `${evitados.length} marcados. Aparecem por último nas listas.`}
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

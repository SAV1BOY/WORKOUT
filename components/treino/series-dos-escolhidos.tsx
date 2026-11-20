"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acharExercicio } from "@/lib/dados";
import { DESCANSO_MAX_S, DESCANSO_MIN_S, duracaoDeDescansoValida } from "@/lib/descanso-da-sessao";
import { MAX_SERIES_DA_SESSAO, MIN_SERIES_DA_SESSAO, prescricaoPadrao } from "@/lib/progressao";

const contagens = Array.from({ length: MAX_SERIES_DA_SESSAO - MIN_SERIES_DA_SESSAO + 1 }, (_, i) => i + MIN_SERIES_DA_SESSAO);
const aviso = `Use um número inteiro de ${DESCANSO_MIN_S} a ${DESCANSO_MAX_S} segundos.`;

function descansoInvalido(texto: string): boolean {
  if (texto === "") return false;
  return !/^\d+$/.test(texto) || !duracaoDeDescansoValida(Number(texto));
}

export interface EdicaoDosDescansos {
  aplicarValidos: () => void;
}

export function SeriesDosEscolhidos({ ref, ids, ajustes, descansos, descansoDaConta, aoMudar, aoConfirmarDescansos, aoFechar }: {
  ref: Ref<EdicaoDosDescansos>;
  ids: readonly string[];
  ajustes: Readonly<Record<string, number>>;
  descansos: Readonly<Record<string, number>>;
  descansoDaConta: number | null;
  aoMudar: (id: string, series?: number) => void;
  aoConfirmarDescansos: (descansos: Record<string, number>) => void;
  aoFechar: () => void;
}) {
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(descansos).map(([id, segundos]) => [id, String(segundos)])),
  );
  const [validando, setValidando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  function focarDescanso(id: string) {
    const campo = formulario.current?.elements.namedItem(id);
    if (campo instanceof HTMLInputElement) campo.focus();
  }

  function aplicarValidos() {
    const valores: Record<string, number> = {};
    for (const id of ids) {
      const texto = textos[id] ?? "";
      if (texto === "") continue;
      const segundos = descansoInvalido(texto) ? descansos[id] : Number(texto);
      if (segundos !== undefined) valores[id] = segundos;
    }
    aoConfirmarDescansos(valores);
  }

  // Escape e Fechar preservam os intervalos válidos e a última escolha dos campos incompletos.
  useImperativeHandle(ref, () => ({ aplicarValidos }));

  return (
    <form ref={formulario} noValidate className="flex min-h-0 flex-1 flex-col gap-3 px-4"
      onSubmit={evento => {
        evento.preventDefault();
        const invalido = ids.find(id => descansoInvalido(textos[id] ?? ""));
        if (invalido !== undefined) {
          setValidando(true);
          focarDescanso(invalido);
          return;
        }
        aplicarValidos();
        aoFechar();
      }}>
      <ol aria-label="Séries e descanso dos escolhidos" className="min-h-0 overflow-y-auto divide-y px-1">
        {ids.map(id => {
          const exercicio = acharExercicio(id);
          const padrao = descansoDaConta ?? exercicio.prescricao_padrao.descanso_s;
          const texto = textos[id] ?? "";
          const erro = validando && descansoInvalido(texto);
          const dicaId = `padrao-descanso-${id}`;
          const erroId = `erro-descanso-${id}`;
          return (
            <li key={id} className="py-3">
              <fieldset className="min-w-0">
                <legend className="mb-2 max-w-full text-sm font-semibold wrap-anywhere">{exercicio.nome}</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
                  <label className="flex min-w-0 flex-col gap-1 text-sm">
                    Séries de trabalho
                    <select aria-label={`Séries de trabalho de ${exercicio.nome}`} value={ajustes[id] ?? ""}
                      onChange={e => aoMudar(id, e.target.value ? Number(e.target.value) : undefined)}
                      className="alvo foco numero border-input bg-background h-11 w-full min-w-0 rounded-md border px-2 text-base">
                      <option value="">Padrão ({prescricaoPadrao(exercicio).series})</option>
                      {contagens.map(n => <option key={n} value={n}>{n} {n === 1 ? "série" : "séries"}</option>)}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-sm">
                    Descanso
                    <span className="relative block">
                      <Input name={id} type="text" inputMode="numeric" autoComplete="off" enterKeyHint="done"
                      aria-label={`Descanso de ${exercicio.nome} em segundos`} value={texto} placeholder={String(padrao)}
                      aria-describedby={erro ? `${dicaId} ${erroId}` : dicaId} aria-invalid={erro || undefined}
                      className="alvo numero pr-8 pl-2 text-base"
                      onChange={e => {
                        const valor = e.currentTarget.value;
                        setTextos(atuais => ({ ...atuais, [id]: valor }));
                      }} />
                      <span aria-hidden="true" className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2 flex items-center">s</span>
                    </span>
                  </label>
                </div>
                <p id={dicaId} className="text-muted-foreground mt-1 text-xs wrap-anywhere">
                  {descansoDaConta === null ? "Padrão do catálogo" : "Padrão da conta"}: {padrao} s
                </p>
                {erro && <p role="alert" id={erroId} className="text-destructive mt-1 text-sm wrap-anywhere">{aviso}</p>}
                {texto !== "" && (
                  <Button type="button" variant="ghost" className="alvo mt-1 h-auto max-w-full whitespace-normal px-2 py-1"
                    aria-label={`Restaurar descanso padrão de ${exercicio.nome}`}
                    onClick={() => {
                      setTextos(atuais => ({ ...atuais, [id]: "" }));
                      focarDescanso(id);
                    }}>Restaurar descanso padrão</Button>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <BotaoLargo type="submit" className="shrink-0">Pronto</BotaoLargo>
    </form>
  );
}

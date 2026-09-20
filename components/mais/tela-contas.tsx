"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CabecalhoMais } from "@/components/mais/cabecalho";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import { Vazio } from "@/components/ui/vazio";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { traduzirErroAuth } from "@/lib/erros-auth";
import { formatarData, formatarDataCompleta } from "@/lib/formato";
import {
  LIMITE_MAXIMO,
  LIMITE_MINIMO,
  contasCadastradas,
  limiteValido,
  salvarLimiteDeContas,
  vagasParaConta,
  type ContaCadastrada,
} from "@/lib/queries/contas";
import { clienteNavegador } from "@/lib/supabase/client";

const SEM_REDE = "Precisa de internet para mudar o limite.";
const NAO_DEU = "Não consegui falar com o servidor. Tente de novo.";

/**
 * `/mais/contas` (SPEC §21.3) — **só o dono**: quantas contas existem, quais
 * são e quantas cabem.
 *
 * Como `/mais/senha`, **isto não vai para a fila** (§8): a fila guarda linha de
 * tabela do treino, e mexer na cota sem rede só produziria uma surpresa depois.
 * Sem internet a tela diz isso e não chama nada.
 *
 * A segurança não está aqui: `contas_cadastradas()` devolve zero linhas para
 * quem não é o dono e a policy `app_config_dono` recusa a escrita. Esta tela é
 * a porta, não a tranca.
 */
export function TelaContas() {
  const [contas, setContas] = useState<ContaCadastrada[] | null>(null);
  const [limite, setLimite] = useState<number | null>(null);
  /** o limite que está no banco — para saber se há algo a salvar */
  const [limiteSalvo, setLimiteSalvo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const supabase = clienteNavegador();
        const [vagas, lista] = await Promise.all([
          vagasParaConta(supabase),
          contasCadastradas(supabase),
        ]);
        if (!vivo) return;
        setContas(lista);
        if (vagas !== null) {
          setLimite(vagas.limite);
          setLimiteSalvo(vagas.limite);
        }
      } catch (e) {
        if (!vivo) return;
        // o recado é da tela, em pt-BR: "Failed to fetch" não é português
        setErro(traduzirErroAuth((e as Error).message, NAO_DEU));
        setContas([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const salvar = async () => {
    const novo = limiteValido(limite ?? LIMITE_MINIMO);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setErro(SEM_REDE);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const supabase = clienteNavegador();
      await salvarLimiteDeContas(supabase, novo);
      setLimite(novo);
      setLimiteSalvo(novo);
      toast.success("Limite salvo.");
    } catch (e) {
      setErro(traduzirErroAuth((e as Error).message, NAO_DEU));
    } finally {
      setSalvando(false);
    }
  };

  const quantas = contas?.length ?? 0;
  const mudou = limite !== null && limiteSalvo !== null && limite !== limiteSalvo;

  return (
    <section className="flex flex-col gap-4">
      <CabecalhoMais
        titulo="Contas"
        descricao="Quem tem conta neste app e quantas contas cabem."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas</CardTitle>
          <CardDescription>
            {limiteSalvo === null ? (
              "Carregando…"
            ) : (
              <span className="text-foreground text-2xl font-semibold tabular-nums">
                {quantas} de {limiteSalvo}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contas === null ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : contas.length === 0 ? (
            <Vazio
              icone={Users}
              titulo="Nenhuma conta ainda"
              frase="Quem entrar pela tela de acesso aparece nesta lista."
            />
          ) : (
            <ul className="divide-border divide-y">
              {contas.map((conta) => (
                <li key={conta.email} className="flex flex-col gap-0.5 py-2">
                  <span className="text-sm font-medium break-all">
                    {conta.email}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    criada em {formatarDataCompleta(conta.criada_em)} · último
                    acesso{" "}
                    {conta.ultimo_acesso
                      ? formatarData(conta.ultimo_acesso)
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limite de contas</CardTitle>
          <CardDescription>
            Quantas pessoas podem ter conta, contando a sua. Quem já tem conta
            continua entrando mesmo se o limite baixar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StepperNumerico
            valor={limite}
            aoMudar={(n) => setLimite(n)}
            minimo={LIMITE_MINIMO}
            maximo={LIMITE_MAXIMO}
            rotulo="Limite de contas"
            desabilitado={limiteSalvo === null}
          />

          {erro !== null ? (
            <p
              role="alert"
              className="border-destructive/40 text-destructive rounded-lg border px-3 py-2 text-sm text-balance"
            >
              {erro}
            </p>
          ) : null}

          <Button
            type="button"
            className="alvo h-12"
            disabled={salvando || limiteSalvo === null || !mudou}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs text-balance">
        Cada conta vê só os próprios treinos. Quem esquecer a senha fala com
        você: a troca é no painel do Supabase.
      </p>
    </section>
  );
}

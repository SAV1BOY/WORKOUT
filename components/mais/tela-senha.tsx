"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CabecalhoMais } from "@/components/mais/cabecalho";
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
import { traduzirErroAuth } from "@/lib/erros-auth";
import { MINIMO_DA_SENHA, conferirSenhaNova } from "@/lib/senha";
import { clienteNavegador } from "@/lib/supabase/client";

/** Quanto tempo o "Senha trocada." fica na tela antes de voltar para /mais. */
const VOLTA_MS = 1500;

const SEM_REDE = "Precisa de internet para trocar a senha.";
const NAO_DEU = "Não deu para trocar a senha agora. Tente de novo.";

/**
 * `/mais/senha` (SPEC §9): trocar a senha sem sair do app.
 *
 * A conta é criada direto no banco com uma senha temporária — o painel do
 * Supabase não está ao alcance de quem treina —, então esta é a tela do
 * primeiro acesso. Nada de e-mail e nada de "esqueci a senha": quem está aqui
 * já entrou.
 *
 * Diferente do resto do app, **isto não vai para a fila** (§8): a fila guarda
 * linha de tabela, e uma senha não pode ficar esperando no IndexedDB. Sem rede
 * a tela diz que precisa de internet e não chama nada.
 */
export function TelaSenha() {
  const router = useRouter();
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [trocada, setTrocada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const volta = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sair da tela antes dos 1,5 s não pode arrastar o router junto
  useEffect(() => {
    return () => {
      if (volta.current !== null) clearTimeout(volta.current);
    };
  }, []);

  const salvar = async () => {
    const problema = conferirSenhaNova(nova, repetida);
    if (problema !== null) {
      setErro(problema);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setErro(SEM_REDE);
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const { error } = await clienteNavegador().auth.updateUser({
        password: nova,
      });
      if (error) {
        setErro(traduzirErroAuth(error.message, NAO_DEU));
        return;
      }
      setNova("");
      setRepetida("");
      setTrocada(true);
      volta.current = setTimeout(() => router.push("/mais"), VOLTA_MS);
    } catch (e) {
      setErro(traduzirErroAuth((e as Error).message, NAO_DEU));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <CabecalhoMais
        titulo="Trocar senha"
        descricao="Vale a partir do próximo login, neste e em qualquer aparelho."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova senha</CardTitle>
          <CardDescription>
            Pelo menos {MINIMO_DA_SENHA} caracteres, digitada duas vezes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            `noValidate` de propósito: com `minLength` o navegador barra o
            envio e mostra um balão dele, em inglês no aparelho em inglês —
            quem decide e quem fala é `conferirSenhaNova`, em pt-BR.
          */}
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void salvar();
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="senha-nova">Nova senha</Label>
              <Input
                id="senha-nova"
                type="password"
                autoComplete="new-password"
                autoCapitalize="none"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                className="alvo h-12 text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="senha-repetida">Repetir a nova senha</Label>
              <Input
                id="senha-repetida"
                type="password"
                autoComplete="new-password"
                autoCapitalize="none"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                className="alvo h-12 text-base"
              />
            </div>

            {erro !== null ? (
              <p
                role="alert"
                className="border-destructive/40 text-destructive rounded-lg border px-3 py-2 text-sm text-balance"
              >
                {erro}
              </p>
            ) : null}
            {trocada ? (
              <p
                role="status"
                className="border-primary/40 bg-primary/10 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                Senha trocada.
              </p>
            ) : null}

            <Button type="submit" className="alvo h-12" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
            {trocada ? (
              <Button
                type="button"
                variant="outline"
                className="alvo h-12"
                onClick={() => router.push("/mais")}
              >
                Voltar
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs text-balance">
        A senha é do Supabase, não fica guardada neste aparelho. Se esquecer,
        troque de novo pelo painel do banco.
      </p>
    </section>
  );
}

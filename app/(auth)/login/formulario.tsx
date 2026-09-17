"use client";

import { useActionState, useState } from "react";
import { criarConta, entrar, type EstadoLogin } from "@/app/(auth)/login/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CADASTRO_FECHADO } from "@/lib/erros-auth";

const inicial: EstadoLogin = {};

/**
 * `comVaga` vem do servidor (SPEC §21.3): com vaga, os dois botões; sem vaga,
 * só "Entrar" e o recado de cadastro fechado. Quem já tem conta entra sempre —
 * a cota só fecha a porta de quem ainda não tem.
 */
export function FormularioLogin({
  avisoInicial,
  comVaga = true,
}: {
  avisoInicial?: string;
  comVaga?: boolean;
}) {
  const [estadoEntrar, acaoEntrar, entrando] = useActionState(entrar, inicial);
  const [estadoCriar, acaoCriar, criando] = useActionState(criarConta, inicial);

  const estado: EstadoLogin = {
    erro: estadoEntrar.erro ?? estadoCriar.erro,
    aviso: avisoInicial ?? estadoEntrar.aviso ?? estadoCriar.aviso,
    ok: estadoCriar.ok ?? estadoEntrar.ok,
  };
  const ocupado = entrando || criando;

  /*
   * Campos controlados de propósito: o React 19 dá `form.reset()` automático
   * quando uma ação de formulário termina, e com inputs não controlados um
   * "Criar conta" que falhou apagava o e-mail e a senha — o toque seguinte em
   * "Entrar" enviava o formulário vazio e não acontecia nada.
   */
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  return (
    <form className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="alvo h-12 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="alvo h-12 text-base"
        />
      </div>

      {estado.aviso ? (
        <p
          role="status"
          className="border-primary/40 bg-primary/10 text-foreground rounded-lg border px-3 py-2 text-sm"
        >
          {estado.aviso}
        </p>
      ) : null}
      {estado.erro ? (
        <p
          role="alert"
          className="border-destructive/40 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-muted-foreground text-sm">
          {estado.ok}
        </p>
      ) : null}

      <Button
        type="submit"
        formAction={acaoEntrar}
        disabled={ocupado}
        className="alvo h-12 w-full text-base"
      >
        {entrando ? "Entrando…" : "Entrar"}
      </Button>
      {comVaga ? (
        <Button
          type="submit"
          variant="outline"
          formAction={acaoCriar}
          disabled={ocupado}
          className="alvo h-12 w-full text-base"
        >
          {criando ? "Criando…" : "Criar conta"}
        </Button>
      ) : (
        <p
          role="status"
          className="text-muted-foreground border-border rounded-lg border border-dashed px-3 py-2 text-sm text-balance"
        >
          {CADASTRO_FECHADO}
        </p>
      )}
    </form>
  );
}

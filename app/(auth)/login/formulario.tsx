"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
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
  const [tentativa, setTentativa] = useState("entrar");
  const [estado, enviar, ocupado] = useActionState(
    async (anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> => {
      const semRede = { erro: "Sem rede: não dá para entrar agora. Tente de novo quando a conexão voltar." };
      if (!navigator.onLine) return semRede;
      try {
        const acao = dados.get("acao") === "criar" ? criarConta : entrar;
        return await acao(anterior, dados);
      } catch (erro) {
        // Redirecionamentos das ações do Next sobem normalmente.
        if (erro instanceof TypeError || !navigator.onLine) return semRede;
        throw erro;
      }
    },
    inicial,
  );
  const campoEmail = useRef<HTMLInputElement>(null);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  useEffect(() => {
    if (estado.erro) campoEmail.current?.focus();
  }, [estado]);

  /*
   * Campos controlados de propósito: o React 19 dá `form.reset()` automático
   * quando uma ação de formulário termina, e com inputs não controlados um
   * "Criar conta" que falhou apagava o e-mail e a senha — o toque seguinte em
   * "Entrar" enviava o formulário vazio e não acontecia nada.
   */
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          ref={campoEmail}
          aria-invalid={estado.erro ? true : undefined}
          aria-describedby={estado.erro ? "erro-login" : undefined}
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
        <div className="relative">
          <Input
            id="senha"
            aria-invalid={estado.erro ? true : undefined}
            aria-describedby={estado.erro ? "erro-login" : undefined}
            name="senha"
            type={senhaVisivel ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="alvo h-12 pr-14 text-base"
          />
          <button
            type="button"
            aria-pressed={senhaVisivel}
            aria-controls="senha"
            aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
            className="alvo absolute inset-y-0 right-0 flex w-12 items-center justify-center"
            onClick={() => setSenhaVisivel((visivel) => !visivel)}
          >
            {senhaVisivel ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        </div>
      </div>

      {(estado.aviso || avisoInicial) ? (
        <p
          role="status"
          className="border-primary/40 bg-primary/10 text-foreground rounded-lg border px-3 py-2 text-sm"
        >
          {estado.aviso ?? avisoInicial}
        </p>
      ) : null}
      {estado.erro ? (
        <p
          role="alert"
          id="erro-login"
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
        name="acao" value="entrar"
        onClick={() => setTentativa("entrar")}
        disabled={ocupado}
        className="alvo h-12 w-full text-base"
      >
        {ocupado && tentativa === "entrar" ? "Entrando…" : "Entrar"}
      </Button>
      {comVaga ? (
        <Button
          type="submit"
          variant="outline"
          name="acao" value="criar"
          onClick={() => setTentativa("criar")}
          disabled={ocupado}
          className="alvo h-12 w-full text-base"
        >
          {ocupado && tentativa === "criar" ? "Criando…" : "Criar conta"}
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

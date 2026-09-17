import { FormularioLogin } from "@/app/(auth)/login/formulario";
import { avisoDeConfiguracao, supabaseConfigurado } from "@/lib/env";
import { haVaga, vagasParaConta } from "@/lib/queries/contas";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Entrar — Treino do Terraço" };

// a cota é perguntada ao banco a cada visita: nada de HTML guardado
export const dynamic = "force-dynamic";

/**
 * Ainda cabe alguém? (SPEC §21.3)
 *
 * A pergunta é feita **no servidor**, com a chave anon — `vagas_para_conta()`
 * devolve só dois números e é a única função da cota liberada para o anon.
 * Qualquer tropeço (sem chaves, sem rede, função ainda não aplicada) responde
 * "sim": os dois botões aparecem e quem barra é o trigger. O "Entrar" nunca
 * depende disto.
 */
async function aindaCabeAlguem(): Promise<boolean> {
  if (!supabaseConfigurado()) return true;
  try {
    const supabase = await criarClienteServidor();
    return haVaga(await vagasParaConta(supabase));
  } catch {
    return true;
  }
}

export default async function Login() {
  const aviso = avisoDeConfiguracao();
  const comVaga = await aindaCabeAlguem();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Treino do Terraço
        </h1>
        <p className="text-muted-foreground text-sm">
          Entre com o seu e-mail ou crie a sua conta.
        </p>
      </header>

      <FormularioLogin avisoInicial={aviso} comVaga={comVaga} />

      {/* recado de quem instala o app, não de quem treina: só com o app sem chaves */}
      {aviso ? (
        <p className="text-muted-foreground text-xs">
          As chaves ficam em <code>.env.local</code> (veja{" "}
          <code>.env.local.example</code>).
        </p>
      ) : null}
    </main>
  );
}

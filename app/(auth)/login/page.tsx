import { FormularioLogin } from "@/app/(auth)/login/formulario";
import { avisoDeConfiguracao } from "@/lib/env";

export const metadata = { title: "Entrar — Treino do Terraço" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const aviso = avisoDeConfiguracao();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Treino do Terraço
        </h1>
        <p className="text-muted-foreground text-sm">
          App pessoal. Entre com o seu e-mail.
        </p>
      </header>

      {erro === "app-pessoal" ? (
        <p
          role="alert"
          className="border-destructive/40 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          Este app é pessoal.
        </p>
      ) : null}

      <FormularioLogin avisoInicial={aviso} />

      {/* recado de quem instala o app, não do Miguel: só com o app sem chaves */}
      {aviso ? (
        <p className="text-muted-foreground text-xs">
          As chaves ficam em <code>.env.local</code> (veja{" "}
          <code>.env.local.example</code>).
        </p>
      ) : null}
    </main>
  );
}

export const metadata = { title: "Sem conexão — Treino do Terraço" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Sem conexão</h1>
      <p className="text-muted-foreground text-balance">
        O treino continua: o que você registrar fica salvo no celular e sobe
        sozinho quando a rede voltar.
      </p>
    </main>
  );
}

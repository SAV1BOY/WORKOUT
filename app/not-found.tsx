import { Compass, Dumbbell, House, SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Tela não encontrada — Treino do Terraço" };

/**
 * A página de 404 do app (SPEC §22.9 item 6).
 *
 * Duas rotas chamam `notFound()` — `/explorar/[tipo]/[valor]` e
 * `/exercicios/[id]` — e não havia nenhuma `app/not-found.tsx` para receber:
 * um atalho guardado na tela de início, ou um link velho depois de o PWA se
 * atualizar, caía na tela crua do Next, em inglês e sem saída.
 *
 * As três saídas cobrem os três jeitos de ter chegado aqui: o atalho para o
 * treino, a vitrine e o catálogo.
 */
export default function NaoEncontrada() {
  return (
    <main className="pb-segura mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 pt-10 text-center">
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full"
      >
        <SearchX className="size-8" />
      </span>
      <h1 className="text-2xl font-semibold">Essa tela não existe mais.</h1>
      <p className="text-muted-foreground text-balance">
        O link pode ser de uma versão antiga do app, ou de um exercício que
        mudou de nome. O treino continua onde estava.
      </p>
      <div className="flex w-full flex-col gap-2 pt-2">
        <Button asChild className="alvo h-12 rounded-2xl text-base font-semibold">
          <Link href="/">
            <House aria-hidden="true" className="size-4" />
            Voltar para Hoje
          </Link>
        </Button>
        <Button asChild variant="outline" className="alvo h-12 rounded-2xl text-base">
          <Link href="/explorar">
            <Compass aria-hidden="true" className="size-4" />
            Ver o Explorar
          </Link>
        </Button>
        <Button asChild variant="outline" className="alvo h-12 rounded-2xl text-base">
          <Link href="/exercicios">
            <Dumbbell aria-hidden="true" className="size-4" />
            Ver os exercícios
          </Link>
        </Button>
      </div>
    </main>
  );
}

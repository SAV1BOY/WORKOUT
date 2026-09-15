import { ChevronRight, Dumbbell, HardDrive, SlidersHorizontal, User } from "lucide-react";
import Link from "next/link";
import { BotaoSair } from "@/components/botao-sair";

export const metadata = { title: "Mais — Treino do Terraço" };

const SECOES = [
  {
    href: "/mais/perfil",
    titulo: "Perfil",
    descricao: "Nome, altura, fase do programa e as semanas dos planos.",
    Icone: User,
  },
  {
    href: "/mais/equipamento",
    titulo: "Equipamento",
    descricao: "O que tem no terraço e o peso de cada barra.",
    Icone: Dumbbell,
  },
  {
    href: "/mais/preferencias",
    titulo: "Preferências",
    descricao: "Tema, som e vibração do timer, tela acesa, incrementos.",
    Icone: SlidersHorizontal,
  },
  {
    href: "/mais/backup",
    titulo: "Backup",
    descricao: "Exportar tudo num arquivo e importar de volta.",
    Icone: HardDrive,
  },
];

export default function Mais() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mais</h1>

      <nav aria-label="Ajustes">
        <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {SECOES.map(({ href, titulo, descricao, Icone }) => (
            <li key={href}>
              <Link
                href={href}
                className="alvo hover:bg-muted/50 flex min-h-16 items-center gap-3 px-3 py-3"
              >
                <Icone className="text-muted-foreground size-5 shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{titulo}</span>
                  <span className="text-muted-foreground text-xs text-balance">
                    {descricao}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground ml-auto size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <BotaoSair />

      <p className="text-muted-foreground text-center text-xs">
        Treino do Terraço · app pessoal
      </p>
    </section>
  );
}

import {
  ChevronRight,
  CircleHelp,
  Copyright,
  Dumbbell,
  HardDrive,
  KeyRound,
  SlidersHorizontal,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { BotaoSair } from "@/components/botao-sair";
import { LinhaSincronizacao } from "@/components/mais/linha-sincronizacao";

export const metadata = { title: "Mais — Treino do Terraço" };

interface Secao {
  href: string;
  titulo: string;
  descricao: string;
  Icone: LucideIcon;
}

const SECOES: Secao[] = [
  /* SPEC §20.1: a porta do guia de uso fica no topo, sempre disponível. */
  {
    href: "/mais/guia",
    titulo: "Como usar o app",
    descricao: "Todas as abas e funções, com o caminho até cada uma.",
    Icone: CircleHelp,
  },
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
    href: "/mais/creditos",
    titulo: "Créditos",
    descricao: "De onde vêm as ilustrações, o mapa muscular e as fotos.",
    Icone: Copyright,
  },
  {
    href: "/mais/backup",
    titulo: "Backup",
    descricao: "Exportar tudo num arquivo e importar de volta.",
    Icone: HardDrive,
  },
];

/* A conta fica separada dos ajustes: trocar a senha e sair mexem no login. */
const CONTA: Secao[] = [
  {
    href: "/mais/senha",
    titulo: "Trocar senha",
    descricao: "Troque a senha temporária pela sua, sem sair do app.",
    Icone: KeyRound,
  },
];

export default function Mais() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mais</h1>

      <nav aria-label="Ajustes">
        <Lista secoes={SECOES} />
      </nav>

      <LinhaSincronizacao />

      <section aria-labelledby="titulo-conta" className="flex flex-col gap-2">
        <h2
          id="titulo-conta"
          className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase"
        >
          Conta
        </h2>
        <nav aria-label="Conta">
          <Lista secoes={CONTA} />
        </nav>
        <BotaoSair />
      </section>

      <p className="text-muted-foreground text-center text-xs">
        Treino do Terraço · app pessoal
      </p>
    </section>
  );
}

function Lista({ secoes }: { secoes: Secao[] }) {
  return (
    <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {secoes.map(({ href, titulo, descricao, Icone }) => (
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
  );
}

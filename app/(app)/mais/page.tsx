import {
  ChevronRight,
  CircleHelp,
  Copyright,
  Dumbbell,
  HardDrive,
  KeyRound,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { BotaoSair } from "@/components/botao-sair";
import { LinhaSincronizacao } from "@/components/mais/linha-sincronizacao";
import { ehDono } from "@/lib/env";
import { emailDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Mais — Treino do Terraço" };
// a lista muda conforme quem está logado (a linha Contas é só do dono)
export const dynamic = "force-dynamic";

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

/* Só o dono (SPEC §21.3): administrar a cota de contas do app. */
const CONTAS: Secao = {
  href: "/mais/contas",
  titulo: "Contas",
  descricao: "Quem tem conta no app e quantas contas cabem.",
  Icone: Users,
};

/* A conta fica separada dos ajustes: trocar a senha e sair mexem no login. */
const CONTA: Secao[] = [
  {
    href: "/mais/senha",
    titulo: "Trocar senha",
    descricao: "Troque a senha temporária pela sua, sem sair do app.",
    Icone: KeyRound,
  },
];

export default async function Mais() {
  // o e-mail vem do servidor: o cliente não decide quem é o dono
  const dono = ehDono(await emailDoUsuario());
  const ajustes = dono ? [...SECOES, CONTAS] : SECOES;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mais</h1>

      <nav aria-label="Ajustes">
        <Lista secoes={ajustes} />
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

      {/* SPEC §21: o app deixou de ser de um usuário só — o rodapé também */}
      <p className="text-muted-foreground text-center text-xs">
        Treino do Terraço · cada conta vê só os próprios treinos
      </p>
    </section>
  );
}

function Lista({ secoes }: { secoes: Secao[] }) {
  return (
    <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-lg border">
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

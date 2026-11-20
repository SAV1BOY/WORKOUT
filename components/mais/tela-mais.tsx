import {
  Bell,
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
import { UsoNoCelular } from "@/components/mais/uso-no-celular";
import { LinhaSincronizacao } from "@/components/mais/linha-sincronizacao";
import { LINHA_LEMBRETES } from "@/lib/lembretes";

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
    descricao: "Tema, som e vibração no fim do descanso, tela acesa, incrementos.",
    Icone: SlidersHorizontal,
  },
  /* SPEC §23.4: título e descrição da mesma fonte que o guia de uso. */
  { ...LINHA_LEMBRETES, Icone: Bell },
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
    descricao: "Defina uma senha nova, sem sair do app.",
    Icone: KeyRound,
  },
];

export function TelaMais({ userId, dono = false }: { userId: string | null; dono?: boolean }) {
  const ajustes = dono ? [...SECOES, CONTAS] : SECOES;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mais</h1>

      <nav aria-label="Ajustes">
        <Lista secoes={ajustes} />
      </nav>

      {userId && <LinhaSincronizacao key={userId} userId={userId} />}
      <UsoNoCelular />

      <section aria-labelledby="titulo-conta" className="flex flex-col gap-2">
        <h2
          id="titulo-conta"
          className="text-muted-foreground px-1 text-rotulo tracking-wide uppercase"
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
    <ul className="border-border bg-card overflow-hidden rounded-lg border">
      {secoes.map(({ href, titulo, descricao, Icone }) => (
        <li key={href} className="relative not-last:after:pointer-events-none not-last:after:absolute not-last:after:right-0 not-last:after:bottom-0 not-last:after:left-11 not-last:after:border-b">
          {/*
            O anel de foco é INTERNO (−4 px): a lista tem `overflow-hidden`
            (os cantos arredondados), e o anel de fora, a +2 px, saía cortado
            dos lados de toda linha — medido na linha Lembretes (SPEC §23.4).
          */}
          <Link
            href={href}
            prefetch={false}
            className="alvo hover:bg-muted/50 flex min-h-16 items-start gap-3 px-3 py-3 focus-visible:-outline-offset-4"
          >
            <Icone aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{titulo}</span>
              <span className="text-muted-foreground text-xs text-balance">
                {descricao}
              </span>
            </span>
            <ChevronRight className="text-muted-foreground ml-auto size-5 shrink-0 self-center" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

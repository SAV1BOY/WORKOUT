/**
 * Guia de uso (SPEC §20): os dados da tela `/mais/guia`.
 *
 * Funções puras e dados tipados — **sem React, sem Supabase, sem Dexie**. A
 * tela (`components/mais/guia.tsx`) só desenha o que está aqui.
 *
 * O texto é **copy de interface**: os nomes das funções são os rótulos reais
 * das telas, com a mesma grafia, e o caminho é o caminho real. Nada vem do
 * `docs/` (o guia de treino) e nada é inventado: o que não existe no app não
 * aparece aqui.
 *
 * Os rótulos das abas saem de `lib/abas.ts` — a mesma lista que a barra de
 * baixo desenha —, nunca redigitados.
 */
import { ABAS, type Aba } from "@/lib/abas";

/** Uma função do app dentro de uma seção do guia. */
export interface FuncaoDoGuia {
  /** Único dentro da seção (vira `key` e id de teste). */
  id: string;
  /** O rótulo real da tela ("Começar treino", "Não vou treinar hoje"). */
  nome: string;
  /** Uma frase do que ela faz. */
  oQueFaz: string;
  /** O caminho até ela, em chips: `["Mais", "Preferências", "Dias de treino"]`. */
  caminho: readonly string[];
  /** A rota (com âncora quando existe). Sem rota = função de dentro de um fluxo. */
  href?: string;
  /** Um detalhe que não cabe na frase (instruções de instalação, por exemplo). */
  nota?: string;
  /** Subtítulo do bloco a que ela pertence, dentro da seção. */
  grupo?: string;
}

/** Nomes de ícones lucide usados pelas seções (resolvidos na tela). */
export type IconeDaSecao =
  | "ListChecks"
  | "LayoutGrid"
  | "CalendarDays"
  | "WifiOff"
  | "Dumbbell"
  | "Compass"
  | "ChartLine"
  | "PersonStanding"
  | "Ellipsis";

export interface SecaoDoGuia {
  /** A âncora do índice de chips (`#treino`). */
  id: string;
  /** O nome da seção — nas abas, o rótulo de `lib/abas.ts`. */
  titulo: string;
  /** O rótulo curto do chip do índice. */
  chip: string;
  icone: IconeDaSecao;
  /** Uma frase de "para que serve". */
  resumo: string;
  /** A rota da tela, quando a seção é uma tela. */
  href?: string;
  funcoes: readonly FuncaoDoGuia[];
}

/** A aba de `lib/abas.ts` pelo href (o guia não redigita rótulo de aba). */
function aba(href: string): Aba {
  const achada = ABAS.find((a) => a.href === href);
  if (!achada) throw new Error(`guia: aba desconhecida ${href}`);
  return achada;
}

/** Uma frase por aba, para a miniatura da barra (SPEC §20.4). */
const FRASE_DA_ABA: Readonly<Record<string, string>> = {
  "/": "O treino de hoje, a semana e a lista de exercícios.",
  "/explorar": "Buscar exercícios e montar sessões fora do programa.",
  "/relatorio": "Quanto você já fez: números, conquistas e histórico.",
  "/corpo": "Peso, medidas e fotos de progresso.",
  "/mais": "Perfil, equipamento, preferências, backup e conta.",
};

/* ------------------------------------------------- 1. primeiros passos */

const PRIMEIROS_PASSOS: SecaoDoGuia = {
  id: "primeiros-passos",
  titulo: "Primeiros passos",
  chip: "Começar",
  icone: "ListChecks",
  resumo: "Quatro coisas antes do primeiro treino. Dá para fazer em 5 minutos.",
  funcoes: [
    {
      id: "dias",
      nome: "Marcar os dias de treino",
      oQueFaz:
        "Escolha em que dias da semana você treina. O app distribui força e cardio por eles e usa isso na faixa da semana, na meta e no calendário.",
      caminho: ["Mais", "Preferências", "Dias de treino"],
      href: "/mais/preferencias#dias-de-treino",
    },
    {
      id: "equipamento",
      nome: "Conferir o equipamento",
      oQueFaz:
        "Veja o que tem no terraço e coloque cada barra na balança: a carga que o app manda só fecha se o peso da barra estiver certo.",
      caminho: ["Mais", "Equipamento"],
      href: "/mais/equipamento",
    },
    {
      id: "instalar",
      nome: "Instalar o app no celular",
      oQueFaz:
        "Instalado, ele abre como aplicativo, em tela cheia, e funciona sem internet.",
      caminho: ["Navegador", "Instalar"],
      nota:
        "Android: menu do Chrome (⋮) → “Instalar app”. iPhone: Safari → Compartilhar → “Adicionar à Tela de Início”.",
    },
    {
      id: "primeiro-treino",
      nome: "Começar o primeiro treino",
      oQueFaz:
        "O card do dia monta a sessão com a carga de cada exercício e abre o player.",
      caminho: ["Treino", "Começar treino"],
      href: "/",
    },
  ],
};

/* ------------------------------------------------------ 2. as 5 abas */

const BARRA: SecaoDoGuia = {
  id: "abas",
  titulo: "A barra de abas",
  chip: "Abas",
  icone: "LayoutGrid",
  resumo:
    "Cinco abas, sempre no rodapé. Só o player some com elas — ali a saída é o ícone de lista.",
  funcoes: ABAS.map((a) => ({
    id: a.rotulo.toLowerCase(),
    nome: a.rotulo,
    oQueFaz: FRASE_DA_ABA[a.href] ?? "",
    caminho: [a.rotulo],
    href: a.href,
  })),
};

/* ---------------------------------------------------------- 3. Treino */

const TELA = "A tela";
const PLAYER = "No player";
const CARDIO = "Cardio";
const FIXA = "Barra fixa";

const TREINO: SecaoDoGuia = {
  id: "treino",
  titulo: aba("/").rotulo,
  chip: aba("/").rotulo,
  icone: "Dumbbell",
  resumo:
    "O que fazer hoje. É a tela que abre quando você entra no app.",
  href: "/",
  funcoes: [
    {
      id: "saudacao",
      nome: "Saudação e sequência",
      oQueFaz:
        "O dia de hoje no topo e, ao lado, há quantas semanas seguidas você fecha a meta.",
      caminho: ["Treino"],
      grupo: TELA,
    },
    {
      id: "faixa",
      nome: "Faixa da semana",
      oQueFaz:
        "Segunda a domingo com a sigla do treino de cada dia (A, B, Corr., Desc.) e ✓ no que já foi feito. Tocar na faixa abre o calendário.",
      caminho: ["Treino", "faixa da semana", "Calendário"],
      href: "/calendario",
      grupo: TELA,
    },
    {
      id: "meta",
      nome: "Meta semanal",
      oQueFaz:
        "Quantas sessões da semana já foram, com a barra de progresso. O número se muda nas Preferências.",
      caminho: ["Treino", "Meta semanal"],
      href: "/mais/preferencias#meta",
      grupo: TELA,
    },
    {
      id: "fase-peso",
      nome: "Fase e Peso",
      oQueFaz:
        "Duas caixas: a fase do programa com a semana em que você está, e o seu último peso registrado.",
      caminho: ["Treino"],
      grupo: TELA,
    },
    {
      id: "pesar",
      nome: "Pesar",
      oQueFaz:
        "Quando o peso está velho, aparece o atalho para registrar o de hoje na aba Corpo.",
      caminho: ["Treino", "Pesar"],
      href: "/corpo",
      grupo: TELA,
    },
    {
      id: "comecar",
      nome: "Começar treino",
      oQueFaz:
        "No dia de força, o card do treino de hoje. O botão cria a sessão com a carga certa e já entra no player.",
      caminho: ["Treino", "Começar treino"],
      grupo: TELA,
    },
    {
      id: "continuar",
      nome: "Continuar",
      oQueFaz:
        "Saiu no meio do treino? O card vira “Continuar” e o player volta na série em que você parou. Uma sessão de outro dia aparece numa faixa, com Continuar e Descartar.",
      caminho: ["Treino", "Continuar"],
      grupo: TELA,
    },
    {
      id: "card-cardio",
      nome: "Card de cardio",
      oQueFaz:
        "No dia de corrida ou de corda, o card da sessão da semana do plano, com “Começar”.",
      caminho: ["Treino", "Começar"],
      grupo: TELA,
    },
    {
      id: "corda-em-vez",
      nome: "Fazer corda em vez de corrida",
      oQueFaz:
        "No dia de corrida, o card troca para a sessão de corda da mesma semana — e volta quando você quiser.",
      caminho: ["Treino", "Fazer corda em vez de corrida"],
      grupo: TELA,
    },
    {
      id: "card-descanso",
      nome: "Card de descanso",
      oQueFaz:
        "No dia de folga, a nota do dia e qual é o próximo treino.",
      caminho: ["Treino"],
      grupo: TELA,
    },
    {
      id: "caminhada",
      nome: "Começar caminhada leve",
      oQueFaz:
        "No domingo o programa pede uma caminhada; o botão do card de descanso abre o cronômetro dela.",
      caminho: ["Treino", "Começar caminhada leve"],
      grupo: TELA,
    },
    {
      id: "soltas",
      nome: "Repetições soltas",
      oQueFaz:
        "O botão +1 soma uma barra fixa avulsa no dia, sem abrir sessão. O histórico dos 14 dias fica na tela Barra fixa.",
      caminho: ["Treino", "+1"],
      href: "/barra-fixa",
      grupo: TELA,
    },
    {
      id: "mesmo-assim",
      nome: "Treinar mesmo assim",
      oQueFaz:
        "No dia de descanso ou de cardio, faz o próximo treino de força sem bagunçar a ordem do programa.",
      caminho: ["Treino", "Treinar mesmo assim"],
      grupo: TELA,
    },
    {
      id: "lista",
      nome: "Lista de exercícios de hoje",
      oQueFaz:
        "Cada exercício com as séries e a carga que o app calculou para hoje. Tocar abre a ficha numa folha: passos, erro comum, músculos e Ilustração · Figura · Fotos.",
      caminho: ["Treino", "exercício"],
      grupo: TELA,
    },
    {
      id: "substituir",
      nome: "⇄ Substituir",
      oQueFaz:
        "Troca um exercício por outro parecido — só no treino de hoje; amanhã volta o do programa.",
      caminho: ["Treino", "exercício", "⇄"],
      grupo: TELA,
    },
    {
      id: "editar",
      nome: "Editar",
      oQueFaz:
        "Muda a ordem dos exercícios da sessão que vai começar, e volta à ordem do programa quando você quiser.",
      caminho: ["Treino", "Editar"],
      grupo: TELA,
    },
    {
      id: "ajustar",
      nome: "Ajustar",
      oQueFaz:
        "O botão redondo abre os ajustes do treino: preparação, descanso padrão, som, vibração, tela acesa e os “não gosto”. Vale para todos os treinos.",
      caminho: ["Treino", "Ajustar"],
      href: "/mais/preferencias#treino",
      grupo: TELA,
    },
    {
      id: "personalizar",
      nome: "Personalizar treino",
      oQueFaz:
        "Monta uma sessão só sua, escolhendo exercícios do catálogo pelo nome.",
      caminho: ["Treino", "Personalizar treino"],
      grupo: TELA,
    },
    {
      id: "parte-do-corpo",
      nome: "Parte do corpo em foco",
      oQueFaz:
        "Escolha o grupo nos chips, filtre por tempo ou equipamento e o “Começar” abre uma sessão livre com os exercícios da lista.",
      caminho: ["Treino", "Parte do corpo em foco"],
      grupo: TELA,
    },
    {
      id: "desafios",
      nome: "Desafios",
      oQueFaz:
        "Os três cards do carrossel — primeira barra fixa, corrida e a fase do programa — com a semana em que você está e o botão “Fazer a sessão da semana”.",
      caminho: ["Treino", "Desafios"],
      grupo: TELA,
    },
    {
      id: "retomada",
      nome: "Card de retomada",
      oQueFaz:
        "Depois de 7 dias ou mais sem registrar nada, o app pergunta como voltar: continuar, repetir a semana, voltar mais leve ou recomeçar do zero. Enquanto você não escolhe, ele segura o começo do treino.",
      caminho: ["Treino", "card de retomada"],
      grupo: TELA,
    },
    {
      id: "preparacao",
      nome: "Preparação",
      oQueFaz:
        "O player abre com uma contagem antes do primeiro exercício, com o nome dele e a ficha à mão. Dá para pular.",
      caminho: ["Treino", "Começar treino", "Player"],
      grupo: PLAYER,
    },
    {
      id: "serie",
      nome: "Série a série",
      oQueFaz:
        "Uma série por tela, com as repetições e a carga já preenchidas. “Concluir série” registra na hora, mesmo sem internet.",
      caminho: ["Player", "Concluir série"],
      grupo: PLAYER,
    },
    {
      id: "firme",
      nome: "Última repetição",
      oQueFaz:
        "Você diz se a última repetição saiu firme ou na raça. É isso que decide se a carga sobe no próximo treino.",
      caminho: ["Player", "Última repetição"],
      grupo: PLAYER,
    },
    {
      id: "falha",
      nome: "Quando a série falha",
      oQueFaz:
        "Não precisa de botão: digite as repetições que saíram de verdade. Abaixo do mínimo duas vezes seguidas, o app volta 10 % da carga sozinho.",
      caminho: ["Player", "repetições"],
      grupo: PLAYER,
    },
    {
      id: "carga-de-hoje",
      nome: "Carga de hoje",
      oQueFaz:
        "O seletor de kg muda o peso só desta série, e avisa quando o valor não fecha com as anilhas que você tem.",
      caminho: ["Player", "kg"],
      grupo: PLAYER,
    },
    {
      id: "descanso",
      nome: "Descanso",
      oQueFaz:
        "Entre as séries o descanso corre sozinho, com som e vibração se você quiser, e dá para pular.",
      caminho: ["Player", "Descanso"],
      grupo: PLAYER,
    },
    {
      id: "visao-geral",
      nome: "Visão geral do treino",
      oQueFaz:
        "O ícone de lista abre todas as séries da sessão: é por ali que se corrige qualquer uma e se encerra o treino.",
      caminho: ["Player", "Visão geral do treino"],
      grupo: PLAYER,
    },
    {
      id: "o-que-muda",
      nome: "O que muda no próximo treino",
      oQueFaz:
        "No fim, exercício por exercício, o que o app decidiu: subiu, repetiu ou voltou — e por quê.",
      caminho: ["Player", "Treino concluído"],
      grupo: PLAYER,
    },
    {
      id: "conclusao",
      nome: "Conclusão",
      oQueFaz:
        "Exercícios, minutos, recordes do dia, o peso de hoje (opcional) e, quando você fecha um marco, o aviso de conquista com “Ok”. O “Próximo” é quem grava a sessão.",
      caminho: ["Player", "Próximo"],
      grupo: PLAYER,
    },
    {
      id: "cardio-sessao",
      nome: "Sessão de corrida ou corda",
      oQueFaz:
        "A sessão da semana do plano, com os blocos que o guia manda (aquecer, correr, caminhar).",
      caminho: ["Treino", "Começar"],
      grupo: CARDIO,
    },
    {
      id: "timer-intervalos",
      nome: "Timer de intervalos",
      oQueFaz:
        "Conduz bloco por bloco, avisando a troca. Dá para pausar e retomar.",
      caminho: ["Treino", "Começar", "Timer de intervalos"],
      grupo: CARDIO,
    },
    {
      id: "cronometro",
      nome: "Cronômetro",
      oQueFaz:
        "Para a sessão livre, sem blocos: começa, pausa e retoma no seu ritmo.",
      caminho: ["Treino", "Começar", "Cronômetro"],
      grupo: CARDIO,
    },
    {
      id: "encerrar-cardio",
      nome: "Encerrar e registrar",
      oQueFaz:
        "No fim, você anota distância, saltos e como foi o esforço (teste da fala) e salva.",
      caminho: ["Treino", "Começar", "Encerrar e registrar"],
      grupo: CARDIO,
    },
    {
      id: "sessao-fixa",
      nome: "Fazer sessão de barra fixa",
      oQueFaz:
        "A sessão da semana do plano das 12 semanas, com a assistência certa (elástico, negativa, isometria).",
      caminho: ["Treino", "Desafios", "Barra fixa"],
      href: "/barra-fixa",
      grupo: FIXA,
    },
    {
      id: "soltas-tela",
      nome: "Repetições soltas (histórico)",
      oQueFaz:
        "O total de hoje, o da semana e a barrinha dos últimos 14 dias.",
      caminho: ["Barra fixa", "Repetições soltas"],
      href: "/barra-fixa",
      grupo: FIXA,
    },
  ],
};

/* -------------------------------------------------------- 4. Explorar */

const EXPLORAR: SecaoDoGuia = {
  id: "explorar",
  titulo: aba("/explorar").rotulo,
  chip: aba("/explorar").rotulo,
  icone: "Compass",
  resumo:
    "Tudo o que existe fora do treino de hoje: os 81 exercícios e as coleções prontas.",
  href: "/explorar",
  funcoes: [
    {
      id: "busca",
      nome: "Buscar exercício ou coleção",
      oQueFaz:
        "A busca do topo acha exercício e coleção pelo nome, com ou sem acento.",
      caminho: ["Explorar", "Buscar exercício ou coleção"],
      href: "/explorar",
    },
    {
      id: "destaque",
      nome: "Destaque de hoje",
      oQueFaz:
        "O card grande no topo é o treino de hoje (ou a sessão do plano da semana), com o botão para começar.",
      caminho: ["Explorar"],
    },
    {
      id: "escolhas",
      nome: "Escolhas para você",
      oQueFaz:
        "Cinco listas montadas a partir do programa: Treinos do programa, Parte do corpo, Circuitos, Por aparelho e Planos. Cada uma abre com “Ver todos”.",
      caminho: ["Explorar", "Escolhas para você"],
    },
    {
      id: "colecao",
      nome: "Começar (sessão livre)",
      oQueFaz:
        "Dentro de uma coleção, o “Começar” abre uma sessão livre com os exercícios dela — que registra e faz a carga progredir igual ao treino do programa.",
      caminho: ["Explorar", "coleção", "Começar"],
    },
    {
      id: "catalogo",
      nome: "Todos os exercícios",
      oQueFaz:
        "O catálogo inteiro, com filtro por grupo. A ficha de cada um traz passos, erro comum, músculos, Ilustração · Figura · Fotos e o seu histórico naquele exercício.",
      caminho: ["Explorar", "Todos os exercícios"],
      href: "/exercicios",
    },
  ],
};

/* ------------------------------------------------------- 5. Relatório */

const RELATORIO: SecaoDoGuia = {
  id: "relatorio",
  titulo: aba("/relatorio").rotulo,
  chip: aba("/relatorio").rotulo,
  icone: "ChartLine",
  resumo: "O que já foi feito e para onde a carga está indo.",
  href: "/relatorio",
  funcoes: [
    {
      id: "totais",
      nome: "Totais",
      oQueFaz: "Treinos, minutos e volume em kg, somados desde o começo.",
      caminho: ["Relatório"],
      href: "/relatorio",
    },
    {
      id: "numeros",
      nome: "Números",
      oQueFaz:
        "Quantos de cada coisa — força por treino, cardio por tipo, barra fixa, minutos e volume — em Semana, Mês ou Tudo.",
      caminho: ["Relatório", "Números", "Semana · Mês · Tudo"],
    },
    {
      id: "conquistas",
      nome: "Conquistas",
      oQueFaz:
        "Os marcos reais dos seus registros. Tocar numa abre a folha com a regra e o quanto falta.",
      caminho: ["Relatório", "Conquistas"],
    },
    {
      id: "historico",
      nome: "Histórico",
      oQueFaz:
        "A faixa da semana navegável e o que foi registrado em cada dia; “Todos os registros” abre a lista completa.",
      caminho: ["Relatório", "Histórico"],
    },
    {
      id: "sequencias",
      nome: "Sequências",
      oQueFaz: "Dias seguidos com alguma sessão e semanas seguidas com a meta.",
      caminho: ["Relatório", "Sequências"],
    },
    {
      id: "peso-imc",
      nome: "Peso e IMC",
      oQueFaz:
        "O peso mais recente e o IMC calculado com a sua altura, que dá para corrigir ali mesmo.",
      caminho: ["Relatório", "IMC"],
    },
    {
      id: "graficos",
      nome: "Gráficos e recordes",
      oQueFaz:
        "Carga dos grandes, volume semanal, barra fixa por semana, corrida, recordes recentes e a tabela de recordes por exercício.",
      caminho: ["Relatório"],
    },
  ],
};

/* ----------------------------------------------------------- 6. Corpo */

const CORPO: SecaoDoGuia = {
  id: "corpo",
  titulo: aba("/corpo").rotulo,
  chip: aba("/corpo").rotulo,
  icone: "PersonStanding",
  resumo: "Peso, fita métrica e as fotos de progresso.",
  href: "/corpo",
  funcoes: [
    {
      id: "peso",
      nome: "Peso",
      oQueFaz:
        "Registrar o peso do dia, ver o gráfico com a média de 7 dias, a variação por semana e definir uma meta (opcional).",
      caminho: ["Corpo", "Peso"],
      href: "/corpo",
    },
    {
      id: "medidas",
      nome: "Medidas",
      oQueFaz:
        "Cintura, peito, quadril, braços, coxas e panturrilha, com a evolução de cada uma.",
      caminho: ["Corpo", "Medidas"],
    },
    {
      id: "fotos",
      nome: "Fotos",
      oQueFaz:
        "Foto de frente, de lado e de costas, a galeria por data e o “Comparar”, que sobrepõe duas datas.",
      caminho: ["Corpo", "Fotos"],
    },
    {
      id: "imc",
      nome: "IMC",
      oQueFaz:
        "Calculado com o último peso e a sua altura; a altura se corrige no próprio card.",
      caminho: ["Corpo", "Peso", "IMC"],
    },
  ],
};

/* ------------------------------------------------------------ 7. Mais */

const MAIS: SecaoDoGuia = {
  id: "mais",
  titulo: aba("/mais").rotulo,
  chip: aba("/mais").rotulo,
  icone: "Ellipsis",
  resumo: "Os ajustes do app e a sua conta.",
  href: "/mais",
  funcoes: [
    {
      id: "guia",
      nome: "Como usar o app",
      oQueFaz: "Este guia. Ele fica aqui para sempre — volte quando quiser.",
      caminho: ["Mais", "Como usar o app"],
      href: "/mais/guia",
    },
    {
      id: "perfil",
      nome: "Perfil",
      oQueFaz:
        "Nome, altura, data de início, a fase do programa e a semana de cada plano (corrida, corda, barra fixa), com repetir e avançar.",
      caminho: ["Mais", "Perfil"],
      href: "/mais/perfil",
    },
    {
      id: "equipamento",
      nome: "Equipamento",
      oQueFaz:
        "O que tem no terraço, as anilhas e o peso de cada barra medido na balança — é isso que faz a carga fechar.",
      caminho: ["Mais", "Equipamento"],
      href: "/mais/equipamento",
    },
    {
      id: "tema",
      nome: "Tema",
      oQueFaz: "Claro, escuro ou automático (segue o celular).",
      caminho: ["Mais", "Preferências", "Tema"],
      href: "/mais/preferencias#tema",
    },
    {
      id: "dias-de-treino",
      nome: "Dias de treino",
      oQueFaz:
        "Sete chips: em que dias você treina. O app redistribui força e cardio por eles.",
      caminho: ["Mais", "Preferências", "Dias de treino"],
      href: "/mais/preferencias#dias-de-treino",
    },
    {
      id: "meta-semanal",
      nome: "Meta semanal",
      oQueFaz:
        "Quantas sessões contam como semana cumprida. Vazio = o padrão da fase.",
      caminho: ["Mais", "Preferências", "Meta semanal"],
      href: "/mais/preferencias#meta",
    },
    {
      id: "treino-player",
      nome: "Treino",
      oQueFaz:
        "Como o player se comporta: preparação, descanso padrão, avançar sozinho, som, vibração, voz no cardio, manter a tela acesa, raios de dificuldade e os “não gosto”.",
      caminho: ["Mais", "Preferências", "Treino"],
      href: "/mais/preferencias#treino",
    },
    {
      id: "incrementos",
      nome: "Incremento por exercício",
      oQueFaz:
        "Quanto a carga sobe quando o treino fecha no topo da faixa. Vazio = o valor do programa.",
      caminho: ["Mais", "Preferências", "Incremento por exercício"],
      href: "/mais/preferencias#incrementos",
    },
    {
      id: "creditos",
      nome: "Créditos",
      oQueFaz:
        "Autor, licença e link de cada ilustração, do mapa muscular e das fotos.",
      caminho: ["Mais", "Créditos"],
      href: "/mais/creditos",
    },
    {
      id: "backup",
      nome: "Backup",
      oQueFaz:
        "Exportar tudo num arquivo e importar de volta. Importar o mesmo arquivo duas vezes não duplica nada.",
      caminho: ["Mais", "Backup"],
      href: "/mais/backup",
    },
    {
      id: "contas",
      nome: "Contas (só o dono)",
      oQueFaz:
        "Quem tem conta no app, quando cada uma foi criada e quantas cabem no total. O limite se muda ali mesmo.",
      caminho: ["Mais", "Contas"],
      href: "/mais/contas",
    },
  ],
};

/* ----------------------------------------------------- 8. Calendário */

const CALENDARIO: SecaoDoGuia = {
  id: "calendario",
  titulo: "Calendário",
  chip: "Calendário",
  icone: "CalendarDays",
  resumo:
    "Não é uma aba: chega-se por ela tocando na faixa da semana, na aba Treino.",
  href: "/calendario",
  funcoes: [
    {
      id: "semana",
      nome: "A semana em lista",
      oQueFaz:
        "Um dia por linha, com o treino (“Treino A · semana 3”) e a marca: ✓ feito, ponto planejado, cinza perdido.",
      caminho: ["Treino", "faixa da semana", "Calendário"],
      href: "/calendario",
    },
    {
      id: "resumo",
      nome: "Resumo da semana",
      oQueFaz: "A linha “N feitos · N a fazer · N perdidos”, acima da lista.",
      caminho: ["Calendário"],
    },
    {
      id: "mes",
      nome: "Mês em miniatura",
      oQueFaz: "O mês inteiro em pontinhos, abaixo da semana.",
      caminho: ["Calendário"],
    },
    {
      id: "tocar",
      nome: "Tocar num dia",
      oQueFaz:
        "Num dia passado, o resumo do que foi feito (e o atalho para abrir o treino). Em hoje ou no futuro, a troca do dia: outro treino, cardio ou descanso.",
      caminho: ["Calendário", "dia"],
    },
    {
      id: "nao-vou",
      nome: "Não vou treinar hoje",
      oQueFaz:
        "Reorganiza o resto da semana a partir de hoje, dizendo antes o que muda e o que fica de fora.",
      caminho: ["Calendário", "Não vou treinar hoje"],
    },
    {
      id: "meus-dias",
      nome: "Meus dias",
      oQueFaz: "Atalho direto para o card “Dias de treino” das Preferências.",
      caminho: ["Calendário", "Meus dias"],
      href: "/mais/preferencias#dias-de-treino",
    },
    {
      id: "navegar",
      nome: "Setas e “Hoje”",
      oQueFaz: "As setas andam de semana em semana; “Hoje” volta para esta.",
      caminho: ["Calendário", "Hoje"],
    },
  ],
};

/* --------------------------------------------- 9. sem internet e conta */

const OFFLINE: SecaoDoGuia = {
  id: "offline",
  titulo: "Sem internet e conta",
  chip: "Offline e conta",
  icone: "WifiOff",
  resumo:
    "O app é feito para o terraço, onde o sinal cai. Nada do que você digita se perde.",
  funcoes: [
    {
      id: "offline",
      nome: "Treinar sem internet",
      oQueFaz:
        "Instalado, o app abre e funciona offline: cada série digitada é gravada no próprio celular na hora.",
      caminho: ["Treino", "Começar treino", "Player"],
    },
    {
      id: "fila",
      nome: "Fila de envio",
      oQueFaz:
        "O que ainda não subiu fica numa fila e sobe sozinho quando a rede volta. A linha em Mais mostra quantos itens faltam e tem o “Tentar agora”.",
      caminho: ["Mais", "Sincronização", "Tentar agora"],
      href: "/mais",
    },
    {
      id: "criar-conta",
      nome: "Criar conta",
      oQueFaz:
        "Na tela de login, quem ainda não tem conta cria a sua com e-mail e senha e entra na hora. Enquanto houver vaga: o app tem um limite de contas.",
      caminho: ["Login", "Criar conta"],
    },
    {
      id: "senha",
      nome: "Trocar senha",
      oQueFaz: "Troca a senha sem sair do app.",
      caminho: ["Mais", "Conta", "Trocar senha"],
      href: "/mais/senha",
    },
    {
      id: "sair",
      nome: "Sair",
      oQueFaz:
        "Encerra a sessão neste aparelho. Se ainda houver coisa na fila, ele avisa antes.",
      caminho: ["Mais", "Conta", "Sair"],
      href: "/mais",
    },
  ],
};

/** As seções do guia, na ordem em que aparecem (SPEC §20.4). */
export const SECOES: readonly SecaoDoGuia[] = [
  PRIMEIROS_PASSOS,
  BARRA,
  TREINO,
  EXPLORAR,
  RELATORIO,
  CORPO,
  MAIS,
  CALENDARIO,
  OFFLINE,
];

/** As abas, para a miniatura da barra (a mesma lista da barra de baixo). */
export const ABAS_DO_GUIA = ABAS;

/** Uma seção pelo id da âncora. */
export function secaoDoGuia(id: string): SecaoDoGuia | null {
  return SECOES.find((s) => s.id === id) ?? null;
}

/** Todos os destinos do guia (seções e funções), sem repetir. */
export function hrefsDoGuia(): string[] {
  const todos: string[] = [];
  for (const secao of SECOES) {
    if (secao.href) todos.push(secao.href);
    for (const funcao of secao.funcoes) {
      if (funcao.href) todos.push(funcao.href);
    }
  }
  return [...new Set(todos)];
}

/** O caminho sem a âncora e sem a query ("/mais/preferencias#tema" → "/mais/preferencias"). */
export function rotaDoHref(href: string): string {
  return href.split("#")[0]!.split("?")[0]!;
}

/** Os blocos de uma seção, na ordem, com o subtítulo (ou `null` no bloco solto). */
export function blocosDaSecao(
  secao: SecaoDoGuia,
): { grupo: string | null; funcoes: FuncaoDoGuia[] }[] {
  const blocos: { grupo: string | null; funcoes: FuncaoDoGuia[] }[] = [];
  for (const funcao of secao.funcoes) {
    const grupo = funcao.grupo ?? null;
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.grupo === grupo) ultimo.funcoes.push(funcao);
    else blocos.push({ grupo, funcoes: [funcao] });
  }
  return blocos;
}

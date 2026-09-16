/**
 * Dias de treino escolhidos pelo usuário (SPEC §17) — funções puras, sem React
 * nem Supabase.
 *
 * O usuário marca em quais dias da semana vai treinar
 * (`profiles.prefs.dias_de_treino`) e `semanaPersonalizada()` monta a semana no
 * MESMO formato de `programa.fases[fase].semana`: força primeiro nas
 * quantidades da fase, cardio nos dias que sobram, dia livre no resto. Todo o
 * conteúdo (nomes de treino, sessões de cardio, minutos, notas de descanso) sai
 * do `programa.json` — nada é escrito aqui.
 *
 * Sem a preferência, a semana é a do JSON tal como está: quem não mexer não vê
 * diferença nenhuma.
 */
import { acharExercicio, acharFase, acharTreino, DIAS } from "@/lib/dados";
import type { DiaPrograma, DiaSemana, FaseId, TreinoId } from "@/lib/schemas";
import type { Prefs } from "@/lib/types";

/** A chave do jsonb onde a escolha mora. */
export const CHAVE_DIAS = "dias_de_treino";

/** Os sete dias com o nome que vai na tela (SPEC §17.1). */
export const ROTULO_DO_DIA: Record<DiaSemana, string> = {
  seg: "seg",
  ter: "ter",
  qua: "qua",
  qui: "qui",
  sex: "sex",
  sab: "sáb",
  dom: "dom",
};

/** "segunda-feira" — o que o leitor de tela lê no chip. */
export const NOME_DO_DIA: Record<DiaSemana, string> = {
  seg: "segunda-feira",
  ter: "terça-feira",
  qua: "quarta-feira",
  qui: "quinta-feira",
  sex: "sexta-feira",
  sab: "sábado",
  dom: "domingo",
};

/* ------------------------------------------------------------ as prefs */

function ehDia(v: unknown): v is DiaSemana {
  return typeof v === "string" && (DIAS as readonly string[]).includes(v);
}

/** Põe os dias na ordem da semana e tira repetição. */
export function ordenarDias(dias: readonly DiaSemana[]): DiaSemana[] {
  return DIAS.filter((d) => dias.includes(d));
}

/**
 * Os dias escolhidos em `prefs.dias_de_treino`, ou `null` quando a preferência
 * não existe (= vale a semana do programa). O jsonb vem do banco e de um backup
 * importado, então nada aqui confia no formato: só sobram dias conhecidos.
 * Uma lista vazia é uma escolha legítima (nenhum dia de treino).
 */
export function diasDeTreinoDasPrefs(
  prefs: Prefs | null | undefined,
): DiaSemana[] | null {
  const bruto = prefs?.[CHAVE_DIAS];
  if (!Array.isArray(bruto)) return null;
  return ordenarDias(bruto.filter(ehDia));
}

/** Grava a escolha (ou apaga, com `null`, voltando ao padrão do programa). */
export function comDiasDeTreino(
  prefs: Prefs | null | undefined,
  dias: readonly DiaSemana[] | null,
): Prefs {
  const resto = { ...(prefs ?? {}) };
  if (dias === null) {
    delete resto[CHAVE_DIAS];
    return resto;
  }
  return { ...resto, [CHAVE_DIAS]: ordenarDias(dias) };
}

/* -------------------------------------------------- o que o programa diz */

/** Os dias em que a fase treina força no `programa.json`. */
export function diasDeForcaDoPrograma(fase: FaseId): DiaSemana[] {
  return acharFase(fase)
    .semana.filter((d) => d.tipo === "forca")
    .map((d) => d.dia);
}

/** Os dias em que a fase faz cardio no `programa.json`. */
export function diasDeCardioDoPrograma(fase: FaseId): DiaSemana[] {
  return acharFase(fase)
    .semana.filter((d) => d.tipo === "cardio")
    .map((d) => d.dia);
}

/**
 * Os dias que os chips já trazem marcados: os que a fase usa (força + cardio).
 * Escolher exatamente estes reproduz a semana do JSON (SPEC §17.1).
 */
export function diasPadraoDaFase(fase: FaseId): DiaSemana[] {
  return acharFase(fase)
    .semana.filter((d) => d.tipo === "forca" || d.tipo === "cardio")
    .map((d) => d.dia);
}

/**
 * A fase pede folga entre os treinos de força? É o que a própria semana do
 * programa diz: a Fase 1 (corpo inteiro, 48 h do guia) não tem dois dias de
 * força seguidos; a Fase 2 alterna superior e inferior e põe seg-ter e qui-sex.
 */
export function faseExigeFolga(fase: FaseId): boolean {
  const forca = diasDeForcaDoPrograma(fase);
  return consecutivos(forca) === 0;
}

/** As sessões de cardio da fase, na ordem do programa. */
function cardiosDoPrograma(fase: FaseId): DiaPrograma[] {
  return acharFase(fase).semana.filter((d) => d.tipo === "cardio");
}

/** Os minutos dos dias de força da fase, na ordem do programa. */
function minutosDeForca(fase: FaseId): (number | undefined)[] {
  return acharFase(fase)
    .semana.filter((d) => d.tipo === "forca")
    .map((d) => d.min);
}

/**
 * As notas dos dias de descanso do programa, na ordem: o lembrete da barra
 * fixa e a caminhada leve (SPEC §17.2 item 4). A Fase 2 não as tem escritas na
 * sua semana — ali valem as da Fase 1, que é de onde o guia as tirou.
 */
function notasDeDescanso(fase: FaseId): string[] {
  const daFase = acharFase(fase)
    .semana.filter((d) => d.tipo === "descanso")
    .map((d) => d.nota ?? "")
    .filter((n) => n.trim() !== "");
  if (daFase.length > 0) return daFase;
  return acharFase("fase1")
    .semana.filter((d) => d.tipo === "descanso")
    .map((d) => d.nota ?? "")
    .filter((n) => n.trim() !== "");
}

/** Os treinos da fase que têm agachamento ou terra (SPEC §5.4). */
function treinosPesados(fase: FaseId): TreinoId[] {
  const pesado = /^agachamento|terra/i;
  return acharFase(fase).treinos.filter((id) =>
    acharTreino(id).exercicios.some((e) =>
      pesado.test(acharExercicio(e.exercicio_id).nome),
    ),
  );
}

/* ------------------------------------------------------- a distribuição */

/** Quantos pares de dias consecutivos no calendário há nesta lista. */
function consecutivos(dias: readonly DiaSemana[]): number {
  const idx = dias.map((d) => DIAS.indexOf(d)).sort((a, b) => a - b);
  let n = 0;
  for (let i = 1; i < idx.length; i += 1) {
    if ((idx[i] as number) - (idx[i - 1] as number) === 1) n += 1;
  }
  return n;
}

/** Quantos dias desta lista estão também naquela. */
function coincidencias(
  dias: readonly DiaSemana[],
  alvo: readonly DiaSemana[],
): number {
  return dias.filter((d) => alvo.includes(d)).length;
}

/** A "altura" da lista na semana: quanto mais cedo, menor (desempate). */
function peso(dias: readonly DiaSemana[]): number {
  return dias.reduce((soma, d) => soma + DIAS.indexOf(d), 0);
}

/** Todas as combinações de `k` dias, mantendo a ordem da semana. */
function combinacoes(dias: readonly DiaSemana[], k: number): DiaSemana[][] {
  if (k <= 0) return [[]];
  if (k > dias.length) return [];
  if (k === dias.length) return [[...dias]];
  const [primeiro, ...resto] = dias;
  if (!primeiro) return [];
  return [
    ...combinacoes(resto, k - 1).map((c) => [primeiro, ...c]),
    ...combinacoes(resto, k),
  ];
}

/** Escolhe a combinação de menor custo; empate fica com a primeira. */
function melhor(
  opcoes: DiaSemana[][],
  custo: (c: DiaSemana[]) => number[],
): DiaSemana[] {
  let campea: DiaSemana[] | null = null;
  let melhorCusto: number[] | null = null;
  for (const opcao of opcoes) {
    const c = custo(opcao);
    if (melhorCusto === null || menor(c, melhorCusto)) {
      campea = opcao;
      melhorCusto = c;
    }
  }
  return campea ?? [];
}

/** Compara dois custos campo a campo (o primeiro campo manda). */
function menor(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * Os dias de força (SPEC §17.2 item 1): a folga primeiro quando a fase a pede,
 * depois a semana do programa, depois o começo da semana.
 */
export function escolherDiasDeForca(
  fase: FaseId,
  escolhidos: readonly DiaSemana[],
  quantos: number,
): DiaSemana[] {
  if (quantos <= 0 || escolhidos.length === 0) return [];
  const doPrograma = diasDeForcaDoPrograma(fase);
  const folga = faseExigeFolga(fase);
  return melhor(combinacoes(escolhidos, Math.min(quantos, escolhidos.length)), (c) => [
    folga ? consecutivos(c) : 0,
    -coincidencias(c, doPrograma),
    peso(c),
  ]);
}

/**
 * Os dias de cardio (SPEC §17.2 item 3): a semana do programa primeiro, depois
 * evitar o dia seguinte a um treino de perna, depois o começo da semana.
 */
export function escolherDiasDeCardio(
  fase: FaseId,
  sobrando: readonly DiaSemana[],
  quantos: number,
  diasDePerna: readonly DiaSemana[],
): DiaSemana[] {
  if (quantos <= 0 || sobrando.length === 0) return [];
  const doPrograma = diasDeCardioDoPrograma(fase);
  const depoisDePerna = new Set(
    diasDePerna
      .map((d) => DIAS[DIAS.indexOf(d) + 1])
      .filter((d): d is DiaSemana => Boolean(d)),
  );
  return melhor(combinacoes(sobrando, Math.min(quantos, sobrando.length)), (c) => [
    -coincidencias(c, doPrograma),
    c.filter((d) => depoisDePerna.has(d)).length,
    peso(c),
  ]);
}

/**
 * Os treinos da Fase 2 que cabem em `quantos` dias, na ordem SA, IA, SB, IB.
 * Faltando dia, corta na ordem da §5.4: o último treino que **não** tem
 * agachamento nem terra; sobrando um dia só, é o Treino A da fase.
 *
 * Com uma exceção (SPEC §17.2 item 6): o corte nunca deixa a semana **só** com
 * treinos de perna. A §5.4 foi escrita para uma semana curta, em que sacrificar
 * o superior custa uma vez; como escolha permanente de dias, ela deixaria
 * peito, costas e ombro fora da semana inteira. Sobrando dois dias na Fase 2, é
 * um superior e um inferior (SA e IA).
 */
export function treinosParaNDias(fase: FaseId, quantos: number): TreinoId[] {
  const todos = [...acharFase(fase).treinos];
  const primeiro = todos[0];
  if (!primeiro) throw new Error(`${fase} sem treinos`);
  if (quantos >= todos.length) return todos;
  if (quantos <= 1) return quantos <= 0 ? [] : [primeiro];

  const pesados = treinosPesados(fase);
  const restantes = [...todos];
  while (restantes.length > quantos) {
    const leves = restantes.filter((t) => !pesados.includes(t));
    const duros = restantes.filter((t) => pesados.includes(t));
    // cortar o último leve apagaria o único superior que restava: corta um
    // pesado no lugar, enquanto houver mais de um (§17.2 item 6)
    const alvo =
      leves.length <= 1 && duros.length > 1
        ? duros[duros.length - 1]
        : (leves[leves.length - 1] ?? duros[duros.length - 1]);
    const i = alvo ? restantes.indexOf(alvo) : restantes.length - 1;
    restantes.splice(i < 0 ? restantes.length - 1 : i, 1);
  }
  return restantes;
}

/* ------------------------------------------------ a semana personalizada */

/**
 * A semana do usuário no formato de `programa.fases[fase].semana` (SPEC §17.2).
 *
 * `dias === null` (a preferência não existe) devolve a semana do JSON tal como
 * está — inclusive as notas dos dias de descanso.
 */
export function semanaPersonalizada(
  fase: FaseId,
  dias: readonly DiaSemana[] | null | undefined,
): DiaPrograma[] {
  const daFase = acharFase(fase);
  if (dias === null || dias === undefined) return daFase.semana.map((d) => ({ ...d }));

  const escolhidos = ordenarDias(dias);
  const capacidade = escolhidos.length;

  /*
   * SPEC §17.2 item 6 (a ordem de sacrifício da §5.4): com menos dias do que
   * sessões, o cardio cai primeiro (a última sessão da semana antes da outra) e
   * só depois um treino de força.
   */
  const forcaPedida = daFase.frequencia_forca;
  const cardios = cardiosDoPrograma(fase);
  const nForca = Math.min(forcaPedida, capacidade);
  const nCardio = Math.min(cardios.length, Math.max(0, capacidade - nForca));

  const diasDeForca = escolherDiasDeForca(fase, escolhidos, nForca);

  /*
   * Fase 1: "alternar" — a escada do §5.2 decide qual treino é o de cada dia,
   * inclusive quando há UM dia só na semana (SPEC §17.2 item 6). Escrever `A1`
   * ali prendia o dia no Treino A para sempre e o levantamento terra do Treino
   * B nunca chegava: a regra "sobrando um dia só, é o Treino A" da §5.4 é de
   * semana curta, não de uma configuração permanente.
   * Fase 2: os treinos da fase na ordem, cortando pela §5.4 quando falta dia.
   */
  const alternar = daFase.semana.some((d) => d.treino === "alternar");
  const treinos = alternar
    ? diasDeForca.map(() => "alternar" as const)
    : treinosParaNDias(fase, diasDeForca.length);

  const diasDePerna = diasDeForca.filter((_, i) => {
    const t = treinos[i];
    if (!t || t === "alternar") return treinosPesados(fase).length > 0;
    return treinosPesados(fase).includes(t);
  });

  const sobrando = escolhidos.filter((d) => !diasDeForca.includes(d));
  const diasDeCardio = escolherDiasDeCardio(fase, sobrando, nCardio, diasDePerna);

  const minForca = minutosDeForca(fase);
  const notas = notasDeDescanso(fase);
  let livres = 0;

  return DIAS.map((dia): DiaPrograma => {
    const iForca = diasDeForca.indexOf(dia);
    if (iForca >= 0) {
      const treino = treinos[iForca] ?? "alternar";
      const min =
        treino === "alternar"
          ? (minForca[iForca] ?? minForca[0])
          : acharTreino(treino).duracao_min;
      return { dia, tipo: "forca", treino, ...(min ? { min } : {}) };
    }

    const iCardio = diasDeCardio.indexOf(dia);
    if (iCardio >= 0) {
      const modelo = cardios[iCardio];
      return {
        dia,
        tipo: "cardio",
        ...(modelo?.sessao ? { sessao: modelo.sessao } : {}),
        ...(modelo?.min ? { min: modelo.min } : {}),
      };
    }

    // SPEC §17.2 item 4: o dia escolhido que sobrou é um dia LIVRE, com a nota
    // de descanso do programa; o dia não escolhido é descanso e nada mais.
    if (escolhidos.includes(dia)) {
      const nota = notas[livres];
      livres += 1;
      return { dia, tipo: "descanso", ...(nota ? { nota } : {}) };
    }
    return { dia, tipo: "descanso" };
  });
}

/** Quantos dias de cada tipo a escolha produziu — o resumo do card (§17.1). */
export interface ResumoDosDias {
  forca: number;
  cardio: number;
  livres: number;
  /** Sessões da semana: o padrão da meta semanal (SPEC §17.3). */
  sessoes: number;
}

export function resumoDosDias(
  fase: FaseId,
  dias: readonly DiaSemana[] | null | undefined,
): ResumoDosDias {
  const semana = semanaPersonalizada(fase, dias);
  const escolhidos = dias ? ordenarDias(dias) : diasPadraoDaFase(fase);
  const forca = semana.filter((d) => d.tipo === "forca").length;
  const cardio = semana.filter((d) => d.tipo === "cardio").length;
  const livres = semana.filter(
    (d) => d.tipo === "descanso" && escolhidos.includes(d.dia),
  ).length;
  return { forca, cardio, livres, sessoes: forca + cardio };
}

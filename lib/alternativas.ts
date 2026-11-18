import { acharExercicio, equipamentoDisponivel, exerciciosComVariacoes, regrasDeAlternativas } from "@/lib/dados";
import type { EquipamentoTag, Exercicio } from "@/lib/schemas";

export type FiltroAlternativa = "todos" | "outro-equipamento" | "corpo" | "tatame" | "elastico";

const { movimentos, montagens } = regrasDeAlternativas;
const movimentoPorId = new Map<string, string>();
for (const [movimento, ids] of Object.entries(movimentos)) {
  for (const id of ids) movimentoPorId.set(id, movimento);
}

// Quando a ficha física admite barra OU halteres, a prescrição do app pode
// registrar só carga total ou só kg por halter. O JSON conserva a montagem
// atendida por aquela ficha; uma ficha com outro implemento tem o próprio ID.
function montagensDoCatalogo(e: Exercicio): EquipamentoTag[][] {
  const especificas = montagens[e.id];
  if (especificas) return especificas;
  if (e.implemento === "polia") {
    // A polia do terraço usa um pino com anilhas e acessórios do kit de
    // puxadores. A "barra ou corda" da ficha é um puxador, não uma barra livre.
    const apoios = e.equipamento.filter((tag) => tag === "banco" || tag === "tatame");
    return [["cross-over", "anilhas", "puxadores", ...apoios]];
  }
  return [e.equipamento];
}

/** Cada lista interna é uma montagem completa; basta ter uma delas. */
export function equipamentosDaAlternativa(
  e: Exercicio,
  disponiveis: ReadonlySet<EquipamentoTag> = equipamentoDisponivel(),
): EquipamentoTag[][] {
  return montagensDoCatalogo(e).filter((kit) => kit.every((tag) => disponiveis.has(tag)));
}

function movimentoEmComum(a: Exercicio, b: Exercicio): string | undefined {
  const movimento = movimentoPorId.get(a.id);
  return movimento === movimentoPorId.get(b.id) ? movimento : undefined;
}

function primariosEmComum(a: Exercicio, b: Exercicio) {
  return a.musculos_primarios.filter((m) => b.musculos_primarios.includes(m));
}

export function motivoDaAlternativa(origem: Exercicio, alternativa: Exercicio): string {
  const movimento = movimentoEmComum(origem, alternativa);
  const nomes = primariosEmComum(origem, alternativa).map((m) =>
    origem.musculos_primarios_nome[origem.musculos_primarios.indexOf(m)],
  );
  const motivo = [];
  if (movimento) motivo.push(`Mesmo movimento: ${movimento.toLocaleLowerCase("pt-BR")}`);
  if (nomes.length) motivo.push(`Em comum: ${nomes.join(", ")}`);
  return motivo.join(" · ");
}

function afinidade(origem: Exercicio, alternativa: Exercicio) {
  const total = primariosEmComum(origem, alternativa).length;
  const uniao = origem.musculos_primarios.length + alternativa.musculos_primarios.length - total;
  // Mesmo gesto vem antes de músculo isolado. Entre dois gestos iguais, a
  // sobreposição proporcional privilegia quem conserva o foco da série.
  return (movimentoEmComum(origem, alternativa) ? 2 : 0) + total / Math.max(uniao, 1);
}

function atendeFiltro(
  filtro: FiltroAlternativa,
  origem: Exercicio,
  alternativa: Exercicio,
  kit: EquipamentoTag[],
): boolean {
  switch (filtro) {
    case "todos": return true;
    case "corpo": return alternativa.implemento === "peso_corporal" && kit.every((tag) => tag === "tatame");
    case "tatame": return kit.length === 1 && kit[0] === "tatame";
    case "elastico": return kit.includes("super-band") && kit.every((tag) => tag === "super-band" || tag === "tatame");
    case "outro-equipamento": {
      // Outras variações com o mesmo material (ex.: supino inclinado e reto
      // com barra) não resolvem a falta dele. Tampouco a simples ordem das tags.
      return montagensDoCatalogo(origem).every((base) =>
        base.length !== kit.length || !base.every((tag) => kit.includes(tag)),
      );
    }
  }
}

/** Montagens que justificam a alternativa sob o filtro escolhido na tela. */
export function montagensParaTroca(
  origem: Exercicio,
  alternativa: Exercicio,
  filtro: FiltroAlternativa,
  disponiveis: ReadonlySet<EquipamentoTag>,
): EquipamentoTag[][] {
  return equipamentosDaAlternativa(alternativa, disponiveis).filter((kit) =>
    atendeFiltro(filtro, origem, alternativa, kit),
  );
}

export function alternativasPara(
  exercicioId: string,
  filtro: FiltroAlternativa = "todos",
  disponiveis: ReadonlySet<EquipamentoTag> = equipamentoDisponivel(),
): Exercicio[] {
  const origem = acharExercicio(exercicioId);
  const candidatas = [];
  for (const e of exerciciosComVariacoes) {
    if (e.id === origem.id || e.prescricao_padrao.tipo === "ver_cardio_corda") continue;
    // O salto de potência e o trabalho de força não são intercambiáveis só
    // porque ambos usam quadríceps; planos de corda têm registro próprio.
    if ((e.grupo === "Cardio") !== (origem.grupo === "Cardio")) continue;
    const pontos = afinidade(origem, e);
    if (pontos > 0 && montagensParaTroca(origem, e, filtro, disponiveis).length > 0) {
      candidatas.push({ e, pontos });
    }
  }
  candidatas.sort((a, b) => b.pontos - a.pontos || a.e.nome.localeCompare(b.e.nome, "pt-BR"));
  return candidatas.map(({ e }) => e);
}

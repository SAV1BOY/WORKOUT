/**
 * O espelho dos textos da ficha em página (SPEC §22.14 item 3 e §22.17 item
 * 3): os parágrafos e itens visíveis do `<main>` (12 caracteres ou mais) que
 * a página de um exercício mostra com o histórico vazio, montados dos mesmos
 * dados e das mesmas regras do componente. O Vitest aplica o critério "nada
 * repetido" aos 81 por aqui; o e2e (`e2e/ultraloop-l33.spec.ts`) abre as 81
 * fichas e compara o DOM com este espelho — se um mostrar o que o outro não
 * tem, cai. Nada de React nem de Supabase aqui.
 */
import { treinosDoExercicio } from "@/lib/catalogo";
import {
  SEM_HISTORICO,
  linhaDaCargaInicial,
  linksDosTreinos,
  notaDaCargaInicial,
  ondeVoceEsta,
  tagsDoEquipamento,
} from "@/lib/ficha";
import { formatarDescanso } from "@/lib/formato";
import { textoDaCarga, textoDoAlvo } from "@/lib/hoje";
import type { opcoesDeMontagem } from "@/lib/preferencias";
import { cargaDeHoje, prescricaoPadrao } from "@/lib/progressao";
import type { Exercicio } from "@/lib/schemas";
import { nomeDaAssistencia } from "@/lib/sessao";

export function textosDaPagina(e: Exercicio, opcoes: ReturnType<typeof opcoesDeMontagem>): string[] {
  const p = e.prescricao_padrao;
  const prescricao = prescricaoPadrao(e);
  const alvo = cargaDeHoje(e, null, prescricao, opcoes);
  const onde = ondeVoceEsta({
    comoPagina: true,
    primeiraVez: alvo.primeira_vez === true,
    assistencia: Boolean(alvo.assistencia),
    semanaLeve: Boolean(alvo.semana_leve),
    cargaDoMotor: alvo.carga_kg,
    cargaInicial: e.carga_inicial.kg,
  });
  const series = prescricao.series ?? p.series ?? 3;
  const textos = [
    `${e.grupo} · ${e.equipamento_texto}`,
    ...linksDosTreinos(treinosDoExercicio(e.id)).map((t) => t.nome),
    ...e.passos,
    e.erro_comum,
    e.montagem,
    ...tagsDoEquipamento(e.equipamento).map((t) => t.rotulo),
    p.texto,
    `Descanso de ${formatarDescanso(p.descanso_s)}${p.unilateral ? " · um lado de cada vez" : ""}`,
    linhaDaCargaInicial(e),
    notaDaCargaInicial(e.carga_inicial),
    e.progressao.regra,
    SEM_HISTORICO.titulo,
    SEM_HISTORICO.frase,
    "Sessão livre só com este exercício, com a carga que o motor indica.",
  ];
  if (onde.mostrar) {
    if (onde.carga) textos.push(textoDaCarga(e.implemento, alvo.carga_kg));
    if (onde.proxima) {
      textos.push(
        `Próxima sessão: ${textoDoAlvo(series, alvo)}` +
          (alvo.assistencia ? ` · elástico ${nomeDaAssistencia(alvo.assistencia)}` : "") +
          (alvo.semana_leve ? " · semana leve (60%)" : ""),
      );
    }
    if (onde.ajustePelasBarras) textos.push("Montada com o peso das suas barras (Mais → Equipamento).");
    if (onde.nota) textos.push(`Ainda sem registro: ${e.carga_inicial.nota}.`);
  }
  return textos
    .filter((t): t is string => t !== null)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 12);
}


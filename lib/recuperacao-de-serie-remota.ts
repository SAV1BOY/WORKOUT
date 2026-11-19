import { CAMPOS_DE_CONTAGEM, contagemInteiraValida, type CampoContagem } from "@/lib/campos-de-contagem";
import { registroRemotoEmRecuperacao, type DecisaoSobreRegistro, type PropostaNaAusencia, type ResultadoDaRecuperacao } from "@/lib/registro-remoto-em-recuperacao";

type Linha = Record<string, unknown>;
export type DecisaoSobreSerie = DecisaoSobreRegistro;
export type { PropostaNaAusencia };

const identidade = ["session_id", "exercise_id", "ordem_ex", "set_index", "tipo", "concluida"] as const;

/** O UUID pode ter sido movido por um backup. O movimento e o treino precisam estar identificados. */
export function mesmaIdentidadeDaSerie(local: Linha, remota: Linha): boolean {
  return local.user_id === remota.user_id && local.id === remota.id &&
    typeof local.exercise_id === "string" && !!local.exercise_id && typeof local.session_id === "string" && !!local.session_id &&
    identidade.every(c => !Object.hasOwn(local, c) || local[c] === remota[c]);
}

function temContagem(local: Linha, campo: CampoContagem): boolean {
  const valor = local[campo];
  return Object.hasOwn(local, campo) && (valor === null || contagemInteiraValida(valor));
}

export function podeInserirSerie(linha: Linha): boolean {
  return [linha.id, linha.user_id, linha.session_id, linha.exercise_id].every(v => typeof v === "string" && v) &&
    Number.isInteger(linha.ordem_ex) && Number.isInteger(linha.set_index) &&
    (!Object.hasOwn(linha, "tipo") || linha.tipo === "trabalho" || linha.tipo === "aquecimento") &&
    (!Object.hasOwn(linha, "concluida") || typeof linha.concluida === "boolean") &&
    CAMPOS_DE_CONTAGEM.every(c => !Object.hasOwn(linha, c) || temContagem(linha, c));
}

/** Reconhece uma inserção já entregue cuja resposta se perdeu; campos omitidos recebem os padrões de session_sets. */
function correspondeAInsercao(proposta: Linha, linha: Linha): boolean {
  if (!podeInserirSerie(proposta)) return false;
  const padroes = { ...Object.fromEntries(CAMPOS_DE_CONTAGEM.map(c => [c, null])), tipo: "trabalho", concluida: false,
    carga_kg: null, assistencia: null, rpe: null, ultima_firme: null };
  return Object.entries({ ...padroes, ...proposta }).every(([k, v]) => k === "registrada_em" && typeof v === "string"
    ? typeof linha[k] === "string" && Date.parse(linha[k]) === Date.parse(v)
    : linha[k] === v);
}

/** Só o envio da recuperação usa este caminho. Uma escrita normal da série continua seguindo a ordem do treino. */
export async function conferirSerieRemota(
  conta: string, local: Linha, campos: readonly CampoContagem[], decisao?: DecisaoSobreSerie, ausencia?: PropostaNaAusencia,
): Promise<ResultadoDaRecuperacao> {
  const id = local.id;
  if (!conta || local.user_id !== conta || typeof id !== "string" || !id || typeof local.session_id !== "string" ||
      !local.session_id || !campos.length || !campos.every(c => CAMPOS_DE_CONTAGEM.includes(c) && temContagem(local, c))) {
    throw new Error("Confira a conta, o treino e as contagens da série antes de enviar.");
  }
  const registro = await registroRemotoEmRecuperacao("session_sets", conta, id, linha =>
    typeof linha.session_id === "string" && typeof linha.exercise_id === "string" && typeof linha.concluida === "boolean" &&
    Number.isInteger(linha.ordem_ex) && Number.isInteger(linha.set_index) && typeof linha.tipo === "string" &&
    campos.every(c => linha[c] === null || Number.isInteger(linha[c])));
  // Uma importação pode ter movido a série. Procurar apenas no treino original a faria parecer ausente.
  let remota = await registro.buscar();
  if (ausencia) {
    const proposta = ausencia.insercao;
    if (proposta.user_id !== conta || proposta.id !== id || proposta.session_id !== local.session_id) {
      throw new Error("A proposta precisa corresponder à conta, ao treino e à série da importação.");
    }
    if (!remota) {
      if (!decisao && ausencia.manterAusencia) return { estado: "ausencia-mantida", linha: proposta };
      if (decisao || !ausencia.confirmada || !podeInserirSerie(proposta)) return { estado: "confirmar-insercao", linha: proposta };
      // A importação mudou o vínculo. Somente os dados informados para o destino compõem esta nova série.
      remota = await registro.inserirSeAusente(proposta);
      if (!remota) throw new Error("O histórico ainda não confirmou a série restaurada nesta conta.");
    }
    if (!decisao && (ausencia.confirmada || ausencia.manterAusencia)) {
      return { estado: !ausencia.manterAusencia && correspondeAInsercao(proposta, remota) ? "confirmada" : "conflito", linha: remota };
    }
  }
  if (!remota && !decisao) {
    // Uma linha parcial de backup serve para corrigir uma série existente, mas não identifica uma nova por completo.
    if (!podeInserirSerie(local)) {
      throw new Error("Faltam o exercício ou a posição para restaurar esta série que ainda não consta no histórico.");
    }
    remota = await registro.inserirSeAusente(local);
  }
  if (!remota) throw new Error("A série não está disponível nesta conta para confirmar a correção.");

  const coincide = (a: Linha, b: Linha) => mesmaIdentidadeDaSerie(a, b) && campos.every(c => a[c] === b[c]);
  const observada = decisao?.observada;
  const correspondeAoQueFoiVisto = observada && observada.user_id === conta && observada.id === id &&
    identidade.every(c => observada[c] === remota[c]) && campos.every(c => observada[c] === remota[c]);
  if (decisao?.usar === "historico") return { estado: correspondeAoQueFoiVisto ? "confirmada" : "conflito", linha: remota };
  // Se a resposta do envio anterior se perdeu, a releitura já contém as contagens que a pessoa escolheu.
  if (coincide(local, remota)) return { estado: "confirmada", linha: remota };
  if (decisao?.usar !== "aparelho" || !mesmaIdentidadeDaSerie(local, remota) || !correspondeAoQueFoiVisto) {
    return { estado: "conflito", linha: remota };
  }

  const alteracoes = Object.fromEntries(campos.filter(c => local[c] !== remota[c]).map(c => [c, local[c]]));
  // A escolha só vale para a identidade e as contagens que apareceram na tela.
  const atual = await registro.atualizarSeIgual(alteracoes, remota, [...identidade, ...campos]);
  if (!atual) throw new Error("A série deixou de estar disponível enquanto a correção era enviada.");
  return { estado: coincide(local, atual) ? "confirmada" : "conflito", linha: atual };
}

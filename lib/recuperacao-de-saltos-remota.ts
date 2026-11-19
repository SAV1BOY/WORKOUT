import { replaceEqualDeep } from "@tanstack/react-query";
import { contagemInteiraValida } from "@/lib/campos-de-contagem";
import {
  registroRemotoEmRecuperacao, type DecisaoSobreRegistro, type PropostaNaAusencia, type ResultadoDaRecuperacao,
} from "@/lib/registro-remoto-em-recuperacao";

type Linha = Record<string, unknown>;
const camposObservados = ["tipo", "data", "concluida", "saltos"] as const;

function dataDoTreino(valor: unknown): boolean {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function saltosValidos(valor: unknown): boolean {
  return valor === null || contagemInteiraValida(valor);
}

export function mesmaIdentidadeDoCardio(local: Linha, remota: Linha): boolean {
  return local.id === remota.id && local.user_id === remota.user_id && local.tipo === "corda" && remota.tipo === "corda" &&
    dataDoTreino(local.data) && local.data === remota.data &&
    (!Object.hasOwn(local, "concluida") || local.concluida === remota.concluida);
}

export function podeInserirCardio(linha: Linha): boolean {
  return typeof linha.id === "string" && !!linha.id && typeof linha.user_id === "string" && !!linha.user_id &&
    linha.tipo === "corda" && dataDoTreino(linha.data) && (!Object.hasOwn(linha, "saltos") || saltosValidos(linha.saltos)) &&
    (!Object.hasOwn(linha, "concluida") || typeof linha.concluida === "boolean");
}

/** JSONB pode devolver as chaves dos blocos do timer em outra ordem. As colunas omitidas seguem o schema de cardio_sessions. */
function correspondeAInsercao(proposta: Linha, atual: Linha): boolean {
  if (!podeInserirCardio(proposta)) return false;
  const campos = { semana_plano: null, planejado: null, feito: null, duracao_min: null, distancia_km: null,
    saltos: null, esforco: null, notas: null, concluida: false, ...proposta };
  return Object.entries(campos).every(([k, v]) => k === "created_at" && typeof v === "string" && typeof atual[k] === "string"
    ? Date.parse(v) === Date.parse(atual[k]) : replaceEqualDeep(v, atual[k]) === v);
}

/** O encerramento e o avanço de semana já aconteceram no cliente antigo. O único campo corrigível no servidor é saltos. */
export async function conferirSaltosRemotos(
  conta: string, local: Linha, decisao?: DecisaoSobreRegistro, ausencia?: PropostaNaAusencia,
): Promise<ResultadoDaRecuperacao> {
  const id = local.id;
  if (!conta || local.user_id !== conta || typeof id !== "string" || !id || !Object.hasOwn(local, "saltos") || !saltosValidos(local.saltos)) {
    throw new Error("Confira a conta, a sessão e a quantidade de saltos.");
  }
  const registro = await registroRemotoEmRecuperacao("cardio_sessions", conta, id, linha =>
    typeof linha.tipo === "string" && dataDoTreino(linha.data) && typeof linha.concluida === "boolean" &&
    (linha.saltos === null || Number.isInteger(linha.saltos)));
  let remota = await registro.buscar();
  const proposta = ausencia?.insercao ?? local;
  if (proposta.user_id !== conta || proposta.id !== id) throw new Error("A proposta deve pertencer à mesma conta e sessão de cardio.");

  if (!remota) {
    if (!decisao && ausencia?.manterAusencia) return { estado: "ausencia-mantida", linha: proposta };
    if (decisao || !podeInserirCardio(proposta) || (ausencia && !ausencia.confirmada)) {
      return { estado: "confirmar-insercao", linha: proposta };
    }
    remota = await registro.inserirSeAusente(proposta);
    if (!remota) throw new Error("O histórico ainda não confirmou a sessão de corda nesta conta.");
  }
  if (!decisao && (ausencia?.confirmada || ausencia?.manterAusencia)) {
    return { estado: !ausencia.manterAusencia && correspondeAInsercao(proposta, remota) ? "confirmada" : "conflito", linha: remota };
  }
  // Mesmo com os mesmos saltos na corda original, o backup pode ter destinado este UUID a outro dia ou atividade.
  const mudouNoBackup = ausencia && ["tipo", "data", "concluida"].some(c => Object.hasOwn(proposta, c) && proposta[c] !== local[c]);
  if (mudouNoBackup && decisao?.usar !== "historico") return { estado: "conflito", linha: remota };

  const observada = decisao?.observada;
  const mesmaVersao = observada?.user_id === conta && observada.id === id && camposObservados.every(c => observada[c] === remota[c]);
  if (decisao?.usar === "historico") return { estado: mesmaVersao ? "confirmada" : "conflito", linha: remota };
  const corresponde = (linha: Linha) => mesmaIdentidadeDoCardio(local, linha) && local.saltos === linha.saltos;
  if (corresponde(remota)) return { estado: "confirmada", linha: remota };
  if (decisao?.usar !== "aparelho" || !mesmaIdentidadeDoCardio(local, remota) || !mesmaVersao) {
    return { estado: "conflito", linha: remota };
  }
  const atual = await registro.atualizarSeIgual({ saltos: local.saltos }, remota, camposObservados);
  if (!atual) return { estado: "confirmar-insercao", linha: proposta };
  return { estado: corresponde(atual) ? "confirmada" : "conflito", linha: atual };
}

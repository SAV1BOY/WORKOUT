import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { itensDoPlano, itensNaOrdem, planoDaSessao } from "@/lib/livre";
import { itensDoTreino, reconstruirSessao } from "@/lib/sessao";
import {
  aplicarOrdem,
  chaveDaOrdemDoDia,
  consumirOrdemDoAparelho,
  descer,
  ehAOrdemDoPrograma,
  escreverOrdem,
  guardarOrdemNoAparelho,
  lerOrdem,
  lerTextoDaOrdem,
  mover,
  subir,
} from "@/lib/ordem";

function lerOrdemDoAparelho(conta: string, data: string, treinoId: string): string[] {
  return lerOrdem(lerTextoDaOrdem(conta, data, treinoId), data, treinoId);
}

const IDS = ["a", "b", "c", "d"];

describe("mover (as setas ↑↓ e as alças, SPEC §14.3)", () => {
  it("leva o item para a posição pedida sem perder ninguém", () => {
    expect(mover(IDS, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(mover(IDS, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("não mexe quando o destino é o mesmo ou está fora da lista", () => {
    expect(mover(IDS, 1, 1)).toEqual(IDS);
    expect(mover(IDS, -1, 2)).toEqual(IDS);
    expect(mover(IDS, 0, 9)).toEqual(IDS);
    expect(mover([], 0, 1)).toEqual([]);
  });

  it("subir no primeiro e descer no último não fazem nada", () => {
    expect(subir(IDS, 0)).toEqual(IDS);
    expect(descer(IDS, 3)).toEqual(IDS);
    expect(subir(IDS, 2)).toEqual(["a", "c", "b", "d"]);
    expect(descer(IDS, 0)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("aplicar a ordem guardada", () => {
  it("quem está na ordem vem primeiro; quem não está fica no fim", () => {
    expect(aplicarOrdem(IDS, ["c", "a"])).toEqual(["c", "a", "b", "d"]);
  });

  it("ordem vazia é a ordem do programa", () => {
    expect(aplicarOrdem(IDS, [])).toEqual(IDS);
  });

  it("id que saiu do programa é ignorado, e nada se repete", () => {
    expect(aplicarOrdem(IDS, ["z", "d", "d", "a"])).toEqual(["d", "a", "b", "c"]);
    expect(aplicarOrdem(IDS, ["d", "c", "b", "a"])).toHaveLength(4);
  });

  it("reconhece a ordem do programa", () => {
    expect(ehAOrdemDoPrograma(IDS, IDS)).toBe(true);
    expect(ehAOrdemDoPrograma(IDS, [])).toBe(true);
    expect(ehAOrdemDoPrograma(IDS, ["b", "a"])).toBe(false);
  });
});

describe("guardar e ler no aparelho", () => {
  it("só guarda quando a ordem é diferente da do programa", () => {
    expect(escreverOrdem("2026-09-15", "A1", IDS, IDS)).toBeNull();
    expect(escreverOrdem("2026-09-15", "A1", IDS, [])).toBeNull();
    const texto = escreverOrdem("2026-09-15", "A1", IDS, ["c", "a"]);
    expect(texto).not.toBeNull();
    expect(lerOrdem(texto, "2026-09-15", "A1")).toEqual(["c", "a", "b", "d"]);
  });

  it("a ordem vale só para aquele dia e aquele treino", () => {
    const texto = escreverOrdem("2026-09-15", "A1", IDS, ["c", "a"]);
    expect(lerOrdem(texto, "2026-09-16", "A1")).toEqual([]);
    expect(lerOrdem(texto, "2026-09-15", "B1")).toEqual([]);
  });

  it("texto estragado no storage não vira ordem", () => {
    expect(lerOrdem(null, "2026-09-15", "A1")).toEqual([]);
    expect(lerOrdem("{", "2026-09-15", "A1")).toEqual([]);
    expect(lerOrdem("[]", "2026-09-15", "A1")).toEqual([]);
    expect(
      lerOrdem(
        JSON.stringify({ data: "2026-09-15", treinoId: "A1", ordem: [1, "a", ""] }),
        "2026-09-15",
        "A1",
      ),
    ).toEqual(["a"]);
  });
});

describe("a ordem antes de começar em um aparelho compartilhado", () => {
  const hoje = "2026-09-15";
  const amanha = "2026-09-16";
  const dados = new Map<string, string>();

  beforeEach(() => {
    dados.clear();
    vi.stubGlobal("window", { localStorage: {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, texto: string) => dados.set(chave, texto),
      removeItem: (chave: string) => dados.delete(chave),
    } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ignora a ordem antiga sem dono e a leitura com a conta ainda indefinida", () => {
    dados.set("treino-ordem", escreverOrdem(hoje, "A1", IDS, ["d"])!);
    expect(lerOrdemDoAparelho("ana", hoje, "A1")).toEqual([]);
    expect(lerOrdemDoAparelho("bia", hoje, "A1")).toEqual([]);
    expect(guardarOrdemNoAparelho("", hoje, "A1", IDS, ["c"])).toBe(false);
    expect(lerOrdemDoAparelho("", hoje, "A1")).toEqual([]);
    expect([...dados.keys()]).toEqual(["treino-ordem"]);
  });

  it("restaurar uma lista só altera aquele treino, data e conta", () => {
    guardarOrdemNoAparelho("ana", hoje, "A1", IDS, ["d"]);
    guardarOrdemNoAparelho("bia", hoje, "A1", IDS, ["b"]);
    guardarOrdemNoAparelho("ana", amanha, "A1", IDS, ["c"]);
    guardarOrdemNoAparelho("ana", hoje, "B1", IDS, ["d", "c"]);
    expect(lerOrdemDoAparelho("ana", hoje, "A1")).toEqual(["d", "a", "b", "c"]);
    expect(guardarOrdemNoAparelho("ana", hoje, "A1", IDS, IDS)).toBe(true);
    expect(lerOrdemDoAparelho("ana", hoje, "A1")).toEqual([]);
    expect(lerOrdemDoAparelho("bia", hoje, "A1")).toEqual(["b", "a", "c", "d"]);
    expect(lerOrdemDoAparelho("ana", amanha, "A1")).toEqual(["c", "a", "b", "d"]);
    expect(lerOrdemDoAparelho("ana", hoje, "B1")).toEqual(["d", "c", "a", "b"]);
  });

  it("um começo atrasado só consome a ordem que entrou na sessão", () => {
    guardarOrdemNoAparelho("ana", hoje, "A1", IDS, ["d"]);
    const usada = lerOrdemDoAparelho("ana", hoje, "A1");
    const textoUsado = lerTextoDaOrdem("ana", hoje, "A1");
    guardarOrdemNoAparelho("ana", hoje, "A1", IDS, ["b"]);
    for (const [conta, dia, treino] of [["bia", hoje, "A1"], ["ana", amanha, "A1"], ["ana", hoje, "B1"]] as const) {
      guardarOrdemNoAparelho(conta, dia, treino, IDS, usada);
    }
    consumirOrdemDoAparelho("ana", hoje, "A1", textoUsado);
    const posterior = lerOrdemDoAparelho("ana", hoje, "A1");
    expect(posterior).toEqual(["b", "a", "c", "d"]);
    consumirOrdemDoAparelho("ana", hoje, "A1", lerTextoDaOrdem("ana", hoje, "A1"));
    expect(dados.has(chaveDaOrdemDoDia("ana", hoje, "A1"))).toBe(false);
    expect(lerOrdemDoAparelho("bia", hoje, "A1")).toEqual(usada);
    expect(lerOrdemDoAparelho("ana", amanha, "A1")).toEqual(usada);
    expect(lerOrdemDoAparelho("ana", hoje, "B1")).toEqual(usada);
  });

  it("consome a versão que antecedeu uma restauração temporária quando o aparelho volta a permitir a remoção", () => {
    const chave = chaveDaOrdemDoDia("ana", hoje, "A1");
    guardarOrdemNoAparelho("ana", hoje, "A1", IDS, ["c"]);
    const anterior = lerTextoDaOrdem("ana", hoje, "A1");
    const remover = vi.spyOn(window.localStorage, "removeItem");
    remover.mockImplementationOnce(() => { throw new Error("Armazenamento bloqueado"); });
    expect(guardarOrdemNoAparelho("ana", hoje, "A1", IDS, [])).toBe(false);
    expect(consumirOrdemDoAparelho("ana", hoje, "A1", anterior)).toBe(true);
    expect(dados.has(chave)).toBe(false);
  });

  it("uma leitura bloqueada ou uma chave que estava vazia não autoriza apagar uma escolha posterior", () => {
    const chave = chaveDaOrdemDoDia("ana", hoje, "A1");
    const ausente = lerTextoDaOrdem("ana", hoje, "A1");
    expect(ausente).toBe(null);
    vi.spyOn(window.localStorage, "getItem").mockImplementationOnce(() => { throw new Error("Sem acesso"); });
    const desconhecida = lerTextoDaOrdem("ana", hoje, "A1");
    expect(desconhecida).toBeUndefined();
    guardarOrdemNoAparelho("ana", hoje, "A1", IDS, ["d"]);
    expect(consumirOrdemDoAparelho("ana", hoje, "A1", desconhecida)).toBe(false);
    expect(consumirOrdemDoAparelho("ana", hoje, "A1", ausente)).toBe(true);
    expect(dados.has(chave)).toBe(true);
    const usada = lerTextoDaOrdem("ana", hoje, "A1");
    vi.spyOn(window.localStorage, "removeItem").mockImplementationOnce(() => { throw new Error("Sem acesso"); });
    expect(consumirOrdemDoAparelho("ana", hoje, "A1", usada)).toBe(false);
    expect(dados.has(chave)).toBe(true);
  });

  it("a sessão aberta recupera a ordem do próprio plano depois que o rascunho muda", () => {
    const itens = itensDoTreino("A1");
    const ids = itens.map(item => item.exercicioId);
    const invertida = [...ids].reverse();
    const plano = planoDaSessao(itensNaOrdem(itens, invertida));
    guardarOrdemNoAparelho("ana", hoje, "A1", ids, ["supino-reto-com-barra"]);
    const sessao = reconstruirSessao({
      id: "aberta", user_id: "ana", data: hoje, workout_id: "A1", fase: "fase1",
      status: "em_andamento", iniciada_em: "2026-09-15T12:00:00Z", plano,
    }, [], { itens: itensDoPlano(plano)! });
    expect(sessao?.blocos.map(bloco => bloco.exercicioId)).toEqual(invertida);
    expect(lerOrdemDoAparelho("ana", hoje, "A1")[0]).toBe("supino-reto-com-barra");
  });

  it("devolve o padrão e comunica a falha quando o navegador bloqueia o armazenamento", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Storage bloqueado"); } });
    expect(lerOrdemDoAparelho("ana", hoje, "A1")).toEqual([]);
    expect(guardarOrdemNoAparelho("ana", hoje, "A1", IDS, ["c"])).toBe(false);
    expect(() => consumirOrdemDoAparelho("ana", hoje, "A1", undefined)).not.toThrow();
  });
});

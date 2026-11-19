import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comTrocas, escreverTrocas, guardarTrocasNoAparelho, lerTrocas, lerTrocasDoAparelho,
  limparTrocasDoAparelho, resolverTrocasDoTreino, trocaDoProgramaValida,
} from "@/lib/trocas";

const DATA = "2026-09-15";
const TREINO = "A1";

describe("trocas do dia (SPEC §13.3)", () => {
  it("vai e volta", () => {
    const texto = escreverTrocas(DATA, TREINO, { "supino-reto-com-barra": "flexao-de-braco" });
    expect(texto).not.toBeNull();
    expect(lerTrocas(texto, DATA, TREINO)).toEqual({
      "supino-reto-com-barra": "flexao-de-braco",
    });
  });

  it("a escolha de ontem não vale hoje", () => {
    const texto = escreverTrocas("2026-09-14", TREINO, { a: "b" });
    expect(lerTrocas(texto, DATA, TREINO)).toEqual({});
  });

  it("a escolha de outro treino não vale", () => {
    const texto = escreverTrocas(DATA, "B1", { a: "b" });
    expect(lerTrocas(texto, DATA, TREINO)).toEqual({});
  });

  it("sem troca nenhuma não guarda nada", () => {
    expect(escreverTrocas(DATA, TREINO, {})).toBeNull();
  });

  it("conserva a escolha explícita do original só hoje", () => {
    expect(lerTrocas(escreverTrocas(DATA, TREINO, { a: "a" }), DATA, TREINO)).toEqual({ a: "a" });
  });

  it("texto estragado no storage não derruba a tela", () => {
    expect(lerTrocas("não é json", DATA, TREINO)).toEqual({});
    expect(lerTrocas("[1,2,3]", DATA, TREINO)).toEqual({});
    expect(lerTrocas(null, DATA, TREINO)).toEqual({});
    expect(
      lerTrocas(JSON.stringify({ data: DATA, treinoId: TREINO, trocas: { a: 7 } }), DATA, TREINO),
    ).toEqual({});
  });

  it("aplica as trocas na ordem da lista", () => {
    expect(comTrocas(["a", "b", "c"], { b: "x" })).toEqual(["a", "x", "c"]);
  });
});

const agachamento = "agachamento-livre";
const frontal = "agachamento-frontal";
const goblet = "agachamento-goblet";
const supino = "supino-reto-com-barra";
const remada = "remada-curvada-pronada";
const pullover = "pullover-com-halter";

describe("trocas lembradas do programa", () => {
  it("preserva o original como chave e só hoje prevalece, inclusive para voltar ao programa", () => {
    const lembradas = { [agachamento]: frontal };
    expect(resolverTrocasDoTreino("A1", lembradas)).toEqual(lembradas);
    expect(resolverTrocasDoTreino("A1", lembradas, { [agachamento]: goblet })).toEqual({ [agachamento]: goblet });
    expect(resolverTrocasDoTreino("A1", lembradas, { [agachamento]: agachamento })).toEqual({});
    expect(resolverTrocasDoTreino("A1", lembradas)).toEqual({ [agachamento]: frontal });
    expect(resolverTrocasDoTreino("B1", lembradas)).toEqual({});
  });

  it("ignora dados antigos sem ficha, treino ou afinidade; um rascunho quebrado não apaga uma lembrança válida", () => {
    expect(trocaDoProgramaValida("desconhecido", agachamento, frontal)).toBe(false);
    expect(trocaDoProgramaValida("A1", agachamento, agachamento)).toBe(false);
    const invalido = { [agachamento]: "movimento-removido", [supino]: "prancha", "slot-antigo": goblet };
    expect(resolverTrocasDoTreino("A1", invalido)).toEqual({});
    expect(resolverTrocasDoTreino("A1", { [agachamento]: frontal }, { [agachamento]: "sem-ficha" })).toEqual({ [agachamento]: frontal });
  });

  it("um movimento entra uma vez; prioriza hoje e depois a ordem canônica, não a ordem do backup", () => {
    expect(resolverTrocasDoTreino("A1", { [remada]: pullover, [supino]: pullover })).toEqual({ [supino]: pullover });
    expect(resolverTrocasDoTreino("A1", { [supino]: pullover }, { [remada]: pullover })).toEqual({ [remada]: pullover });
  });

  it("mantém cada posição nas colisões em cadeia e permite trocar duas posições sem repetir movimentos", () => {
    const terceiro = "desenvolvimento-com-halteres";
    expect(resolverTrocasDoTreino("A1", {}, { [agachamento]: supino, [supino]: terceiro })).toEqual({});
    expect(resolverTrocasDoTreino("A1", {}, { [agachamento]: supino, [supino]: agachamento })).toEqual({
      [agachamento]: supino, [supino]: agachamento,
    });
  });
});

describe("rascunhos em aparelho compartilhado", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("isola por conta e treino, ignora o rascunho legado sem dono e limpa só o que foi consumido", () => {
    const dados = new Map<string, string>([["treino-trocas", escreverTrocas(DATA, TREINO, { [agachamento]: goblet })!]]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => dados.set(k, v),
      removeItem: (k: string) => dados.delete(k),
    } });
    expect(lerTrocasDoAparelho("u1", DATA, TREINO)).toEqual({});
    guardarTrocasNoAparelho("u1", DATA, TREINO, { [agachamento]: frontal });
    guardarTrocasNoAparelho("u2", DATA, TREINO, { [agachamento]: goblet });
    guardarTrocasNoAparelho("u1", DATA, "B1", { "levantamento-terra": frontal });
    limparTrocasDoAparelho("u1", TREINO);
    expect(lerTrocasDoAparelho("u1", DATA, TREINO)).toEqual({});
    expect(lerTrocasDoAparelho("u1", DATA, "B1")).toEqual({ "levantamento-terra": frontal });
    expect(lerTrocasDoAparelho("u2", DATA, TREINO)).toEqual({ [agachamento]: goblet });
    expect(lerTrocasDoAparelho("u2", "2026-09-16", TREINO)).toEqual({});
  });
});

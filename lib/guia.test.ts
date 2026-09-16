/**
 * O guia de uso (SPEC §20) só serve se cada "Ir" levar mesmo a algum lugar.
 * Estes testes leem o **sistema de arquivos** do projeto: a rota de todo `href`
 * do guia tem que ser uma página que existe, e toda âncora tem que ser um `id`
 * que existe em algum componente.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ABAS } from "@/lib/abas";
import {
  SECOES,
  blocosDaSecao,
  hrefsDoGuia,
  rotaDoHref,
  secaoDoGuia,
} from "@/lib/guia";

const RAIZ = process.cwd();
const APP = join(RAIZ, "app", "(app)");

/** O `page.tsx` de uma rota interna ("/" → app/(app)/page.tsx). */
function paginaDaRota(rota: string): string {
  const pedacos = rota.split("/").filter((p) => p !== "");
  return join(APP, ...pedacos, "page.tsx");
}

/** Todos os .tsx de `components/` e `app/`, para procurar `id="..."`. */
function arquivosDeTela(pasta: string): string[] {
  const achados: string[] = [];
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) achados.push(...arquivosDeTela(caminho));
    else if (item.name.endsWith(".tsx")) achados.push(caminho);
  }
  return achados;
}

const FONTE_DAS_TELAS = [
  ...arquivosDeTela(join(RAIZ, "components")),
  ...arquivosDeTela(join(RAIZ, "app")),
]
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const TODAS_AS_FUNCOES = SECOES.flatMap((s) =>
  s.funcoes.map((f) => ({ secao: s, funcao: f })),
);

describe("guia: estrutura", () => {
  it("tem as nove seções da §20.4, na ordem", () => {
    expect(SECOES.map((s) => s.id)).toEqual([
      "primeiros-passos",
      "abas",
      "treino",
      "explorar",
      "relatorio",
      "corpo",
      "mais",
      "calendario",
      "offline",
    ]);
  });

  it("toda seção tem ao menos uma função", () => {
    for (const secao of SECOES) {
      expect(secao.funcoes.length, `seção ${secao.id}`).toBeGreaterThan(0);
    }
  });

  it("nenhum texto vazio", () => {
    for (const secao of SECOES) {
      expect(secao.id.trim(), "id da seção").not.toBe("");
      expect(secao.titulo.trim(), `título de ${secao.id}`).not.toBe("");
      expect(secao.chip.trim(), `chip de ${secao.id}`).not.toBe("");
      expect(secao.resumo.trim(), `resumo de ${secao.id}`).not.toBe("");
      for (const funcao of secao.funcoes) {
        const onde = `${secao.id}/${funcao.id}`;
        expect(funcao.id.trim(), onde).not.toBe("");
        expect(funcao.nome.trim(), onde).not.toBe("");
        expect(funcao.oQueFaz.trim(), onde).not.toBe("");
        expect(funcao.caminho.length, onde).toBeGreaterThan(0);
        for (const chip of funcao.caminho) {
          expect(chip.trim(), `chip de ${onde}`).not.toBe("");
        }
        if (funcao.nota !== undefined) {
          expect(funcao.nota.trim(), `nota de ${onde}`).not.toBe("");
        }
      }
    }
  });

  it("ids únicos: seções entre si e funções dentro da seção", () => {
    const ids = SECOES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const secao of SECOES) {
      const dela = secao.funcoes.map((f) => f.id);
      expect(new Set(dela).size, `seção ${secao.id}`).toBe(dela.length);
    }
  });

  it("secaoDoGuia acha pelo id e devolve null no que não existe", () => {
    expect(secaoDoGuia("treino")?.titulo).toBe("Treino");
    expect(secaoDoGuia("nao-existe")).toBeNull();
  });

  it("blocosDaSecao agrupa sem perder nem repetir função", () => {
    for (const secao of SECOES) {
      const blocos = blocosDaSecao(secao);
      expect(blocos.flatMap((b) => b.funcoes)).toEqual([...secao.funcoes]);
    }
    const treino = secaoDoGuia("treino")!;
    expect(blocosDaSecao(treino).map((b) => b.grupo)).toEqual([
      "A tela",
      "No player",
      "Cardio",
      "Barra fixa",
    ]);
  });
});

describe("guia: os rótulos das abas são os da barra de baixo", () => {
  it("a seção de cada aba usa o rótulo de lib/abas.ts", () => {
    for (const aba of ABAS) {
      const secao = SECOES.find((s) => s.href === aba.href && s.id !== "abas");
      expect(secao, `seção da aba ${aba.rotulo}`).toBeDefined();
      expect(secao!.titulo).toBe(aba.rotulo);
    }
  });

  it("a miniatura da barra lista as cinco abas, na ordem da barra", () => {
    const barra = secaoDoGuia("abas")!;
    expect(barra.funcoes.map((f) => f.nome)).toEqual(ABAS.map((a) => a.rotulo));
    expect(barra.funcoes.map((f) => f.href)).toEqual(ABAS.map((a) => a.href));
  });

  it("nav-inferior.tsx desenha essa mesma lista (não redigita as abas)", () => {
    const fonte = readFileSync(
      join(RAIZ, "components", "nav-inferior.tsx"),
      "utf8",
    );
    expect(fonte).toContain('from "@/lib/abas"');
    expect(fonte).toContain("ABAS.map");
    // nenhum rótulo de aba escrito à mão dentro do componente
    for (const aba of ABAS) {
      expect(fonte, `rótulo "${aba.rotulo}" redigitado`).not.toContain(
        `"${aba.rotulo}"`,
      );
    }
  });
});

describe("guia: todo href existe no app", () => {
  it("cada rota tem um app/(app)/<rota>/page.tsx", () => {
    const hrefs = hrefsDoGuia();
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      expect(href.startsWith("/"), `href interno: ${href}`).toBe(true);
      const pagina = paginaDaRota(rotaDoHref(href));
      expect(existsSync(pagina), `${href} → ${pagina}`).toBe(true);
    }
  });

  it("nenhuma rota dinâmica (o guia só manda para telas que abrem sozinhas)", () => {
    for (const href of hrefsDoGuia()) {
      expect(href, `href com parâmetro: ${href}`).not.toMatch(/\[|\]/);
    }
  });

  it("cada âncora é um id que existe em alguma tela", () => {
    const ancoras = hrefsDoGuia()
      .filter((h) => h.includes("#"))
      .map((h) => h.split("#")[1]!);
    expect(ancoras.length).toBeGreaterThan(0);
    for (const ancora of new Set(ancoras)) {
      expect(FONTE_DAS_TELAS, `âncora #${ancora}`).toContain(`id="${ancora}"`);
    }
  });

  it("a seção de uma tela aponta para a rota dela", () => {
    expect(secaoDoGuia("treino")?.href).toBe("/");
    expect(secaoDoGuia("calendario")?.href).toBe("/calendario");
    expect(secaoDoGuia("mais")?.href).toBe("/mais");
    // "Primeiros passos" e "Sem internet e conta" não são telas
    expect(secaoDoGuia("primeiros-passos")?.href).toBeUndefined();
    expect(secaoDoGuia("offline")?.href).toBeUndefined();
  });
});

describe("guia: cobertura da §20.5", () => {
  const nomes = TODAS_AS_FUNCOES.map(({ funcao }) => funcao.nome);

  it.each([
    "Começar treino",
    "Continuar",
    "Faixa da semana",
    "Meta semanal",
    "Pesar",
    "Repetições soltas",
    "Treinar mesmo assim",
    "Fazer corda em vez de corrida",
    "Começar caminhada leve",
    "⇄ Substituir",
    "Editar",
    "Ajustar",
    "Personalizar treino",
    "Parte do corpo em foco",
    "Desafios",
    "Card de retomada",
    "Preparação",
    "Última repetição",
    "Descanso",
    "Visão geral do treino",
    "O que muda no próximo treino",
    "Conclusão",
    "Timer de intervalos",
    "Cronômetro",
    "Encerrar e registrar",
    "Fazer sessão de barra fixa",
    "Todos os exercícios",
    "Números",
    "Conquistas",
    "Histórico",
    "Sequências",
    "Peso",
    "Medidas",
    "Fotos",
    "IMC",
    "Como usar o app",
    "Perfil",
    "Equipamento",
    "Tema",
    "Dias de treino",
    "Incremento por exercício",
    "Créditos",
    "Backup",
    "Não vou treinar hoje",
    "Meus dias",
    "Trocar senha",
    "Sair",
  ])("cobre %s", (nome) => {
    expect(nomes).toContain(nome);
  });

  it("não promete o mapa muscular na aba Corpo (§20.5)", () => {
    const corpo = secaoDoGuia("corpo")!;
    const texto = JSON.stringify(corpo).toLowerCase();
    expect(texto).not.toContain("mapa muscular");
  });
});

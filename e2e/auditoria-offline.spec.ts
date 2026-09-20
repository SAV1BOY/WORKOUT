/**
 * Auditoria final — lente "offline, robustez e dados" (SPEC §8).
 *
 * O que estes testes cobrem e os outros não: o que acontece quando a escrita
 * **quase** dá certo. A rede que cai depois de o servidor gravar e antes de a
 * resposta voltar, e o POST que falha uma vez enquanto os seguintes passam —
 * é aí que uma fila sem idempotência duplica (ou trava) e uma fila sem ordem
 * manda a série antes da sessão (chave estrangeira no banco de verdade) ou a
 * conclusão antes da criação (e a criação, reenviada, desfaz o fim do treino).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  abrirVisaoGeral,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  fixarRelogio,
  lerDoMock,
  requisicoesDoMock,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** 14/09/2026 é a segunda que abre o programa; 17/09 é a quinta de descanso. */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
const QUINTA = "2026-09-17T08:00:00-03:00";

interface LinhaSessao {
  id: string;
  status: string;
  duracao_s: number | null;
  sensacao: number | null;
  concluida_em: string | null;
  workout_id: string;
}

interface LinhaSerie {
  session_id: string;
  exercise_id: string;
  concluida: boolean;
}

test.beforeEach(async () => {
  await resetarMock();
});

/**
 * Quantos itens ainda esperam na fila de saída (a tabela `outbox` do Dexie).
 * Devolve -1 quando a página está navegando no meio da leitura — quem chama
 * está sempre dentro de um `expect.poll`, que tenta de novo.
 */
async function naFila(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((ok, falhou) => {
        const pedido = indexedDB.open("treino-terraco");
        pedido.onerror = () => falhou(pedido.error);
        pedido.onsuccess = () => {
          const banco = pedido.result;
          if (!banco.objectStoreNames.contains("outbox")) {
            banco.close();
            ok(0);
            return;
          }
          const conta = banco.transaction("outbox", "readonly").objectStore("outbox").count();
          conta.onsuccess = () => {
            ok(conta.result);
            banco.close();
          };
          conta.onerror = () => {
            falhou(conta.error);
            banco.close();
          };
        };
      }),
  ).catch(() => -1);
}

/**
 * "A rede voltou": o evento que zera o backoff da fila (SPEC §8).
 *
 * Os testes daqui congelam o relógio do navegador (a data do programa importa),
 * e o backoff da fila anda por `Date.now()` — sem este empurrão nada vence
 * aqui dentro. No celular quem acorda a fila é o tempo passar **ou** este
 * mesmo evento; cutucar de novo a cada volta do `poll` é o que o backoff de
 * verdade faria sozinho.
 */
async function redeVoltou(page: Page): Promise<void> {
  await page
    .evaluate(() => window.dispatchEvent(new Event("online")))
    .catch(() => {});
}

/** Marca a série `n` do exercício e espera o visto ficar marcado. */
async function marcar(page: Page, exercicio: string, n: number) {
  const visto = page
    .getByRole("group", { name: `Série ${n} — ${exercicio}` })
    .getByRole("checkbox");
  await visto.click();
  await expect(visto).toHaveAttribute("aria-checked", "true");
}

/** A ordem em que o mock recebeu o primeiro POST de cada tabela. */
async function ordemDosPosts(): Promise<Record<string, number>> {
  const pedidos = await requisicoesDoMock();
  const ordem: Record<string, number> = {};
  pedidos.forEach((p, i) => {
    if (p.metodo !== "POST") return;
    const tabela = p.caminho.replace("/rest/v1/", "");
    if (!(tabela in ordem)) ordem[tabela] = i;
  });
  return ordem;
}

test.describe("a resposta que se perde depois de o servidor gravar (SPEC §8)", () => {
  test("a repetição solta não duplica nem envenena a fila", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await fixarRelogio(page, QUINTA);
    await entrarNoApp(page);

    /*
     * A gravação chega ao servidor, a resposta não volta: é o 4G do terraço
     * caindo no pior instante. O item continua na fila e vai ser reenviado —
     * um `insert` bateria num 409 de chave repetida e ficaria preso para
     * sempre, tentando de 5 em 5 minutos numa fila que ninguém vê.
     */
    let engoliu = false;
    await page.route("**/rest/v1/pullup_singles*", async (rota) => {
      if (!engoliu && rota.request().method() === "POST") {
        engoliu = true;
        await rota.fetch();
        /*
         * Auditoria 17/09/2026: de vez em quando o navegador desiste da
         * requisição enquanto o `fetch` acima ainda corre. A rota já está
         * "handled" e o `abort` estoura com "Route is already handled!" —
         * o teste ficava vermelho por um detalhe do harness, com o app
         * fazendo exatamente o que o teste queria (o servidor gravou, a
         * resposta não voltou). Engolir a exceção não afrouxa nada: o que
         * vale continua sendo verificado embaixo (uma linha só no servidor e
         * a fila zerada).
         */
        await rota.abort("connectionfailed").catch(() => {});
        return;
      }
      await rota.continue();
    });

    await page
      .getByRole("button", { name: "Somar uma repetição solta de barra fixa" })
      .click();

    // o servidor gravou, mesmo sem o app saber
    await expect
      .poll(async () => (await lerDoMock(sessao, "pullup_singles")).length, {
        timeout: 10_000,
      })
      .toBe(1);
    expect(engoliu).toBe(true);

    await page.unroute("**/rest/v1/pullup_singles*");

    // o reenvio limpa a fila (upsert por id) e não cria uma segunda linha
    await expect
      .poll(
        async () => {
          await redeVoltou(page);
          return naFila(page);
        },
        { timeout: 30_000 },
      )
      .toBe(0);
    expect(await lerDoMock(sessao, "pullup_singles")).toHaveLength(1);
  });
});

test.describe("a rede voltando no meio do treino (SPEC §3.2 e §8)", () => {
  test("o app não se recarrega sozinho: o descanso e o cronômetro continuam", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();

    await marcar(page, "Agachamento livre", 1);
    // o timer de descanso abriu (SPEC §3.2)
    const descanso = page.getByRole("timer", { name: "Descanso" });
    await expect(descanso).toBeVisible();

    // uma marca que só sobrevive se a página NÃO recarregar
    await page.evaluate(() => {
      (window as unknown as { __marca?: number }).__marca = 42;
    });
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(1_000);

    expect(
      await page.evaluate(() => (window as unknown as { __marca?: number }).__marca),
    ).toBe(42);
    await expect(descanso).toBeVisible();
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
  });
});

test.describe("a criação da sessão que falha uma vez (SPEC §8)", () => {
  test("a conclusão não passa na frente e o treino não fica aberto para sempre", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const sessao = await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);

    /*
     * Um 401 de token vencido ao voltar a rede, um timeout: a primeira
     * tentativa de criar a sessão morre e as escritas seguintes passam. Com a
     * fila sem ordem, a série ia antes da sessão (a FK do `supabase/schema.sql`
     * recusaria) e a conclusão ia antes da criação: um `update` que não casa
     * com nenhuma linha é sucesso no PostgREST, e o fim do treino sumia.
     */
    let derrubou = false;
    await page.route(/\/rest\/v1\/sessions(\?|$)/, async (rota) => {
      if (!derrubou && rota.request().method() === "POST") {
        derrubou = true;
        await rota.abort("connectionfailed");
        return;
      }
      await rota.continue();
    });

    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();

    for (const n of [1, 2, 3]) await marcar(page, "Agachamento livre", n);

    await page.getByRole("button", { name: "Concluir" }).click();
    const resumo = page.getByRole("dialog");
    await expect(resumo.getByText("Treino concluído")).toBeVisible();
    await resumo.getByRole("radio", { name: "Um pouco fácil" }).click();
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);

    expect(derrubou).toBe(true);

    // a sessão chega inteira e CONCLUÍDA, com a duração e a sensação
    await expect
      .poll(
        async () => {
          await redeVoltou(page);
          return (await lerDoMock<LinhaSessao>(sessao, "sessions"))[0]?.status ?? "sem linha";
        },
        { timeout: 60_000 },
      )
      .toBe("concluida");
    const sessoes = await lerDoMock<LinhaSessao>(sessao, "sessions");
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.sensacao).toBe(4);
    expect(sessoes[0]?.duracao_s).not.toBeNull();
    expect(sessoes[0]?.concluida_em).not.toBeNull();

    // e as séries chegaram DEPOIS da sessão (a FK do banco de verdade)
    await expect
      .poll(
        async () =>
          (await lerDoMock<LinhaSerie>(sessao, "session_sets")).filter((s) => s.concluida)
            .length,
        { timeout: 30_000 },
      )
      .toBe(3);
    /*
     * Os eventos de progressão são a última coisa que a fila entrega: sem
     * esperar por eles, a leitura da ordem pegava a fila pela metade e o teste
     * falhava de vez em quando (auditoria do marco V1). A verificação é a
     * mesma — o que mudou foi esperar a fila terminar antes de olhar.
     */
    await expect
      .poll(async () => (await ordemDosPosts()).progression_events, { timeout: 30_000 })
      .toBeDefined();
    const ordem = await ordemDosPosts();
    expect(ordem.sessions).toBeDefined();
    expect(ordem.session_sets).toBeGreaterThan(ordem.sessions as number);
    expect(ordem.progression_events).toBeGreaterThan(ordem.sessions as number);
  });
});

test.describe("o Supabase cai no meio do treino e volta (SPEC §8 e §10.3)", () => {
  test("ao voltar, a sessão chega antes das séries e nada fica pela metade", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const sessao = await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);

    /*
     * Não é "modo avião": é o servidor sumindo com o celular achando que tem
     * rede (o 4G do terraço que responde ao Wi-Fi do prédio e não chega a
     * lugar nenhum). `navigator.onLine` continua true, então a fila não
     * espera o evento `online` — ela tem de se virar com o backoff.
     */
    await page.route("**/rest/v1/**", (rota) => rota.abort("connectionfailed"));
    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();

    for (const n of [1, 2, 3]) await marcar(page, "Agachamento livre", n);

    await page.getByRole("button", { name: "Concluir" }).click();
    const resumo = page.getByRole("dialog");
    await expect(resumo.getByText("Treino concluído")).toBeVisible();
    await resumo.getByRole("radio", { name: "Na medida certa" }).click();
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);

    // nada subiu: o treino inteiro está só no aparelho
    expect(await lerDoMock(sessao, "sessions")).toHaveLength(0);
    expect(await naFila(page)).toBeGreaterThan(3);

    // o servidor voltou (o evento `online` é o que zera o backoff, §8)
    await page.unroute("**/rest/v1/**");

    await expect
      .poll(
        async () => {
          await redeVoltou(page);
          return (await lerDoMock<LinhaSessao>(sessao, "sessions"))[0]?.status ?? "sem linha";
        },
        { timeout: 60_000 },
      )
      .toBe("concluida");
    await expect
      .poll(async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length, {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(3);

    const ordem = await ordemDosPosts();
    expect(ordem.session_sets).toBeGreaterThan(ordem.sessions as number);

    // a fila esvazia sozinha e o perfil sabe qual foi o último treino (§5.2)
    await expect
      .poll(
        async () => {
          await redeVoltou(page);
          return naFila(page);
        },
        { timeout: 30_000 },
      )
      .toBe(0);
    expect(
      (await lerDoMock<{ ultimo_treino: string | null }>(sessao, "profiles"))[0]
        ?.ultimo_treino,
    ).toBe("A1");
  });
});

test.describe("o treino começado SEM rede (SPEC §6.3, §8 e §14.1)", () => {
  /*
   * A aba Treino lê as cargas do treino do dia; `/treinar` lia as da fase
   * inteira, com outra chave, e o cache de uma não servia para a outra. Sem
   * rede, quem criava a sessão declarava o estado desconhecido e a sessão
   * inteira ficava sem avaliação: 0 exercise_state, 0 progression_events.
   */
  test("com o cache da aba Treino, o motor decide igual e grava ao voltar a rede", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const sessao = await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    // a aba Treino leu as cargas do dia (é o que vai para o cache persistido)
    await expect(
      page.getByRole("button", { name: "Ficha: Agachamento livre" }),
    ).toContainText("Hoje: 7,5 kg na barra");
    await esperarServiceWorker(page);
    // o cache é gravado no máximo 1× por segundo
    await page.waitForTimeout(1_500);

    await context.setOffline(true);
    await page.reload();
    await esperarAbaTreino(page);

    // começa, registra e conclui o treino inteiro sem rede
    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
    for (const n of [1, 2, 3]) await marcar(page, "Agachamento livre", n);

    await page.getByRole("button", { name: "Concluir" }).click();
    const resumo = page.getByRole("dialog");
    await expect(resumo.getByText("Treino concluído")).toBeVisible();
    // a sessão foi avaliada: nada de "sem avaliar, porque não consegui ler"
    await expect(resumo.getByText("Sem avaliar, porque")).toHaveCount(0);
    await resumo.getByRole("radio", { name: "Um pouco fácil" }).click();
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);

    // nada subiu enquanto não havia rede
    expect(await lerDoMock(sessao, "exercise_state")).toHaveLength(0);

    await context.setOffline(false);
    await expect.poll(async () => naFila(page), { timeout: 40_000 }).toBe(0);

    const estados = await lerDoMock<{ exercise_id: string }>(sessao, "exercise_state");
    const eventos = await lerDoMock<{ exercise_id: string }>(sessao, "progression_events");
    expect(estados.length).toBeGreaterThan(0);
    expect(eventos.length).toBeGreaterThan(0);
    expect(estados.map((e) => e.exercise_id)).toContain("agachamento-livre");
    expect(eventos.map((e) => e.exercise_id)).toContain("agachamento-livre");
  });
});

test.describe("uma rota de Mais aberta sem rede (SPEC §8 e §22.1)", () => {
  /*
   * O defeito: o fallback do service worker só cobria
   * `request.destination === "document"`. A navegação do App Router tem duas
   * formas — o documento e o `fetch` de RSC —, e a segunda morria antes de
   * virar navegação: `/mais/contas`, `/mais/senha` e `/mais/creditos` abriam a
   * página de erro do navegador, em branco.
   *
   * O que este teste NÃO consegue fazer é cortar a rede DO WORKER: medido em
   * 20/09/2026, nem `context.setOffline(true)` nem `context.route(...).abort()`
   * alcançam as requisições que o service worker faz por conta própria — com a
   * página "offline" o worker continuou trazendo `/mais/contas` do servidor,
   * inteira. Então o que se prende aqui é o que dá para observar de fora: a
   * `/~offline` guardada e pronta para ser servida, e o worker publicado com a
   * regra das duas formas de navegar. A decisão em si — quem ganha a
   * `/~offline` — está presa em `lib/sw-navegacao.test.ts`, e a página, em
   * `e2e/ultraloop-a-r1.spec.ts`.
   */
  test("a /~offline fica guardada e o worker cobre documento e RSC", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await esperarServiceWorker(page);

    // 1. sem a página no precache, o fallback cairia no HTML mínimo de socorro
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            for (const nome of await caches.keys()) {
              const cache = await caches.open(nome);
              const chaves = await cache.keys();
              if (chaves.some((r) => new URL(r.url).pathname === "/~offline")) {
                return true;
              }
            }
            return false;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);

    // 2. o worker publicado decide pelas DUAS formas de navegar
    const codigo = await (await request.get("/sw.js")).text();
    expect(codigo).toContain("/~offline");
    expect(codigo, "o fetch de RSC ficou de fora do fallback").toContain("_rsc");
    expect(codigo, "o cabeçalho RSC ficou de fora do fallback").toContain("RSC");

    // 3. e a tela que o worker serve abre e tem saída
    await page.goto("/~offline");
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o Treino" })).toBeVisible();
  });
});

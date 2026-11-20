/**
 * Ajudantes dos testes de ponta a ponta: falar com o mock do Supabase
 * (scripts/mock-supabase.ts), entrar no app e conferir o básico do celular.
 */
import { expect, type Locator, type Page } from "@playwright/test";

export const URL_MOCK =
  process.env.MOCK_SUPABASE_URL ??
  `http://127.0.0.1:${process.env.MOCK_SUPABASE_PORT ?? 54321}`;

/** O e-mail do dono do app (ALLOWED_EMAIL do playwright.config.ts, SPEC §21.1). */
export const EMAIL_DONO =
  process.env.ALLOWED_EMAIL ?? "miguelgsaviotti29@gmail.com";

export const SENHA = "senha-de-teste";

/** Segunda-feira, 14/09/2026 — o primeiro dia do programa (SPEC §5). */
export const HOJE_FIXO = "2026-09-14T08:00:00-03:00";

export interface Semente {
  usuarios?: { email: string; senha?: string }[];
  /** `app_config.max_contas` — a cota de contas do cenário (SPEC §21) */
  max_contas?: number;
  /** linhas por tabela de supabase/schema.sql; sem user_id usa o único usuário */
  tabelas?: Record<string, Record<string, unknown>[]>;
}

async function chamarMock(caminho: string, corpo?: unknown): Promise<unknown> {
  const resposta = await fetch(`${URL_MOCK}${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo ?? {}),
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`mock ${caminho} respondeu ${resposta.status}: ${texto}`);
  }
  return texto ? (JSON.parse(texto) as unknown) : null;
}

/** Zera usuários, tabelas e arquivos do mock. Chame no beforeEach. */
export async function resetarMock(): Promise<void> {
  await chamarMock("/__mock/reset");
}

/** Semeia usuários e linhas no mock. */
export async function semear(dados: Semente): Promise<unknown> {
  return chamarMock("/__mock/seed", dados);
}

/**
 * Muda a cota de contas no mock, sem passar pela tela (SPEC §21): é o cenário
 * do teste, como o `usuarios` da semente.
 */
export async function definirCota(max_contas: number): Promise<void> {
  await semear({ max_contas });
}

/** Ocupa a cota com contas de mentira, além da do dono. */
export async function encherACota(quantas: number): Promise<void> {
  await semear({
    usuarios: Array.from({ length: quantas }, (_, i) => ({
      email: `pessoa${i + 1}@exemplo.com`,
      senha: SENHA,
    })),
  });
}

/** O que o mock guardou (útil para conferir gravações). */
export async function estadoDoMock(): Promise<Record<string, unknown>> {
  const resposta = await fetch(`${URL_MOCK}/__mock/estado`);
  return (await resposta.json()) as Record<string, unknown>;
}

/**
 * A aba Treino (`/`) aberta. A camada visual v2 (SPEC §13.3) trocou o título
 * "Hoje" pela saudação com a data, então quem espera a tela espera a região.
 */
export async function esperarAbaTreino(page: Page): Promise<void> {
  // `exact`: o banner do treino aberto também é uma região ("Treino aberto")
  await expect(
    page.getByRole("region", { name: "Treino", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Clica numa das cinco abas (SPEC §13.2) pela navegação inferior. Sempre pelo
 * `nav`: a lista do dia tem links cujo texto contém "peso do corpo", e um
 * `getByRole("link", { name: "Corpo" })` solto casaria com eles.
 */
export async function irNaAba(page: Page, rotulo: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: rotulo, exact: true })
    .click();
}

/**
 * SPEC §20.1: uma conta recém-criada não tem `prefs.guia_visto`, então a aba
 * Treino a manda para o guia de uso. Este ajudante reconhece o guia e volta —
 * é o caminho de quem acabou de se cadastrar. Se o guia não aparecer (conta já
 * semeada com a marca), não faz nada.
 */
export async function passarPeloGuiaDaPrimeiraEntrada(page: Page): Promise<void> {
  /*
   * Esperar o botão, e não perguntar se ele já está na tela: o desvio para
   * `/mais/guia?inicio=1` acontece no navegador, depois de o perfil chegar, e
   * o próprio guia tem uma seção "Treino" — quem espera "a aba Treino ou o
   * botão" acha a seção do guia e segue em frente achando que já entrou.
   */
  const entendi = page.getByRole("button", { name: "Entendi, começar a treinar" });
  try {
    await entendi.waitFor({ timeout: 10_000 });
  } catch {
    return;   // conta semeada com `prefs.guia_visto`: não há guia no caminho
  }
  await entendi.click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
}

/**
 * Cria a conta do dono (ou entra, se já existir), passa pelo guia da primeira
 * entrada e espera cair na aba Treino. O mock já devolve sessão no signup —
 * não há confirmação de e-mail.
 */
export async function login(
  page: Page,
  email: string = EMAIL_DONO,
  senha: string = SENHA,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Criar conta" }).click();

  // conta já criada num teste anterior: entra com a mesma senha
  const jaExiste = page.getByText("Essa conta já existe");
  await expect
    .poll(
      async () =>
        (await jaExiste.count()) > 0 || !new URL(page.url()).pathname.startsWith("/login"),
      { timeout: 15_000 },
    )
    .toBe(true);
  if ((await jaExiste.count()) > 0) {
    await page.getByRole("button", { name: "Entrar" }).click();
  }

  await passarPeloGuiaDaPrimeiraEntrada(page);
  await esperarAbaTreino(page);
}

export interface SessaoMock {
  token: string;
  userId: string;
}

/** Cria a conta direto no mock (sem UI) e devolve o access token. */
export async function sessaoNoMock(
  email: string = EMAIL_DONO,
  senha: string = SENHA,
): Promise<SessaoMock> {
  const resposta = await fetch(`${URL_MOCK}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = (await resposta.json()) as {
    access_token?: string;
    user?: { id?: string };
  };
  if (!resposta.ok || !corpo.access_token || !corpo.user?.id) {
    throw new Error(`mock: signup falhou (${resposta.status})`);
  }
  return { token: corpo.access_token, userId: corpo.user.id };
}

/** Congela o relógio do navegador (o servidor continua com a data real). */
export async function fixarRelogio(
  page: Page,
  quando: string = HOJE_FIXO,
): Promise<void> {
  await page.clock.install({ time: new Date(quando) });
}

/**
 * Fixa só a DATA, deixando os relógios do navegador correndo
 * (`page.clock.install` congela `setTimeout`/`setInterval` também, e a sessão
 * de força depende deles: debounce do IndexedDB, timer de descanso, fila).
 */
export async function fixarData(
  page: Page,
  quando: string = HOJE_FIXO,
): Promise<void> {
  await page.clock.setFixedTime(new Date(quando));
}

/**
 * Espera o service worker assumir o controle da página — é o que "o app
 * instalado" quer dizer (SPEC §8). Registrar não basta: enquanto o precache
 * não termina, `navigator.serviceWorker.controller` é `null` e uma navegação
 * offline morre em ERR_INTERNET_DISCONNECTED sem nem chegar ao SW.
 */
export async function esperarServiceWorker(page: Page, timeout = 60_000): Promise<void> {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
    timeout,
    polling: 200,
  });
}

/** A 360 px nada pode vazar para o lado. */
export async function semRolagemHorizontal(page: Page): Promise<void> {
  const vazou = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(vazou, "a página rolou para o lado a 360 px").toBeLessThanOrEqual(0);
}

/** As requisições que chegaram ao mock desde o último reset (sem /__mock). */
export async function requisicoesDoMock(): Promise<
  { metodo: string; caminho: string }[]
> {
  const estado = await estadoDoMock();
  return (estado.requisicoes ?? []) as { metodo: string; caminho: string }[];
}

/** Cabeçalhos de uma chamada PostgREST autenticada no mock. */
function cabecalhos(sessao: SessaoMock): Record<string, string> {
  return {
    "content-type": "application/json",
    apikey: "mock-anon",
    authorization: `Bearer ${sessao.token}`,
    prefer: "return=representation",
  };
}

/** Insere linhas direto no mock, como o usuário da sessão (RLS aplicada). */
export async function inserirNoMock(
  sessao: SessaoMock,
  tabela: string,
  linhas: Record<string, unknown>[],
): Promise<void> {
  const resposta = await fetch(`${URL_MOCK}/rest/v1/${tabela}`, {
    method: "POST",
    headers: cabecalhos(sessao),
    body: JSON.stringify(linhas),
  });
  if (!resposta.ok) {
    throw new Error(`mock: insert em ${tabela} falhou (${resposta.status}): ${await resposta.text()}`);
  }
}

/** Atualiza linhas no mock (ex.: `user_id=eq.<id>`). */
export async function atualizarNoMock(
  sessao: SessaoMock,
  tabela: string,
  filtro: string,
  campos: Record<string, unknown>,
): Promise<void> {
  const resposta = await fetch(`${URL_MOCK}/rest/v1/${tabela}?${filtro}`, {
    method: "PATCH",
    headers: cabecalhos(sessao),
    body: JSON.stringify(campos),
  });
  if (!resposta.ok) {
    throw new Error(`mock: update em ${tabela} falhou (${resposta.status}): ${await resposta.text()}`);
  }
}

/** Lê linhas do mock para conferir o que o app gravou. */
export async function lerDoMock<T = Record<string, unknown>>(
  sessao: SessaoMock,
  tabela: string,
  consulta = "select=*",
): Promise<T[]> {
  const resposta = await fetch(`${URL_MOCK}/rest/v1/${tabela}?${consulta}`, {
    headers: cabecalhos(sessao),
  });
  if (!resposta.ok) {
    throw new Error(`mock: select em ${tabela} falhou (${resposta.status})`);
  }
  return (await resposta.json()) as T[];
}

/**
 * Prepara o usuário do app já com o perfil semeado (como `garantirPerfil`
 * deixaria) e com os ajustes pedidos — `ultimo_treino`, semanas do plano etc.
 */
export async function usuarioComPerfil(
  ajustes: Record<string, unknown> = {},
): Promise<SessaoMock> {
  const sessao = await sessaoNoMock();
  /*
   * SPEC §20.1: um perfil sem `prefs.guia_visto` é conta nova, e a aba Treino
   * manda para o guia de uso. Como o `prefs` daqui SUBSTITUI o do mock, a marca
   * é reposta sempre — quem quiser a primeira entrada de verdade (e2e/guia)
   * escreve o perfil com `atualizarNoMock` e `prefs` sem a chave.
   */
  const prefs = {
    guia_visto: true,
    ...((ajustes.prefs as Record<string, unknown> | undefined) ?? {}),
  };
  await atualizarNoMock(sessao, "profiles", `user_id=eq.${sessao.userId}`, {
    nome: "Miguel",
    altura_cm: 190,
    data_inicio: "2026-09-14",
    fase_atual: "fase1",
    fase_desde: "2026-09-14",
    ...ajustes,
    prefs,
  });
  return sessao;
}

/** Entra com uma conta que já existe no mock (sem passar por "Criar conta"). */
export async function entrarNoApp(
  page: Page,
  email: string = EMAIL_DONO,
  senha: string = SENHA,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await esperarAbaTreino(page);
}

/**
 * O gesto da §14.5.1: o botão largo do card do dia **cria a sessão e entra no
 * player**, sem a tela `/treinar` no meio. `/treinar` continua existindo para
 * escolher o outro treino da fase (§5.3).
 */
export async function comecarOTreinoDoDia(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Começar treino" }).click();
  await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
}

/**
 * A preparação pode terminar enquanto o navegador entrega o toque. Só o
 * botão daquela tela pode recebê-lo. Com o relógio fixo o toque é necessário.
 */
async function passarDaPreparacao(page: Page, destino: Locator): Promise<void> {
  const comecar = page.getByRole("button", { name: "Começar agora", exact: true });
  await comecar.or(destino).first().waitFor();
  const [botao] = await comecar.elementHandles();
  if (botao) {
    try {
      await botao.click();
    } catch (erro) {
      if (await botao.evaluate(elemento => elemento.isConnected)) throw erro;
    } finally {
      await botao.dispose();
    }
    await comecar.waitFor({ state: "hidden" });
  }
  await destino.waitFor();
}

export async function comecarNoPlayer(page: Page): Promise<void> {
  await passarDaPreparacao(page, page.getByRole("button", { name: "Concluir série", exact: true }));
}

const ROTULO_DO_PASSO = /^(Aquecimento|Série) \d+ de \d+ · exercício \d+ de \d+/;

/** Grava a série, espera a saída daquela etapa e pula só o descanso que veio depois. */
export async function concluirSerie(page: Page): Promise<void> {
  const concluir = page.getByRole("button", { name: "Concluir série", exact: true });
  const etapa = await page.getByRole("region").filter({ has: concluir }).getByText(ROTULO_DO_PASSO).innerText();
  await concluir.click();
  await expect(page.getByText(etapa, { exact: true })).toBeHidden();

  const pular = page.getByRole("button", { name: "Pular descanso", exact: true });
  const firme = page.getByRole("region", { name: "Última repetição", exact: true });
  const feedback = page.getByRole("region", { name: "Feedback do treino", exact: true });
  await pular.or(concluir).or(firme).or(feedback).first().waitFor();
  if (await pular.isVisible()) {
    await pular.click();
    await expect(pular).toBeHidden();
  }
}

/** Anda pelas séries e descansos. A chegada ao feedback deixa a resposta para quem chamou. */
export async function avancarNoPlayerAte(page: Page, alvo: Locator): Promise<void> {
  const descanso = page.getByRole("region", { name: "Descanso", exact: true });
  const pergunta = page.getByRole("region", { name: "Última repetição", exact: true });
  const serie = page.getByText(ROTULO_DO_PASSO);
  const passos = serie.or(descanso).or(pergunta);

  for (let i = 0; i < 80; i++) {
    await passos.or(alvo).first().waitFor();
    const identidade = await passos.evaluateAll(([el]) =>
      el?.getAttribute("aria-label") ?? el?.textContent?.trim(),
    );
    if (await alvo.isVisible()) return;
    if (!identidade) continue;

    const ehDescanso = identidade === "Descanso";
    const ehPergunta = identidade === "Última repetição";
    const atual = ehDescanso ? descanso : ehPergunta ? pergunta : page.getByText(identidade, { exact: true });
    const tela = ehDescanso || ehPergunta ? atual : page.getByRole("region").filter({ has: atual });
    const nome = ehDescanso ? "Pular descanso" : ehPergunta ? "Pular esta pergunta" : "Próximo passo";

    // Um elemento desta etapa não pode ser resolvido de novo numa etapa futura.
    // A pergunta já respondida avança sozinha e não tem o botão de pular.
    const [botao] = await tela.getByRole("button", { name: nome, exact: true }).elementHandles();
    if (botao) {
      try {
        await botao.click();
      } catch (erro) {
        if (await atual.isVisible()) throw erro;
      } finally {
        await botao.dispose();
      }
    }
    await expect(atual).toBeHidden();
  }
  await expect(alvo).toBeVisible();
}

/**
 * A visão geral da sessão — a folha de rolagem com todas as séries, que o
 * player abre pelo ícone de lista (SPEC §14.1). É por ela que se corrige
 * qualquer série e se encerra o treino.
 */
export async function abrirVisaoGeral(page: Page): Promise<void> {
  const lista = page.getByRole("button", { name: "Visão geral do treino" });
  await passarDaPreparacao(page, lista);
  await lista.click();
  await page.getByRole("heading", { level: 1 }).waitFor();
}

/** O visto da Visão geral confirma a série quando o aparelho termina a gravação. */
export async function marcarSerieNaVisaoGeral(visto: Locator): Promise<void> {
  if (!(await visto.isChecked())) await visto.click();
  await expect(visto).toBeChecked();
}

/**
 * Abre uma das cinco seções dobráveis do Relatório (SPEC §22.6 item 1):
 * `resumo`, `conquistas`, `historico`, `corpo` ou `graficos`. A tela abre só
 * com o Resumo — as outras estão a um toque do cabeçalho, e é esse toque que
 * este ajudante dá. Se a seção já estiver aberta (o estado é lembrado em
 * `localStorage`), não faz nada.
 */
export async function abrirSecaoDoRelatorio(page: Page, id: string): Promise<void> {
  const secao = page.locator(`details[data-secao="${id}"]`);
  await secao.waitFor();
  if (await secao.evaluate((d) => (d as HTMLDetailsElement).open)) return;
  await secao.locator("summary").click();
  await expect(secao).toHaveAttribute("open", "");
}

/**
 * Quantos itens ainda esperam na fila de saída (a tabela `outbox` do Dexie).
 * Devolve -1 quando a página está navegando no meio da leitura — quem chama
 * está sempre dentro de um `expect.poll`, que tenta de novo.
 */
export async function naFila(page: Page): Promise<number> {
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


/** Segura uma escrita concorrente até o teste liberar o IndexedDB. */
export async function ocuparArmazenamentoDaSessao(page: Page, id: string) {
  const liberar = await page.evaluateHandle(id => new Promise<() => void>((resolve, reject) => {
    const abertura = indexedDB.open("treino-terraco");
    abertura.onerror = () => reject(abertura.error);
    abertura.onsuccess = () => {
      const banco = abertura.result;
      const tx = banco.transaction("sessaoAtiva", "readwrite");
      const sessoes = tx.objectStore("sessaoAtiva");
      let ocupada = true;
      tx.oncomplete = () => banco.close();
      tx.onabort = () => { banco.close(); reject(tx.error); };
      const proximaLeitura = () => {
        if (ocupada) sessoes.getKey(id).onsuccess = proximaLeitura;
      };
      // A primeira leitura confirma que esta transação tem a vez. Leituras encadeadas
      // mantêm a transação ativa, sem alterar a sessão nem depender de um atraso arbitrário.
      sessoes.getKey(id).onsuccess = () => {
        proximaLeitura();
        resolve(() => { ocupada = false; });
      };
    };
  }), id);
  return async () => {
    await liberar.evaluate(soltar => soltar());
    await liberar.dispose();
  };
}

/** Descarta só os dados de leitura, fora do app, para refazê-los na rede. */
export async function semCacheDoAparelho(page: Page): Promise<void> {
  await page.goto("/robots.txt");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const pedido = indexedDB.open("treino-terraco");
        pedido.onerror = () => reject(pedido.error);
        pedido.onsuccess = () => {
          const banco = pedido.result;
          if (!banco.objectStoreNames.contains("cache")) {
            banco.close();
            resolve();
            return;
          }
          const tx = banco.transaction("cache", "readwrite");
          tx.objectStore("cache").delete("react-query-v1");
          tx.oncomplete = () => {
            banco.close();
            resolve();
          };
          tx.onerror = () => {
            banco.close();
            reject(tx.error);
          };
        };
      }),
  );
}

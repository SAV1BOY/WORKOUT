/**
 * O harness testando a si mesmo: o contrato do scripts/mock-supabase.ts que os
 * marcos 3+ vão usar (sessões, séries, upsert, recordes, storage, RLS).
 * Sem navegador — só HTTP.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { URL_MOCK, resetarMock, sessaoNoMock } from "./fixtures";

let token = "";
let userId = "";

function comSessao(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: "mock-anon",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    ...extra,
  };
}

async function json(resposta: { json(): Promise<unknown> }): Promise<unknown> {
  return resposta.json();
}

test.describe("mock do Supabase", () => {
  test.beforeEach(async () => {
    await resetarMock();
    const sessao = await sessaoNoMock();
    token = sessao.token;
    userId = sessao.userId;
  });

  test("o signup dispara o handle_new_user e cria o perfil", async ({ request }) => {
    const resposta = await request.get(`${URL_MOCK}/rest/v1/profiles?select=*`, {
      headers: comSessao(),
    });
    expect(resposta.status()).toBe(200);
    const linhas = (await json(resposta)) as Record<string, unknown>[];
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.user_id).toBe(userId);
    expect(linhas[0]?.nome).toBe("Miguel");
    expect(linhas[0]?.fase_atual).toBe("fase1");
    expect(linhas[0]?.prefs).toMatchObject({ tema: "auto" });
  });

  test("sem token a RLS não devolve linha nenhuma", async ({ request }) => {
    const resposta = await request.get(`${URL_MOCK}/rest/v1/profiles?select=*`, {
      headers: { apikey: "mock-anon" },
    });
    expect(resposta.status()).toBe(401);
  });

  /**
   * O `@supabase/ssr` renova a sessão no servidor (middleware) e no navegador;
   * com o token vencido as duas chamadas saem quase juntas com o MESMO refresh
   * token. O GoTrue tolera isso por uns segundos
   * (`SECURITY_REFRESH_TOKEN_REUSE_INTERVAL`); sem essa janela o segundo pedido
   * derrubaria a sessão e o app cairia no /login no meio da navegação.
   */
  test("o refresh token aceita ser trocado duas vezes seguidas", async ({ request }) => {
    const entrada = await request.post(
      `${URL_MOCK}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: "mock-anon", "content-type": "application/json" },
        data: { email: "miguelgsaviotti29@gmail.com", password: "senha-de-teste" },
      },
    );
    const sessao = (await json(entrada)) as { refresh_token: string };

    const trocar = () =>
      request.post(`${URL_MOCK}/auth/v1/token?grant_type=refresh_token`, {
        headers: { apikey: "mock-anon", "content-type": "application/json" },
        data: { refresh_token: sessao.refresh_token },
      });

    const [uma, outra] = await Promise.all([trocar(), trocar()]);
    expect(uma.status()).toBe(200);
    expect(outra.status()).toBe(200);
    const nova = (await json(uma)) as { refresh_token: string };
    expect(nova.refresh_token).not.toBe(sessao.refresh_token);

    // um token inventado continua sendo recusado
    const errado = await request.post(
      `${URL_MOCK}/auth/v1/token?grant_type=refresh_token`,
      {
        headers: { apikey: "mock-anon", "content-type": "application/json" },
        data: { refresh_token: "mock-refresh-inventado" },
      },
    );
    expect(errado.status()).toBe(400);
  });

  test("recurso que o mock não implementa falha alto e claro", async ({ request }) => {
    const resposta = await request.get(`${URL_MOCK}/rest/v1/tabela_inventada?select=*`, {
      headers: comSessao(),
    });
    expect(resposta.status()).toBe(400);
    expect(JSON.stringify(await json(resposta))).toContain(
      "mock: recurso tabela_inventada não implementado",
    );
  });

  test("sessão de força: insert, filtros, ordem, count e v_records", async ({
    request,
  }) => {
    const sessaoId = crypto.randomUUID();
    const criada = await request.post(`${URL_MOCK}/rest/v1/sessions`, {
      headers: comSessao({ Prefer: "return=representation" }),
      data: {
        id: sessaoId,
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
      },
    });
    expect(criada.status()).toBe(201);
    const linhas = (await json(criada)) as Record<string, unknown>[];
    // defaults do schema
    expect(linhas[0]?.status).toBe("em_andamento");
    expect(linhas[0]?.user_id).toBe(userId);

    const series = [1, 2, 3].map((i) => ({
      id: crypto.randomUUID(),
      session_id: sessaoId,
      exercise_id: "supino-reto-com-barra",
      ordem_ex: 1,
      set_index: i,
      reps: 5 + i,
      carga_kg: 30 + i,
      concluida: true,
    }));
    const gravadas = await request.post(`${URL_MOCK}/rest/v1/session_sets`, {
      headers: comSessao(),
      data: series,
    });
    expect(gravadas.status()).toBe(201);

    const ordenadas = await request.get(
      `${URL_MOCK}/rest/v1/session_sets?select=set_index,carga_kg&session_id=eq.${sessaoId}&order=set_index.desc`,
      { headers: comSessao({ Prefer: "count=exact" }) },
    );
    expect(ordenadas.headers()["content-range"]).toBe("0-2/3");
    expect(await json(ordenadas)).toEqual([
      { set_index: 3, carga_kg: 33 },
      { set_index: 2, carga_kg: 32 },
      { set_index: 1, carga_kg: 31 },
    ]);

    const filtradas = await request.get(
      `${URL_MOCK}/rest/v1/session_sets?select=set_index&set_index=gte.2&reps=in.(6,7,8)`,
      { headers: comSessao() },
    );
    expect(await json(filtradas)).toEqual([{ set_index: 2 }, { set_index: 3 }]);

    // a view calculada a partir de session_sets
    const recordes = await request.get(`${URL_MOCK}/rest/v1/v_records?select=*`, {
      headers: comSessao(),
    });
    const recorde = ((await json(recordes)) as Record<string, unknown>[])[0];
    expect(recorde?.exercise_id).toBe("supino-reto-com-barra");
    expect(recorde?.carga_max_kg).toBe(33);
    expect(recorde?.reps_max).toBe(8);

    // concluir a sessão
    const patch = await request.patch(
      `${URL_MOCK}/rest/v1/sessions?id=eq.${sessaoId}`,
      {
        headers: comSessao({
          Prefer: "return=representation",
          Accept: "application/vnd.pgrst.object+json",
        }),
        data: { status: "concluida", duracao_s: 2640 },
      },
    );
    expect(patch.status()).toBe(200);
    expect(await json(patch)).toMatchObject({ status: "concluida", duracao_s: 2640 });
  });

  test("upsert por chave real e o 406 do single", async ({ request }) => {
    const gravar = (peso: number) =>
      request.post(`${URL_MOCK}/rest/v1/body_weights?on_conflict=user_id,data`, {
        headers: comSessao({
          Prefer: "resolution=merge-duplicates,return=representation",
          Accept: "application/vnd.pgrst.object+json",
        }),
        data: { data: "2026-09-14", peso_kg: peso },
      });

    expect(await json(await gravar(80.4))).toMatchObject({ peso_kg: 80.4 });
    expect(await json(await gravar(80.9))).toMatchObject({ peso_kg: 80.9 });

    const todas = await request.get(`${URL_MOCK}/rest/v1/body_weights?select=*`, {
      headers: comSessao(),
    });
    expect((await json(todas)) as unknown[]).toHaveLength(1);

    // exercise_state tem chave composta (user_id, exercise_id)
    for (const carga of [26.5, 28.5]) {
      const r = await request.post(
        `${URL_MOCK}/rest/v1/exercise_state?on_conflict=user_id,exercise_id`,
        {
          headers: comSessao({ Prefer: "resolution=merge-duplicates" }),
          data: { exercise_id: "agachamento-livre", carga_atual_kg: carga },
        },
      );
      expect(r.status()).toBe(201);
    }
    const estado = await request.get(
      `${URL_MOCK}/rest/v1/exercise_state?select=carga_atual_kg,falhas_seguidas&exercise_id=eq.agachamento-livre`,
      { headers: comSessao({ Accept: "application/vnd.pgrst.object+json" }) },
    );
    expect(await json(estado)).toEqual({ carga_atual_kg: 28.5, falhas_seguidas: 0 });

    // single com 0 linhas = 406 (é o que o postgrest-js traduz em PGRST116)
    const vazio = await request.get(
      `${URL_MOCK}/rest/v1/exercise_state?select=*&exercise_id=eq.nao-existe`,
      { headers: comSessao({ Accept: "application/vnd.pgrst.object+json" }) },
    );
    expect(vazio.status()).toBe(406);
  });

  test("coluna fora do schema é recusada", async ({ request }) => {
    const resposta = await request.post(`${URL_MOCK}/rest/v1/sessions`, {
      headers: comSessao(),
      data: { data: "2026-09-14", workout_id: "A1", fase: "fase1", inventada: 1 },
    });
    expect(resposta.status()).toBe(400);
    expect(JSON.stringify(await json(resposta))).toContain("sessions.inventada");
  });

  test("storage: sobe, lista, assina, baixa e apaga a foto", async ({ request }) => {
    const caminho = `${userId}/2026-09-14-frente.jpg`;
    const enviar = async (ctx: APIRequestContext) =>
      ctx.post(`${URL_MOCK}/storage/v1/object/progresso/${caminho}`, {
        headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
        data: Buffer.from("foto-de-mentira"),
      });

    const enviada = await enviar(request);
    expect(enviada.status()).toBe(200);
    expect(await json(enviada)).toMatchObject({ Key: `progresso/${caminho}` });

    const lista = await request.post(`${URL_MOCK}/storage/v1/object/list/progresso`, {
      headers: comSessao(),
      data: { prefix: userId },
    });
    const arquivos = (await json(lista)) as Record<string, unknown>[];
    expect(arquivos).toHaveLength(1);
    expect(arquivos[0]?.name).toBe("2026-09-14-frente.jpg");

    const assinada = await request.post(
      `${URL_MOCK}/storage/v1/object/sign/progresso/${caminho}`,
      { headers: comSessao(), data: { expiresIn: 60 } },
    );
    const { signedURL } = (await json(assinada)) as { signedURL: string };
    const baixada = await request.get(`${URL_MOCK}/storage/v1${signedURL}`);
    expect(await baixada.text()).toBe("foto-de-mentira");

    // RLS do bucket: caminho fora da pasta do usuário
    const proibida = await request.post(
      `${URL_MOCK}/storage/v1/object/progresso/outra-pessoa/x.jpg`,
      {
        headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
        data: Buffer.from("x"),
      },
    );
    expect(proibida.status()).toBe(403);

    const apagada = await request.delete(`${URL_MOCK}/storage/v1/object/progresso`, {
      headers: comSessao(),
      data: { prefixes: [caminho] },
    });
    expect(apagada.status()).toBe(200);
    const depois = await request.post(`${URL_MOCK}/storage/v1/object/list/progresso`, {
      headers: comSessao(),
      data: { prefix: userId },
    });
    expect((await json(depois)) as unknown[]).toHaveLength(0);
  });

  test("storage: o upload multipart guarda o arquivo, não o envelope", async ({
    request,
  }) => {
    // é assim que o supabase-js sobe um Blob do navegador (SPEC §3.8)
    const caminho = `${userId}/2026-09-14-lado.jpg`;
    const limite = "----WebKitFormBoundaryTeste";
    const conteudo = "bytes-da-foto";
    const corpo = Buffer.from(
      `--${limite}\r\n` +
        `Content-Disposition: form-data; name="cacheControl"\r\n\r\n3600\r\n` +
        `--${limite}\r\n` +
        `Content-Disposition: form-data; name=""; filename="foto.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n${conteudo}\r\n` +
        `--${limite}--\r\n`,
      "latin1",
    );

    const enviada = await request.post(
      `${URL_MOCK}/storage/v1/object/progresso/${caminho}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": `multipart/form-data; boundary=${limite}`,
        },
        data: corpo,
      },
    );
    expect(enviada.status()).toBe(200);

    const baixada = await request.get(
      `${URL_MOCK}/storage/v1/object/authenticated/progresso/${caminho}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(await baixada.text()).toBe(conteudo);
    expect(baixada.headers()["content-type"]).toBe("image/jpeg");

    const lista = await request.post(`${URL_MOCK}/storage/v1/object/list/progresso`, {
      headers: comSessao(),
      data: { prefix: userId },
    });
    const arquivos = (await json(lista)) as { metadata?: { size?: number } }[];
    expect(arquivos[0]?.metadata?.size).toBe(conteudo.length);
  });

  test("a semente enche as tabelas e o reset esvazia", async ({ request }) => {
    const semeado = await request.post(`${URL_MOCK}/__mock/seed`, {
      headers: { "content-type": "application/json" },
      data: {
        tabelas: {
          pullup_singles: [
            { data: "2026-09-14", reps: 3 },
            { data: "2026-09-15", reps: 2 },
          ],
        },
      },
    });
    expect(semeado.status()).toBe(200);

    const lidas = await request.get(
      `${URL_MOCK}/rest/v1/pullup_singles?select=data,reps&order=data.asc`,
      { headers: comSessao() },
    );
    expect(await json(lidas)).toEqual([
      { data: "2026-09-14", reps: 3 },
      { data: "2026-09-15", reps: 2 },
    ]);

    await resetarMock();
    const vazio = await request.get(`${URL_MOCK}/rest/v1/pullup_singles?select=*`, {
      headers: comSessao(),
    });
    // o reset apaga o usuário junto: o token antigo não vale mais
    expect(vazio.status()).toBe(401);
  });
});

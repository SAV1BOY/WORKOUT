/**
 * AUDITORIA FINAL — lente "segurança".
 *
 * O que estes testes seguram, e que nenhum outro segurava:
 *  1. `supabase/schema.sql` — RLS ligada e policy do dono em TODA tabela, view
 *     com `security_invoker` (sem isso a view passa por cima da RLS e o
 *     PostgREST entrega os dados a quem tiver a chave anon, que é pública),
 *     bucket das fotos privado e preso ao `user_id` no caminho, e a cota de
 *     contas da SPEC §21 (trigger de vaga, `app_config` só do dono, e o e-mail
 *     do dono sem sair pelo PostgREST).
 *  2. As 11 tabelas do backup (§9) são exatamente as tabelas com RLS: uma
 *     tabela nova sem policy, ou um backup apontando para tabela que não
 *     existe, quebra aqui.
 *  3. O mock do Supabase (scripts/mock-supabase.ts) não é importado por nada
 *     que vá para o bundle.
 *  4. Nenhuma chave de verdade versionada no schema nem no `.env.local.example`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TABELAS_BACKUP } from "@/lib/backup";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const schema = readFileSync(join(RAIZ, "supabase", "schema.sql"), "utf8");

/**
 * `public.app_config` (SPEC §21.2) é a única tabela sem `user_id`: é a cota de
 * contas, uma linha só, e quem a protege é `sou_o_dono()` em vez da RLS por
 * dono da linha. Ela fica de fora das listas "por usuário" e tem testes
 * próprios mais abaixo.
 */
const TABELAS_DE_CONFIGURACAO = ["app_config"];

/**
 * `public.lembretes_inscricoes` (SPEC §23.2) tem `user_id`, mas é do
 * **aparelho**, não do treino: a inscrição de push só vale no navegador que a
 * criou, então não entra no backup (importar num celular novo não faria o
 * aviso chegar lá). E a RLS é mais estreita que a do laço: select, insert e
 * delete das suas, sem update. Testes próprios logo abaixo.
 */
const TABELAS_POR_APARELHO = ["lembretes_inscricoes"];

/** As tabelas criadas no schema. */
function tabelasCriadas(): string[] {
  return [...schema.matchAll(/create table if not exists public\.(\w+)/g)].map(
    (m) => m[1] as string,
  );
}

/** As tabelas de dados do usuário (todas menos as de configuração). */
function tabelasDoUsuario(): string[] {
  return tabelasCriadas().filter(
    (t) => !TABELAS_DE_CONFIGURACAO.includes(t) && !TABELAS_POR_APARELHO.includes(t),
  );
}

/** Os nomes listados no laço que liga a RLS e cria a policy do dono. */
function tabelasComRls(): string[] {
  const bloco = /unnest\(array\[([^\]]+)\]\)/s.exec(schema);
  if (!bloco) return [];
  return [...(bloco[1] as string).matchAll(/'([\w]+)'/g)].map(
    (m) => m[1] as string,
  );
}

describe("schema.sql: RLS", () => {
  it("existem tabelas e todas as do usuário passam pelo laço da RLS", () => {
    const criadas = tabelasDoUsuario();
    expect(criadas.length).toBeGreaterThan(0);
    expect([...tabelasComRls()].sort()).toEqual([...criadas].sort());
  });

  it("a tabela de configuração existe e NÃO entra no laço por user_id", () => {
    // se app_config entrasse no laço, a policy pediria um user_id que ela não tem
    for (const tabela of TABELAS_DE_CONFIGURACAO) {
      expect(tabelasCriadas(), `${tabela} não existe no schema`).toContain(tabela);
      expect(tabelasComRls()).not.toContain(tabela);
    }
  });

  it("as tabelas por aparelho têm RLS e só select/insert/delete por auth.uid()", () => {
    for (const tabela of TABELAS_POR_APARELHO) {
      expect(tabelasCriadas(), `${tabela} não existe no schema`).toContain(tabela);
      expect(tabelasComRls()).not.toContain(tabela);
      expect([...TABELAS_BACKUP]).not.toContain(tabela);
      expect(schema).toContain(`alter table public.${tabela} enable row level security`);
      const policies = [
        ...schema.matchAll(
          new RegExp(`create policy "(\\w+)" on public\\.${tabela} for (\\w+) to (\\w+)\\s+([^;]*);`, "g"),
        ),
      ];
      expect(policies.map((p) => p[2]).sort()).toEqual(["delete", "insert", "select"]);
      for (const [, nome, , papel, corpo] of policies) {
        expect(papel, `policy ${nome}`).toBe("authenticated");
        expect(corpo, `policy ${nome}`).toMatch(/\(user_id = auth\.uid\(\)\)$/);
      }
    }
  });

  it("o laço liga a RLS e cria a policy do dono com `using` e `with check`", () => {
    expect(schema).toContain("enable row level security");
    expect(schema).toMatch(/using \(user_id = auth\.uid\(\)\)/);
    expect(schema).toMatch(/with check \(user_id = auth\.uid\(\)\)/);
    expect(schema).toContain("for all to authenticated");
  });

  it("toda tabela do usuário tem user_id (a policy depende dele)", () => {
    for (const tabela of tabelasDoUsuario()) {
      const corpo = new RegExp(
        `create table if not exists public\\.${tabela} \\(([\\s\\S]*?)\\n\\);`,
      ).exec(schema);
      expect(corpo, `tabela ${tabela} sem corpo`).not.toBeNull();
      expect(corpo?.[1], `tabela ${tabela} sem user_id`).toContain("user_id");
    }
  });

  it("as 11 tabelas do backup (§9) são as tabelas com RLS", () => {
    expect([...TABELAS_BACKUP].sort()).toEqual([...tabelasDoUsuario()].sort());
    // a cota é do app, não de quem exporta: nunca entra no backup
    for (const tabela of TABELAS_DE_CONFIGURACAO) {
      expect([...TABELAS_BACKUP]).not.toContain(tabela);
    }
  });
});

describe("schema.sql: a cota de contas (SPEC §21)", () => {
  /** O literal do bloco "AJUSTE AQUI" (public.allowed_email()). */
  function emailDaConstante(): string | undefined {
    return /create or replace function public\.allowed_email\(\)[\s\S]*?select '([^']+)'::text/
      .exec(schema)?.[1];
  }

  /** O corpo de uma função do schema, do `create` até o `$$;` que a fecha. */
  function corpoDaFuncao(nome: string): string {
    const achado = new RegExp(
      `create or replace function public\\.${nome}\\([\\s\\S]*?\\$\\$;`,
    ).exec(schema);
    expect(achado, `função ${nome} não existe no schema`).not.toBeNull();
    return achado?.[0] ?? "";
  }

  it("a constante devolve o mesmo e-mail do ALLOWED_EMAIL (o dono)", () => {
    const exemplo = readFileSync(join(RAIZ, ".env.local.example"), "utf8");
    const doEnv = /ALLOWED_EMAIL=(.+)/.exec(exemplo)?.[1]?.trim();
    expect(doEnv).toBeTruthy();
    expect(emailDaConstante()).toBe(doEnv);
  });

  it("a constante não vaza pelo PostgREST", () => {
    expect(schema).toContain(
      "revoke all on function public.allowed_email() from public, anon, authenticated",
    );
    // e não ganhou grant nenhum depois do revoke
    expect(schema).not.toMatch(
      /grant execute on function public\.allowed_email\(\)/,
    );
  });

  it("o e-mail do dono só sai como booleano (sou_o_dono)", () => {
    const corpo = corpoDaFuncao("sou_o_dono");
    expect(corpo).toContain("returns boolean");
    expect(corpo).toContain("security definer");
    expect(corpo).toContain("auth.jwt() ->> 'email'");
    expect(schema).toContain(
      "revoke all on function public.sou_o_dono() from public, anon",
    );
    expect(schema).toContain(
      "grant execute on function public.sou_o_dono() to authenticated",
    );
    // nunca para o anon: quem não entrou não pergunta quem é o dono
    expect(schema).not.toMatch(
      /grant execute on function public\.sou_o_dono\(\) to[^;]*anon/,
    );
  });

  it("um trigger `before insert on auth.users` recusa a conta sem vaga", () => {
    // BEFORE, para abortar antes do AFTER que cria o perfil
    expect(schema).toMatch(
      /create trigger on_auth_user_vaga before insert on auth\.users/,
    );
    const corpo = corpoDaFuncao("exigir_vaga_para_conta");
    expect(corpo).toContain("returns trigger");
    // roda como dono: o supabase_auth_admin não lê auth.users nem app_config
    expect(corpo).toContain("security definer");
    // o dono passa sempre; os outros contam contra o max_contas
    expect(corpo).toMatch(
      /lower\(coalesce\(new\.email, ''\)\) = lower\(public\.allowed_email\(\)\)/,
    );
    expect(corpo).toContain("select count(*) into total from auth.users");
    expect(corpo).toContain("total >= limite");
    expect(corpo).toContain(
      "raise exception 'Cadastro fechado: o limite de contas foi atingido.'",
    );
    expect(corpo).toContain("errcode = '42501'");
    expect(schema).toContain(
      "revoke all on function public.exigir_vaga_para_conta() from public, anon, authenticated",
    );
  });

  it("a regra antiga de um usuário só foi removida", () => {
    expect(schema).toContain(
      "drop trigger if exists on_auth_user_email_permitido on auth.users",
    );
    expect(schema).toContain(
      "drop function if exists public.exigir_email_permitido()",
    );
    expect(schema).not.toMatch(
      /create (or replace )?function public\.exigir_email_permitido/,
    );
    expect(schema).not.toContain("Este app é pessoal");
  });

  it("vagas_para_conta é liberada ao anon e devolve só dois números", () => {
    const corpo = corpoDaFuncao("vagas_para_conta");
    expect(corpo).toContain("returns jsonb");
    expect(corpo).toContain("security definer");
    // a tela de login pergunta sem sessão
    expect(schema).toContain(
      "revoke all on function public.vagas_para_conta() from public",
    );
    expect(schema).toContain(
      "grant execute on function public.vagas_para_conta() to anon, authenticated",
    );
    // dois números e nada mais: nenhum e-mail sai daqui
    const chaves = [...corpo.matchAll(/'(\w+)',/g)].map((m) => m[1]);
    expect(chaves).toEqual(["contas", "limite"]);
    expect(corpo).not.toContain("email");
  });

  it("contas_cadastradas só devolve linha para o dono", () => {
    const corpo = corpoDaFuncao("contas_cadastradas");
    expect(corpo).toContain("security definer");
    // a condição está DENTRO da consulta: sem ela a função entregaria auth.users
    expect(corpo).toContain("public.sou_o_dono()");
    expect(schema).toContain(
      "revoke all on function public.contas_cadastradas() from public, anon",
    );
    expect(schema).toContain(
      "grant execute on function public.contas_cadastradas() to authenticated",
    );
    expect(schema).not.toMatch(
      /grant execute on function public\.contas_cadastradas\(\) to[^;]*anon/,
    );
  });

  it("app_config tem RLS ligada e policy só do dono", () => {
    expect(schema).toContain("alter table public.app_config enable row level security");
    const policy = /create policy "app_config_dono"[\s\S]*?;/.exec(schema)?.[0] ?? "";
    expect(policy).toContain("for all to authenticated");
    expect(policy).toContain("using (public.sou_o_dono())");
    expect(policy).toContain("with check (public.sou_o_dono())");
  });

  it("app_config é uma linha só, com limite mínimo de 1, e já nasce semeada", () => {
    const corpo = /create table if not exists public\.app_config \(([\s\S]*?)\n\);/
      .exec(schema)?.[1];
    expect(corpo).toBeTruthy();
    expect(corpo).toContain("id          boolean primary key default true check (id)");
    expect(corpo).toContain("check (max_contas >= 1)");
    expect(corpo).toContain("default 5");
    expect(schema).toContain(
      "insert into public.app_config (id) values (true) on conflict do nothing",
    );
  });

  it("o perfil novo nasce com o nome vindo do e-mail", () => {
    const corpo = corpoDaFuncao("handle_new_user");
    expect(corpo).toContain("split_part(coalesce(new.email, ''), '@', 1)");
    expect(corpo).not.toContain("Miguel");
    expect(schema).toContain("alter table public.profiles alter column nome set default ''");
  });

  /*
   * Auditoria 17/09/2026: o marco Contas reescreveu `handle_new_user()` e o
   * `create trigger on_auth_user_created` sumiu do arquivo no caminho. Num
   * projeto novo isso deixaria toda conta sem perfil — e nada quebrava, porque
   * o banco de verdade já tinha o trigger de antes. Agora quebra aqui.
   */
  it("o trigger que cria o perfil continua no schema, depois do da cota", () => {
    expect(schema).toMatch(
      /create trigger on_auth_user_created after insert on auth\.users for each row execute function public\.handle_new_user\(\)/,
    );
    expect(schema).toContain(
      "drop trigger if exists on_auth_user_created on auth.users",
    );
    // BEFORE roda antes de AFTER: a cota aborta antes de o perfil nascer
    const daCota = schema.indexOf("create trigger on_auth_user_vaga");
    const doPerfil = schema.indexOf("create trigger on_auth_user_created");
    expect(daCota).toBeGreaterThan(-1);
    expect(doPerfil).toBeGreaterThan(-1);
  });

  it("nenhuma policy libera `true` para authenticated", () => {
    const policies = [...schema.matchAll(/create policy[\s\S]*?;/g)].map(
      (m) => m[0],
    );
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      // ou filtra pela linha do usuário, ou é a cota — que só o dono vê
      expect(
        /auth\.uid\(\)/.test(policy) || /public\.sou_o_dono\(\)/.test(policy),
        `policy sem filtro de dono: ${policy}`,
      ).toBe(true);
      expect(policy).not.toMatch(/using \(true\)|with check \(true\)/);
    }
  });
});

describe("schema.sql: views", () => {
  it("toda view roda com os direitos de quem consulta (security_invoker)", () => {
    const views = [
      ...schema.matchAll(/create (?:or replace )?view public\.(\w+)([^;]*?) as/gs),
    ];
    expect(views.length).toBeGreaterThan(0);
    for (const [, nome, opcoes] of views) {
      expect(
        (opcoes ?? "").replace(/\s+/g, " "),
        `a view ${nome} roda com os direitos do dono e fura a RLS`,
      ).toMatch(/with \( *security_invoker *= *(true|on) *\)/);
    }
  });
});

describe("schema.sql: bucket das fotos", () => {
  it("o bucket é privado", () => {
    expect(schema).toMatch(
      /insert into storage\.buckets[^;]*'progresso'[^;]*false/s,
    );
  });

  it("select, insert e delete presos à pasta do próprio usuário", () => {
    const policies = [
      ...schema.matchAll(
        /create policy "progresso_dono_(\w+)" on storage\.objects for (\w+) to (\w+)([\s\S]*?);/g,
      ),
    ];
    expect(policies.map((p) => p[2]).sort()).toEqual([
      "delete",
      "insert",
      "select",
    ]);
    for (const [, nome, , papel, corpo] of policies) {
      expect(papel, `policy ${nome} aberta para outro papel`).toBe(
        "authenticated",
      );
      expect(corpo, `policy ${nome} sem o prefixo do user_id`).toContain(
        "(storage.foldername(name))[1] = auth.uid()::text",
      );
      expect(corpo, `policy ${nome} sem prender o bucket`).toContain(
        "bucket_id = 'progresso'",
      );
    }
  });

  it("o caminho que o app grava começa pelo user_id (senão a policy recusa)", async () => {
    const { caminhoDaFoto } = await import("@/lib/corpo");
    const id = "11111111-2222-3333-4444-555555555555";
    expect(caminhoDaFoto(id, "2026-03-04", "frente").startsWith(`${id}/`)).toBe(
      true,
    );
  });
});

describe("nada de segredo versionado", () => {
  it("o schema não tem chave nenhuma", () => {
    expect(schema).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(schema).not.toMatch(/sb_secret_/);
  });

  it("o .env.local.example só tem espaço reservado", () => {
    const exemplo = readFileSync(join(RAIZ, ".env.local.example"), "utf8");
    expect(exemplo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(exemplo).not.toMatch(/sb_secret_|service_role/);
  });
});

describe("o mock do Supabase não vai para o app", () => {
  function arquivos(pasta: string): string[] {
    const saida: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
      // os testes não entram no bundle
      else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
        saida.push(caminho);
      }
    }
    return saida;
  }

  it("nenhum arquivo de app/, components/ ou lib/ importa scripts/", () => {
    for (const pasta of ["app", "components", "lib"]) {
      for (const arquivo of arquivos(join(RAIZ, pasta))) {
        const texto = readFileSync(arquivo, "utf8");
        expect(texto, `${arquivo} importa do mock`).not.toMatch(
          /from ["'][^"']*scripts\//,
        );
        expect(texto, `${arquivo} fala do mock`).not.toContain(
          "mock-supabase",
        );
      }
    }
  });
});

describe("schema.sql: os grants padrão do Supabase (medido em produção, 17/09/2026)", () => {
  /*
   * O projeto tem `alter default privileges … grant execute on functions to
   * anon, authenticated, service_role`: toda função nova nasce chamável pelo
   * /rest/v1/rpc com a chave anônima, e `revoke … from public` NÃO desfaz esse
   * grant explícito. Foi assim que `allowed_email()` respondeu o e-mail do dono
   * ao anon em produção. Tudo o que não é para o navegador chamar tira `anon`
   * (e `authenticated`, quando nem o app logado precisa) pelo nome.
   */
  it.each([
    ["public.allowed_email()", "public, anon, authenticated"],
    ["public.set_updated_at()", "public, anon, authenticated"],
    ["public.exigir_vaga_para_conta()", "public, anon, authenticated"],
    ["public.handle_new_user()", "public, anon, authenticated"],
    ["public.sou_o_dono()", "public, anon"],
    ["public.contas_cadastradas()", "public, anon"],
  ])("%s é revogada de %s", (funcao, papeis) => {
    expect(schema).toContain(`revoke all on function ${funcao} from ${papeis};`);
  });

  it("só a cota fica aberta ao anon (dois números, nada mais)", () => {
    expect(schema).toContain(
      "grant execute on function public.vagas_para_conta() to anon, authenticated",
    );
    const abertas = [...schema.matchAll(/grant execute on function public\.(\w+)\(\) to ([^;]+);/g)]
      .filter((m) => /\banon\b/.test(m[2] ?? ""))
      .map((m) => m[1]);
    expect(abertas).toEqual(["vagas_para_conta"]);
  });
});

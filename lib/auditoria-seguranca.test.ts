/**
 * AUDITORIA FINAL — lente "segurança".
 *
 * O que estes testes seguram, e que nenhum outro segurava:
 *  1. `supabase/schema.sql` — RLS ligada e policy do dono em TODA tabela, view
 *     com `security_invoker` (sem isso a view passa por cima da RLS e o
 *     PostgREST entrega os dados a quem tiver a chave anon, que é pública),
 *     bucket das fotos privado e preso ao `user_id` no caminho.
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

/** As tabelas criadas no schema. */
function tabelasCriadas(): string[] {
  return [...schema.matchAll(/create table if not exists public\.(\w+)/g)].map(
    (m) => m[1] as string,
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
  it("existem tabelas e todas passam pelo laço da RLS", () => {
    const criadas = tabelasCriadas();
    expect(criadas.length).toBeGreaterThan(0);
    expect([...tabelasComRls()].sort()).toEqual([...criadas].sort());
  });

  it("o laço liga a RLS e cria a policy do dono com `using` e `with check`", () => {
    expect(schema).toContain("enable row level security");
    expect(schema).toMatch(/using \(user_id = auth\.uid\(\)\)/);
    expect(schema).toMatch(/with check \(user_id = auth\.uid\(\)\)/);
    expect(schema).toContain("for all to authenticated");
  });

  it("toda tabela tem user_id (a policy depende dele)", () => {
    for (const tabela of tabelasCriadas()) {
      const corpo = new RegExp(
        `create table if not exists public\\.${tabela} \\(([\\s\\S]*?)\\n\\);`,
      ).exec(schema);
      expect(corpo, `tabela ${tabela} sem corpo`).not.toBeNull();
      expect(corpo?.[1], `tabela ${tabela} sem user_id`).toContain("user_id");
    }
  });

  it("as 11 tabelas do backup (§9) são as tabelas com RLS", () => {
    expect([...TABELAS_BACKUP].sort()).toEqual([...tabelasCriadas()].sort());
  });
});

describe("schema.sql: só o e-mail permitido tem conta (SPEC §9)", () => {
  /** O literal do bloco "AJUSTE AQUI" (public.allowed_email()). */
  function emailDaConstante(): string | undefined {
    return /create or replace function public\.allowed_email\(\)[\s\S]*?select '([^']+)'::text/
      .exec(schema)?.[1];
  }

  it("a constante devolve o mesmo e-mail do ALLOWED_EMAIL", () => {
    const exemplo = readFileSync(join(RAIZ, ".env.local.example"), "utf8");
    const doEnv = /ALLOWED_EMAIL=(.+)/.exec(exemplo)?.[1]?.trim();
    expect(doEnv).toBeTruthy();
    expect(emailDaConstante()).toBe(doEnv);
  });

  it("um trigger `before insert on auth.users` barra qualquer outro e-mail", () => {
    // BEFORE, para abortar antes do AFTER que cria o perfil
    expect(schema).toMatch(
      /create trigger on_auth_user_email_permitido before insert on auth\.users/,
    );
    expect(schema).toMatch(
      /lower\(coalesce\(new\.email, ''\)\) is distinct from lower\(public\.allowed_email\(\)\)/,
    );
    expect(schema).toContain("raise exception 'Este app é pessoal");
    // roda como dono: o supabase_auth_admin não tem execute na constante
    expect(schema).toMatch(
      /function public\.exigir_email_permitido\(\) returns trigger[\s\S]{0,120}security definer/,
    );
  });

  it("a constante não vaza pelo PostgREST", () => {
    expect(schema).toContain(
      "revoke all on function public.allowed_email() from public",
    );
  });

  it("nenhuma policy libera `true` para authenticated", () => {
    const policies = [...schema.matchAll(/create policy[\s\S]*?;/g)].map(
      (m) => m[0],
    );
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy, `policy sem auth.uid(): ${policy}`).toContain("auth.uid()");
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

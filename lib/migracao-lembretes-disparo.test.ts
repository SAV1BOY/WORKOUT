/**
 * `supabase/migracoes/2026-09-23-lembretes-disparo.sql` (SPEC §23.11, aceite
 * §23.14 item 3): o delta que o orquestrador aplica antes do deploy, provado
 * sem banco, no molde de `lib/migracao-lembretes.test.ts`:
 *
 * 1. é um pedaço do `schema.sql`;
 * 2. é idempotente (extensões, tabela e policy com `if not exists`/`drop if
 *    exists`, funções com `create or replace`, o job desagendado pelo nome
 *    antes de agendar);
 * 3. é expand-only;
 * 4. a RLS de `lembretes_enviados` é só de leitura do dono;
 * 5. as duas funções são `security definer` com `search_path` fixo, o tick só
 *    do postgres, o resultado só anon/authenticated;
 * 6. o tick sem o Vault ou sem o pg_net retorna ANTES de qualquer chamada à
 *    rede, e nenhum segredo está no arquivo.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { comandos, estruturais, normalizar } from "@/lib/sql";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const schema = readFileSync(join(RAIZ, "supabase", "schema.sql"), "utf8");
const migracao = readFileSync(
  join(RAIZ, "supabase", "migracoes", "2026-09-23-lembretes-disparo.sql"),
  "utf8",
);
const TABELA = "public.lembretes_enviados";
const delta = comandos(migracao);

/** O comando inteiro que cria a função (do `create` ao `$$`). */
function funcao(nome: string): string {
  const c = delta.find((d) => d.startsWith(`create or replace function public.${nome}(`));
  expect(c, `falta a função ${nome}`).toBeDefined();
  return c ?? "";
}

describe("a migração do disparo é um pedaço do schema.sql", () => {
  const doSchema = new Set(comandos(schema));

  it("o delta tem as peças da §23.11", () => {
    const tudo = normalizar(migracao);
    for (const pedaco of [
      "create extension if not exists pg_cron with schema pg_catalog",
      "create extension if not exists pg_net with schema extensions",
      `create table if not exists ${TABELA}`,
      "user_id uuid not null references auth.users(id) on delete cascade",
      "tipo text not null check (tipo in ('treino', 'corrida'))",
      "dia date not null",
      "enviado_em timestamptz not null default now()",
      "unique (user_id, tipo, dia)",
      `alter table ${TABELA} enable row level security`,
      "create or replace function public.lembretes_tick() returns void",
      "create or replace function public.lembretes_resultado(segredo text, enviados jsonb, expirados text[])",
      "perform cron.schedule('lembretes', '*/5 * * * *', 'select public.lembretes_tick()')",
    ]) {
      expect(tudo, `falta no delta: ${pedaco}`).toContain(normalizar(pedaco));
    }
  });

  it.each(delta)("o schema.sql também tem: %s", (comando) => {
    expect(doSchema.has(comando), `só existe na migração:\n${comando}`).toBe(true);
  });
});

describe("idempotente", () => {
  it("extensões, tabela e índices com if not exists; funções com create or replace", () => {
    for (const c of delta) {
      if (/^create extension/i.test(c)) expect(c).toMatch(/^create extension if not exists/i);
      if (/^create table/i.test(c)) expect(c).toMatch(/^create table if not exists/i);
      if (/^create (unique )?index/i.test(c)) expect(c).toMatch(/^create (unique )?index if not exists/i);
      if (/^create (or replace )?function/i.test(c)) expect(c).toMatch(/^create or replace function/i);
    }
  });
  it("a policy é apagada (if exists) antes de ser criada", () => {
    const criar = delta.findIndex((c) => /^create policy "lembretes_enviados_select"/.test(c));
    const apagar = delta.findIndex(
      (c) => c === `drop policy if exists "lembretes_enviados_select" on ${TABELA}`,
    );
    expect(criar).toBeGreaterThan(0);
    expect(apagar).toBeGreaterThanOrEqual(0);
    expect(apagar).toBeLessThan(criar);
  });
  it("o job: desagendado pelo nome, depois agendado — rodar duas vezes deixa um só", () => {
    const bloco = delta.find((c) => c.includes("cron.schedule")) ?? "";
    const desagenda = bloco.indexOf("perform cron.unschedule(jobid) from cron.job where jobname = 'lembretes'");
    const agenda = bloco.indexOf("perform cron.schedule('lembretes'");
    expect(desagenda).toBeGreaterThan(0);
    expect(desagenda).toBeLessThan(agenda);
    // e só onde o pg_cron existe
    expect(bloco).toMatch(/if exists \(select 1 from pg_extension where extname = 'pg_cron'\) then/);
  });
});

describe("expand-only", () => {
  it("fora dos corpos de função, nada é apagado, renomeado ou trocado de tipo", () => {
    for (const c of estruturais(migracao)) {
      expect(c, c).not.toMatch(/^drop\s+(table|column|index|view|function|schema|type|extension)\b/i);
      expect(c, c).not.toMatch(/\brename\b/i);
      expect(c, c).not.toMatch(/\balter\s+column\b/i);
    }
    const drops = estruturais(migracao).filter((c) => /^drop/i.test(c));
    expect(drops).toEqual([`drop policy if exists "lembretes_enviados_select" on ${TABELA}`]);
    // nenhum comando solto apaga ou altera dados
    for (const c of delta) {
      expect(c, c).not.toMatch(/^(delete|update|truncate)\b/i);
    }
  });
});

describe("RLS de lembretes_enviados: o dono só lê", () => {
  const policies = delta.filter((c) => /^create policy/i.test(c));

  it("uma policy: select para authenticated por auth.uid()", () => {
    expect(policies).toEqual([
      `create policy "lembretes_enviados_select" on ${TABELA} for select to authenticated using (user_id = auth.uid())`,
    ]);
  });
  it("sem nada para o anon e sem escrita para o authenticated", () => {
    const tudo = normalizar(migracao);
    expect(tudo).toContain(
      normalizar("if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on public.lembretes_enviados from anon';"),
    );
    expect(tudo).toContain(
      normalizar(
        "execute 'revoke insert, update, delete, truncate on public.lembretes_enviados from authenticated';",
      ),
    );
  });
});

describe("as funções (security definer)", () => {
  it("as duas: security definer com search_path fixo", () => {
    for (const nome of ["lembretes_tick", "lembretes_resultado"]) {
      expect(funcao(nome)).toMatch(/language plpgsql security definer set search_path = public as \$\$/);
    }
  });
  it("o tick só do postgres: revogado de public, anon e authenticated, sem grant", () => {
    expect(delta).toContain("revoke all on function public.lembretes_tick() from public, anon, authenticated");
    expect(delta.filter((c) => /^grant .* on function public\.lembretes_tick/i.test(c))).toEqual([]);
  });
  it("o resultado: revogado de public e liberado só a anon e authenticated", () => {
    expect(delta).toContain("revoke all on function public.lembretes_resultado(text, jsonb, text[]) from public");
    expect(delta.filter((c) => /^grant .* on function public\.lembretes_resultado/i.test(c))).toEqual([
      "grant execute on function public.lembretes_resultado(text, jsonb, text[]) to anon, authenticated",
    ]);
  });
  it("o resultado confere o segredo contra o Vault pelos sha256 e recusa com 28000", () => {
    const corpo = funcao("lembretes_resultado");
    expect(corpo).toContain("sha256(convert_to(segredo, 'UTF8')) <> sha256(convert_to(v_segredo, 'UTF8'))");
    expect(corpo).toContain("coalesce(v_segredo, '') = ''");
    expect(corpo).toMatch(/raise exception '[^']+' using errcode = '28000'/);
    // a recusa vem antes de qualquer escrita
    expect(corpo.indexOf("raise exception")).toBeLessThan(corpo.indexOf("insert into public.lembretes_enviados"));
    expect(corpo.indexOf("raise exception")).toBeLessThan(corpo.indexOf("delete from public.lembretes_inscricoes"));
    expect(corpo).toContain("on conflict (user_id, tipo, dia) do nothing");
  });
  it("o tick sem pg_net ou sem Vault (ou com eles vazios) retorna antes de chamar a rede", () => {
    const corpo = funcao("lembretes_tick");
    const rede = corpo.indexOf("net.http_post");
    expect(rede).toBeGreaterThan(0);
    const semExtensao = corpo.indexOf(
      "if not exists (select 1 from pg_extension where extname = 'pg_net') or to_regclass('vault.decrypted_secrets') is null then return;",
    );
    const semValores = corpo.indexOf("if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then return;");
    const ninguem = corpo.indexOf("if jsonb_array_length(v_usuarios) = 0 then return;");
    for (const guarda of [semExtensao, semValores, ninguem]) {
      expect(guarda).toBeGreaterThan(0);
      expect(guarda).toBeLessThan(rede);
    }
    // o Vault e o pg_net só por SQL dinâmico: a função compila sem eles
    expect(corpo).not.toMatch(/(?<!')select decrypted_secret/);
    expect(corpo).toContain("execute 'select net.http_post(");
    // o segredo vai no cabeçalho que a rota confere
    expect(corpo).toContain("'x-lembretes-segredo', v_segredo");
    // só contas com lembrete ligado e com aparelho inscrito
    expect(corpo).toContain("p.prefs #> '{lembretes,treino,ligado}' = 'true'::jsonb");
    expect(corpo).toContain("exists (select 1 from public.lembretes_inscricoes i where i.user_id = p.user_id)");
  });
  it("nenhum segredo nem URL de produção no arquivo", () => {
    expect(migracao).not.toMatch(/https?:\/\//);
    expect(migracao).not.toMatch(/vault\.create_secret/i);
    expect(migracao).not.toMatch(/service_role/i);
  });
});

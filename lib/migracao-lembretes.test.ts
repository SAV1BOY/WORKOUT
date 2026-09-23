/**
 * `supabase/migracoes/2026-09-23-lembretes-inscricoes.sql` (SPEC §23.2): o
 * delta que o orquestrador aplica no projeto antes do deploy. Quatro coisas
 * são provadas aqui, sem banco:
 *
 * 1. é um pedaço do `schema.sql` (os dois não desencontram);
 * 2. é idempotente (rodar duas vezes não falha);
 * 3. é expand-only (nada de drop table/column, rename, troca de tipo);
 * 4. a RLS é a da §23.2 — cada conta lê, insere e apaga só as suas; nenhuma
 *    policy de update, nenhuma com `true`, nada para o `anon`.
 *
 * O comportamento da RLS (a conta B não vê nem apaga a inscrição da A) é
 * provado no e2e contra o mock, que aplica a mesma regra por `user_id`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { comandos, estruturais, normalizar } from "@/lib/sql";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const schema = readFileSync(join(RAIZ, "supabase", "schema.sql"), "utf8");
const migracao = readFileSync(
  join(RAIZ, "supabase", "migracoes", "2026-09-23-lembretes-inscricoes.sql"),
  "utf8",
);
const TABELA = "public.lembretes_inscricoes";

describe("a migração dos lembretes é um pedaço do schema.sql", () => {
  const doSchema = new Set(comandos(schema));
  const doDelta = comandos(migracao);

  it("o delta tem os comandos da §23.2", () => {
    expect(doDelta.length).toBeGreaterThanOrEqual(10);
    const tudo = normalizar(migracao);
    for (const pedaco of [
      `create table if not exists ${TABELA}`,
      "user_id uuid not null references auth.users(id) on delete cascade",
      "endpoint text not null unique",
      "p256dh text not null",
      "auth text not null",
      "aparelho text not null default ''",
      "criado_em timestamptz not null default now()",
      "ultimo_envio_em timestamptz",
      "falhas int not null default 0",
      `create index if not exists lembretes_inscricoes_user_idx on ${TABELA} (user_id)`,
      `alter table ${TABELA} enable row level security`,
    ]) {
      expect(tudo, `falta no delta: ${pedaco}`).toContain(normalizar(pedaco));
    }
  });

  it.each(comandos(migracao))("o schema.sql também tem: %s", (comando) => {
    expect(doSchema.has(comando), `só existe na migração:\n${comando}`).toBe(true);
  });
});

describe("idempotente", () => {
  const delta = comandos(migracao);
  it("create table/index com if not exists; policy depois do drop if exists", () => {
    for (const c of delta) {
      if (/^create table/i.test(c)) expect(c).toMatch(/^create table if not exists/i);
      if (/^create (unique )?index/i.test(c)) expect(c).toMatch(/^create (unique )?index if not exists/i);
      if (/^create policy/i.test(c)) {
        const nome = /^create policy "(\w+)"/i.exec(c)?.[1];
        const criar = delta.indexOf(c);
        const apagar = delta.findIndex((d) =>
          new RegExp(`^drop policy if exists "${nome}" on ${TABELA.replace(".", "\\.")}$`, "i").test(d),
        );
        expect(apagar, `a policy ${nome} não é apagada antes`).toBeGreaterThanOrEqual(0);
        expect(apagar).toBeLessThan(criar);
      }
    }
  });
  it("o revoke do anon só roda onde o papel existe", () => {
    expect(normalizar(migracao)).toContain(
      normalizar(
        "if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on public.lembretes_inscricoes from anon';",
      ),
    );
  });
});

describe("expand-only", () => {
  it("nada é apagado, renomeado ou trocado de tipo", () => {
    for (const c of comandos(migracao)) {
      expect(c, c).not.toMatch(/\bdrop\s+(table|column|index|view|function|schema|type)\b/i);
      expect(c, c).not.toMatch(/\brename\b/i);
      expect(c, c).not.toMatch(/\balter\s+column\b/i);
      expect(c, c).not.toMatch(/\btruncate\b|\bdelete\s+from\b|\bupdate\s+public\./i);
    }
    // o único drop é o de policy, para recriar a mesma
    const drops = estruturais(migracao).filter((c) => /^drop/i.test(c));
    for (const d of drops) expect(d).toMatch(/^drop policy if exists "lembretes_inscricoes_\w+" on public\.lembretes_inscricoes$/i);
  });
});

describe("RLS da §23.2", () => {
  const policies = comandos(migracao).filter((c) => /^create policy/i.test(c));

  it("três policies: select, insert e delete, só para authenticated, por auth.uid()", () => {
    const porAcao = Object.fromEntries(
      policies.map((p) => [/ for (\w+) to /i.exec(p)?.[1]?.toLowerCase(), p]),
    );
    expect(Object.keys(porAcao).sort()).toEqual(["delete", "insert", "select"]);
    expect(porAcao.select).toMatch(/to authenticated using \(user_id = auth\.uid\(\)\)$/);
    expect(porAcao.insert).toMatch(/to authenticated with check \(user_id = auth\.uid\(\)\)$/);
    expect(porAcao.delete).toMatch(/to authenticated using \(user_id = auth\.uid\(\)\)$/);
  });

  it("nenhuma policy de update/all, nenhuma com true, nenhuma para anon/public", () => {
    for (const p of policies) {
      expect(p).not.toMatch(/ for (update|all) /i);
      expect(p).not.toMatch(/\(\s*true\s*\)/i);
      expect(p).not.toMatch(/ to (anon|public)\b/i);
    }
  });

  it("no schema.sql a tabela tem só estas policies", () => {
    const doSchema = comandos(schema).filter(
      (c) => /^create policy/i.test(c) && c.includes(`on ${TABELA} `),
    );
    expect(doSchema).toEqual(policies);
  });
});

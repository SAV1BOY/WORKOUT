/**
 * `supabase/migracoes/2026-09-17-contas.sql` é o **delta** do marco Contas: o
 * que o orquestrador cola no SQL Editor do projeto que já está no ar. O risco
 * de ter dois arquivos é eles desencontrarem — a migração aplicada acabar
 * diferente do `schema.sql` que o repositório diz ser a verdade.
 *
 * Este teste não deixa: todo comando que cria, apaga ou mexe em permissão na
 * migração tem que existir **igualzinho** no schema (só o espaço em branco é
 * normalizado). O contrário não vale — o schema tem muita coisa que a migração
 * não repete, porque já está aplicada.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { estruturais, normalizar } from "@/lib/sql";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const schema = readFileSync(join(RAIZ, "supabase", "schema.sql"), "utf8");
const migracao = readFileSync(
  join(RAIZ, "supabase", "migracoes", "2026-09-17-contas.sql"),
  "utf8",
);

describe("a migração do marco Contas é um pedaço do schema.sql", () => {
  const doSchema = new Set(estruturais(schema));
  const doDelta = estruturais(migracao);

  it("o delta tem comandos (o arquivo não está vazio nem só com comentário)", () => {
    expect(doDelta.length).toBeGreaterThan(10);
  });

  it.each(estruturais(migracao))("o schema.sql também tem: %s", (comando) => {
    expect(doSchema.has(comando), `só existe na migração:\n${comando}`).toBe(true);
  });

  it("traz a cota inteira: tabela, policy, funções e o trigger novo", () => {
    const tudo = normalizar(migracao);
    for (const pedaco of [
      "create table if not exists public.app_config",
      "create policy \"app_config_dono\"",
      "create or replace function public.sou_o_dono()",
      "create or replace function public.vagas_para_conta()",
      "create or replace function public.contas_cadastradas()",
      "create or replace function public.exigir_vaga_para_conta()",
      "create trigger on_auth_user_vaga before insert on auth.users",
      "create or replace function public.handle_new_user()",
      "drop trigger if exists on_auth_user_email_permitido on auth.users",
      "drop function if exists public.exigir_email_permitido()",
      "alter table public.profiles alter column nome set default ''",
    ]) {
      expect(tudo, `falta no delta: ${pedaco}`).toContain(normalizar(pedaco));
    }
  });

  it("é idempotente: nada que quebre ao rodar duas vezes", () => {
    for (const comando of doDelta) {
      if (/^create table/i.test(comando)) {
        expect(comando, comando).toMatch(/^create table if not exists/i);
      }
      if (/^create trigger/i.test(comando)) {
        // todo create trigger vem depois de um drop trigger if exists
        const nome = /^create trigger (\w+)/i.exec(comando)?.[1];
        expect(
          doDelta.some((c) =>
            new RegExp(`^drop trigger if exists ${nome}\\b`, "i").test(c),
          ),
          `o trigger ${nome} não é apagado antes de ser criado`,
        ).toBe(true);
      }
      if (/^create policy/i.test(comando)) {
        const nome = /^create policy "(\w+)"/i.exec(comando)?.[1];
        expect(
          doDelta.some((c) =>
            new RegExp(`^drop policy if exists "${nome}"`, "i").test(c),
          ),
          `a policy ${nome} não é apagada antes de ser criada`,
        ).toBe(true);
      }
      if (/^create (or replace )?function/i.test(comando)) {
        expect(comando, comando).toMatch(/^create or replace function/i);
      }
      if (/^insert into/i.test(comando)) {
        expect(comando, comando).toMatch(/on conflict do nothing$/i);
      }
    }
  });
});

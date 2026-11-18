/**
 * `supabase/migracoes/2026-09-24-lembretes-tick-limitado.sql` (SPEC §23.15,
 * aceite 1): o tick que o orquestrador aplica por cima do de 2026-09-23,
 * provado sem banco, no molde de `lib/migracao-lembretes-disparo.test.ts`:
 *
 * 1. é um pedaço do `schema.sql` (e o tick do schema é este);
 * 2. idempotente (`create or replace`) e expand-only;
 * 3. `security definer` com `search_path` fixo, revogado de public, anon e
 *    authenticated, sem grant;
 * 4. sem pg_net/Vault/valores, retorna antes da rede;
 * 5. **nenhum `prefs` inteiro no corpo**: só as chaves que a regra lê, cada
 *    uma com `octet_length`; listas com teto;
 * 6. lotes: até 50 contas e 256 KiB por POST; conta acima de 32 KiB pulada
 *    (antes de entrar no lote), o lote cheio sai antes de receber a próxima;
 * 7. nenhum segredo nem URL no arquivo.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHAVE_DIAS } from "@/lib/dias";
import { comandos, estruturais, normalizar } from "@/lib/sql";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const schema = readFileSync(join(RAIZ, "supabase", "schema.sql"), "utf8");
const migracao = readFileSync(
  join(RAIZ, "supabase", "migracoes", "2026-09-24-lembretes-tick-limitado.sql"),
  "utf8",
);
const delta = comandos(migracao);
const tick = delta.find((c) => c.startsWith("create or replace function public.lembretes_tick()")) ?? "";

describe("a migração do tick limitado é um pedaço do schema.sql", () => {
  const doSchema = new Set(comandos(schema));

  it("o delta é o tick e o revoke dele — nada mais", () => {
    expect(delta).toHaveLength(2);
    expect(tick).not.toBe("");
    expect(delta[1]).toBe("revoke all on function public.lembretes_tick() from public, anon, authenticated");
  });
  it.each(delta)("o schema.sql também tem: %s", (comando) => {
    expect(doSchema.has(comando), `só existe na migração:\n${comando}`).toBe(true);
  });
  it("o tick do schema.sql é este (um só)", () => {
    const ticks = comandos(schema).filter((c) => c.startsWith("create or replace function public.lembretes_tick()"));
    expect(ticks).toEqual([tick]);
  });
});

describe("idempotente e expand-only", () => {
  it("função com create or replace, mesma assinatura (o job chama pelo nome)", () => {
    expect(tick).toMatch(/^create or replace function public\.lembretes_tick\(\) returns void /);
  });
  it("nada é apagado, renomeado, criado de novo ou agendado", () => {
    for (const c of estruturais(migracao)) {
      expect(c, c).not.toMatch(/^drop\b/i);
      expect(c, c).not.toMatch(/\brename\b/i);
      expect(c, c).not.toMatch(/^create (table|index|unique index|policy|extension)\b/i);
    }
    for (const c of delta) expect(c, c).not.toMatch(/^(delete|update|truncate|insert)\b/i);
    expect(migracao).not.toMatch(/cron\.(un)?schedule/);
  });
});

describe("segurança da função", () => {
  it("security definer com search_path fixo", () => {
    expect(tick).toMatch(/language plpgsql security definer set search_path = public as \$\$/);
  });
  it("revogada de public, anon e authenticated; nenhum grant", () => {
    expect(delta.filter((c) => /^grant\b/i.test(c))).toEqual([]);
  });
  it("sem pg_net ou sem Vault (ou com eles vazios) retorna antes de chamar a rede", () => {
    const rede = tick.indexOf("net.http_post");
    expect(rede).toBeGreaterThan(0);
    const semExtensao = tick.indexOf(
      "if not exists (select 1 from pg_extension where extname = 'pg_net') or to_regclass('vault.decrypted_secrets') is null then return;",
    );
    const semValores = tick.indexOf("if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then return;");
    for (const guarda of [semExtensao, semValores]) {
      expect(guarda).toBeGreaterThan(0);
      expect(guarda).toBeLessThan(rede);
    }
    // o Vault e o pg_net só por SQL dinâmico: a função compila sem eles
    expect(tick).not.toMatch(/(?<!')select decrypted_secret/);
    expect(tick).not.toMatch(/(?<!')select net\.http_post/);
    expect(tick).toContain("'x-lembretes-segredo', v_segredo");
  });
  it("nenhum segredo nem URL no arquivo", () => {
    expect(migracao).not.toMatch(/https?:\/\//);
    expect(migracao).not.toMatch(/vault\.create_secret/i);
    expect(migracao).not.toMatch(/service_role'/i);
  });
});

describe("o corpo limitado (o P1 da revisão)", () => {
  it("nenhum prefs inteiro no corpo: só as chaves que a regra lê, cada uma com octet_length", () => {
    expect(tick).not.toMatch(/'prefs', p\.prefs\b(?! ->)/);
    expect(tick).not.toMatch(/'prefs', p\.prefs\s*[,)]/);
    expect(tick).toContain(
      normalizar(`'prefs', jsonb_strip_nulls(jsonb_build_object(
        'lembretes', case when octet_length((p.prefs -> 'lembretes')::text) <= 1024
                          then p.prefs -> 'lembretes' end,
        '${CHAVE_DIAS}', case when octet_length((p.prefs -> '${CHAVE_DIAS}')::text) <= 256
                               then p.prefs -> '${CHAVE_DIAS}' end)))`),
    );
    // toda leitura de p.prefs no corpo é por chave (-> ou #>), nunca o objeto inteiro
    const leituras = tick.match(/p\.prefs\s*(->|#>)?/g) ?? [];
    expect(leituras.length).toBeGreaterThan(0);
    for (const l of leituras) expect(l, l).toMatch(/(->|#>)$/);
  });
  it("listas com teto: overrides, sessões e cardios até 40; inscrições até 10", () => {
    expect(tick.match(/limit 40\)/g)).toHaveLength(3);
    expect(tick).toContain("order by i.criado_em desc limit 10)");
  });
});

describe("os lotes (uma conta nunca derruba as outras)", () => {
  it("conta acima de 32 KiB é pulada e contada, antes de entrar no lote", () => {
    const pula = tick.indexOf("if v_tamanho > 32768 then v_puladas := v_puladas + 1; continue; end if;");
    const entra = tick.indexOf("v_lote := v_lote || jsonb_build_array(v_conta);");
    expect(pula).toBeGreaterThan(0);
    expect(pula).toBeLessThan(entra);
  });
  it("lote cheio (50 contas ou 256 KiB) sai antes de receber a próxima conta e recomeça vazio", () => {
    const cheio = tick.indexOf(
      "if v_contas > 0 and (v_contas >= 50 or v_bytes + v_tamanho > 262144) then execute 'select net.http_post(",
    );
    const zera = tick.indexOf("v_lote := '[]'::jsonb; v_contas := 0; v_bytes := 0; end if;");
    const entra = tick.indexOf("v_lote := v_lote || jsonb_build_array(v_conta);");
    expect(cheio).toBeGreaterThan(0);
    expect(cheio).toBeLessThan(zera);
    expect(zera).toBeLessThan(entra);
  });
  it("o último lote sai depois do laço, e só se tiver alguém", () => {
    const fimDoLaco = tick.indexOf("end loop;");
    const ninguem = tick.indexOf("if v_contas = 0 then return; end if;");
    const ultimo = tick.lastIndexOf("execute 'select net.http_post(");
    expect(fimDoLaco).toBeGreaterThan(0);
    expect(ninguem).toBeGreaterThan(fimDoLaco);
    expect(ultimo).toBeGreaterThan(ninguem);
    // dois pontos de envio: o lote cheio e o último
    expect(tick.match(/execute 'select net\.http_post\(/g)).toHaveLength(2);
    // os dois mandam só o lote, nunca todas as contas
    expect(tick.match(/jsonb_build_object\('agora', now\(\), 'usuarios', v_lote\)/g)).toHaveLength(2);
  });
  it("só contas com lembrete ligado e com aparelho inscrito, em ordem estável", () => {
    expect(tick).toContain("p.prefs #> '{lembretes,treino,ligado}' = 'true'::jsonb");
    expect(tick).toContain("p.prefs #> '{lembretes,corrida,ligado}' = 'true'::jsonb");
    expect(tick).toContain("exists (select 1 from public.lembretes_inscricoes i where i.user_id = p.user_id)");
    expect(tick).toContain("order by p.user_id loop");
  });
});

import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { comandos } from "@/lib/sql";

it("permite a atualização apenas na pasta da própria conta, na origem e no destino", () => {
  const condicao = "(bucket_id = 'progresso' and (storage.foldername(name))[1] = auth.uid()::text)";
  const nome = '"progresso_dono_update" on storage.objects';
  const esperado = [
    `drop policy if exists ${nome}`,
    `create policy ${nome} for update to authenticated using ${condicao} with check ${condicao}`,
  ];
  const migracao = comandos(readFileSync("supabase/migracoes/2026-11-18-fotos-substituir.sql", "utf8"));
  const schema = comandos(readFileSync("supabase/schema.sql", "utf8"));
  expect(migracao).toEqual(esperado);
  expect(schema.filter((sql) => sql.includes(nome))).toEqual(esperado);
});

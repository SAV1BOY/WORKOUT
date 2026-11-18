-- Permite substituir uma foto somente dentro da pasta da própria conta.
drop policy if exists "progresso_dono_update" on storage.objects;
create policy "progresso_dono_update" on storage.objects for update to authenticated
  using (bucket_id = 'progresso' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progresso' and (storage.foldername(name))[1] = auth.uid()::text);

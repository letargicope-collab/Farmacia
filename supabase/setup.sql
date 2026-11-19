-- ============================================================================
--  Farmácia São Marcos — armazenamento do catálogo de produtos (Supabase)
--  Onde rodar: painel do Supabase → SQL Editor → New query → cole tudo → Run
--  Pode ser rodado mais de uma vez sem problema.
-- ============================================================================

-- 1) Pasta pública "catalogo": todos os visitantes do site conseguem LER o catálogo.
insert into storage.buckets (id, name, public)
values ('catalogo', 'catalogo', true)
on conflict (id) do update set public = true;

-- 2) Somente os dois administradores podem ENVIAR ou SUBSTITUIR o catálogo.
--    (se trocar os logins, ajuste os e-mails abaixo e em src/config/publicacao.ts)
drop policy if exists "catalogo_admins_select" on storage.objects;
drop policy if exists "catalogo_admins_insert" on storage.objects;
drop policy if exists "catalogo_admins_update" on storage.objects;

create policy "catalogo_admins_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'catalogo'
    and (auth.jwt() ->> 'email') in ('cleverton@farmaciasaomarcos.app', 'saomarcos2026@farmaciasaomarcos.app')
  );

create policy "catalogo_admins_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'catalogo'
    and (auth.jwt() ->> 'email') in ('cleverton@farmaciasaomarcos.app', 'saomarcos2026@farmaciasaomarcos.app')
  );

create policy "catalogo_admins_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'catalogo'
    and (auth.jwt() ->> 'email') in ('cleverton@farmaciasaomarcos.app', 'saomarcos2026@farmaciasaomarcos.app')
  )
  with check (
    bucket_id = 'catalogo'
    and (auth.jwt() ->> 'email') in ('cleverton@farmaciasaomarcos.app', 'saomarcos2026@farmaciasaomarcos.app')
  );

-- 3) Depois, em Authentication → Users → "Add user" → "Create new user", crie:
--      cleverton@farmaciasaomarcos.app      (senha do login "cleverton")
--      saomarcos2026@farmaciasaomarcos.app  (senha do login "saomarcos2026")
--    marcando "Auto Confirm User". Nenhum e-mail é enviado.
-- 4) Em Authentication → Sign In / Providers, desligue "Allow new users to sign up".

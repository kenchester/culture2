-- Lets admins manually add/edit languages and geography from a new admin
-- tab, following the same pattern as the embed_partners admin policies
-- (00000000000010_admin.sql): a profiles.is_admin flag gates writes, RLS
-- is the actual enforcement boundary, not application code. No delete
-- policy - removing a place/language that's referenced by an existing
-- network or embed partner isn't something this tab needs to support.
create policy "admins can create places" on places
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can update places" on places
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can create languages" on languages
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can update languages" on languages
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

grant insert, update on places, languages to authenticated;

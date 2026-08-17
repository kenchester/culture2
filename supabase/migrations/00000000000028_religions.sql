-- Backs the faith.culturemesh.com subdomain: religion-based network origin,
-- kept separate from languages/places since it's a flat, curated list (no
-- hierarchy) with alternate-spelling support (e.g. "Baha'i" -> "Bahá'í")
-- that neither of those tables needs. RLS/grants mirror languages exactly
-- (00000000000003_rls.sql / 00000000000018_admin_places_languages.sql):
-- public read, admin-gated write.
create table religions (
  id bigint generated always as identity primary key,
  name text not null unique,
  aliases text[] not null default '{}'
);

alter table religions enable row level security;

create policy "religions are publicly readable" on religions for select using (true);

create policy "admins can create religions" on religions
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can update religions" on religions
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

grant select on religions to anon, authenticated;
grant insert, update on religions to authenticated;

-- Same "not covered by an earlier blanket grant" situation as every other
-- new identity-PK table this engagement (see 00000000000026_product_updates.sql).
grant usage on all sequences in schema public to authenticated;

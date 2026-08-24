-- Lets the app show real localized names for languages and geography
-- (origin/location names currently only exist as raw English "name" text,
-- unlike every other piece of UI copy which already goes through
-- next-intl). iso_code is nullable and only meaningful for languages and
-- country-type places - it lets the resolver use Intl.DisplayNames
-- (Node's own CLDR data) for genuine standard localized names wherever a
-- code is known, instead of a machine-translation guess. Backfilled once
-- by scripts/backfill-iso-codes.ts; unmatched rows stay null and fall
-- back to Azure Translator at display time (lib/geo-translation.ts).
alter table languages add column iso_code text;
alter table places add column iso_code text;

-- Shared cache + admin-override store for both entity kinds - same shape
-- either way (id/locale/text/source), and the admin search UI needs to
-- query across both uniformly. source tracks provenance so a manual
-- admin edit is never silently clobbered by a later automated
-- CLDR/Azure re-resolution pass.
create table geo_translations (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('place', 'language')),
  entity_id bigint not null,
  locale text not null,
  translated_name text not null,
  source text not null check (source in ('cldr', 'azure', 'manual')),
  updated_at timestamptz not null default now()
);

create unique index geo_translations_unique on geo_translations (entity_type, entity_id, locale);
create index geo_translations_entity_idx on geo_translations (entity_type, entity_id);

alter table geo_translations enable row level security;

-- Publicly readable - anonymous visitors render translated place/language
-- names on network and search pages. Writable two ways: admins editing
-- directly (RLS-gated below, same is_admin pattern as places/languages,
-- see 00000000000018_admin_places_languages.sql), or the lazy
-- CLDR/Azure-backed cache fill that happens during anonymous page
-- renders, which goes through the service-role client
-- (lib/supabase/admin.ts) and so bypasses RLS entirely rather than
-- needing an "anon can insert" policy - granting anon direct insert
-- would let any browser with the public key write arbitrary
-- translated_name spam into a publicly-read table.
create policy "geo translations are publicly readable" on geo_translations for select using (true);

create policy "admins can create geo translations" on geo_translations
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can update geo translations" on geo_translations
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can delete geo translations" on geo_translations
  for delete using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

grant select on geo_translations to anon, authenticated;
grant insert, update, delete on geo_translations to authenticated;
grant select, insert, update on geo_translations to service_role;

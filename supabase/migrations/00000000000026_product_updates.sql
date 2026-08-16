-- An admin-authored log of product updates, published from a new admin
-- tab. Publishing also triggers a one-off bulk email (handled in
-- application code, not here) to everyone with product_updates=true in
-- notification_prefs. Immutable log - no update/delete policy, following
-- the same is_admin-gated-write pattern as places/languages
-- (00000000000018_admin_places_languages.sql).
create table product_updates (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  posted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table product_updates enable row level security;

create policy "admins can read product updates" on product_updates
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can create product updates" on product_updates
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

grant select, insert on product_updates to authenticated;

-- "grant ... on all sequences" only covers sequences that exist at the
-- time it runs, not future ones - product_updates_id_seq needs this
-- re-run now that it exists, or every insert 401s despite the policy
-- above allowing it.
grant usage on all sequences in schema public to authenticated;


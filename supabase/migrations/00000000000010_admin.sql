-- No admin role system exists yet - a flag on profiles is the minimal
-- thing that lets embed_partners management (§6 of the plan) work without
-- building a full roles/permissions system for a single-admin v1.
alter table profiles add column is_admin boolean not null default false;

create policy "admins can create embed partners" on embed_partners
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can update embed partners" on embed_partners
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can delete embed partners" on embed_partners
  for delete using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can create embed partner jurisdictions" on embed_partner_jurisdictions
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "admins can delete embed partner jurisdictions" on embed_partner_jurisdictions
  for delete using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

grant insert, update, delete on embed_partners to authenticated;
grant insert, delete on embed_partner_jurisdictions to authenticated;

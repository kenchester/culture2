-- organization_admins' own SELECT policy checked membership via an EXISTS
-- subquery against organization_admins itself - but evaluating that
-- subquery re-applies organization_admins' SELECT policy to the rows it
-- scans, which re-runs the same subquery, forever ("infinite recursion
-- detected in policy for relation organization_admins", 42P17). The same
-- subquery shape was reused (checking organization_admins from a
-- different table's policy) in organization_admin_invites and
-- organization_whitelist - those don't self-reference, but every EXISTS
-- subquery against organization_admins still has to apply its SELECT
-- policy to scan it, so they hit the exact same recursion.
--
-- Standard fix: a SECURITY DEFINER function bypasses RLS for its own
-- internal query, breaking the cycle - membership is looked up once,
-- directly, with no policy re-evaluation.
create or replace function is_organization_admin(org_id bigint) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from organization_admins
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

drop policy "org admins and global admins can view org admin lists" on organization_admins;
create policy "org admins and global admins can view org admin lists" on organization_admins
  for select using (
    is_organization_admin(organization_id)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

drop policy "org admins and global admins can view admin invites" on organization_admin_invites;
create policy "org admins and global admins can view admin invites" on organization_admin_invites
  for select using (
    is_organization_admin(organization_id)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

drop policy "org admins and global admins can view their whitelist" on organization_whitelist;
create policy "org admins and global admins can view their whitelist" on organization_whitelist
  for select using (
    is_organization_admin(organization_id)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

drop policy "org admins can whitelist members" on organization_whitelist;
create policy "org admins can whitelist members" on organization_whitelist
  for insert with check (is_organization_admin(organization_id));

drop policy "org admins can edit their whitelist" on organization_whitelist;
create policy "org admins can edit their whitelist" on organization_whitelist
  for update using (is_organization_admin(organization_id));

drop policy "org admins can remove whitelist entries" on organization_whitelist;
create policy "org admins can remove whitelist entries" on organization_whitelist
  for delete using (is_organization_admin(organization_id));

grant execute on function is_organization_admin(bigint) to authenticated;

-- The "you're recognized, pending a language assignment" notice on
-- app/learn/page.tsx needs a signed-in visitor to read their OWN
-- organization_whitelist row - previously only that org's admins (or a
-- global admin) could select from this table at all, since it wasn't
-- designed for a member to check their own status.
create policy "users can view their own whitelist entry" on organization_whitelist
  for select using (claimed_by = auth.uid());

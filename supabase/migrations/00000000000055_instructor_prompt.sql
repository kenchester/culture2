-- Lets an instructor (or org admin) pin a weekly conversation prompt to
-- the top of their organization-gated network - the "instructor" role in
-- organization_whitelist has been purely a label until now, with nothing
-- in the app treating it differently from "student".
alter table networks add column instructor_prompt text;
alter table networks add column instructor_prompt_set_by uuid references profiles(id);
alter table networks add column instructor_prompt_set_at timestamptz;

-- SECURITY DEFINER for the same reason as is_organization_admin
-- (00000000000050): any EXISTS subquery that scans organization_whitelist
-- would otherwise re-apply organization_whitelist's own RLS policies to
-- the rows it scans, and since one of those policies is itself defined via
-- is_organization_admin, an ordinary (non-SECURITY DEFINER) version of
-- this function risks the exact same recursion. Two paths: a claimed
-- instructor/admin whitelist entry whose language_ids covers this
-- network's language, or plain org-admin membership (an org admin can
-- always manage any of their org's network prompts, not just instructors).
create or replace function can_manage_network_prompt(p_network_id bigint) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from organization_languages ol
    join organization_whitelist ow on ow.organization_id = ol.organization_id
    where ol.network_id = p_network_id
      and ow.claimed_by = auth.uid()
      and ow.role in ('instructor', 'admin')
      and ol.language_id = any(ow.language_ids)
  ) or exists (
    select 1 from organization_languages ol
    join organization_admins oa on oa.organization_id = ol.organization_id
    where ol.network_id = p_network_id and oa.user_id = auth.uid()
  );
$$;

grant execute on function can_manage_network_prompt(bigint) to authenticated;

-- networks has never had an UPDATE policy or grant at all ("no
-- network-editing feature to authorize otherwise", 00000000000003_rls.sql).
-- A row-level policy alone would make the WHOLE row editable once true
-- (title, member_count, post_count, ...), which is far more than intended -
-- pairing it with a column-scoped grant is what actually restricts this to
-- just the three prompt columns; Postgres enforces both independently, so
-- an UPDATE touching any other column is rejected regardless of RLS.
create policy "instructors and org admins can set the network prompt" on networks
  for update using (can_manage_network_prompt(id)) with check (can_manage_network_prompt(id));

grant update (instructor_prompt, instructor_prompt_set_by, instructor_prompt_set_at) on networks to authenticated;

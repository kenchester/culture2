-- Self-serve "bring your own class" requests: an individual instructor
-- (not a global admin) asks for a single free class/language at their
-- school. Stays pending until a global admin reviews the LinkedIn/faculty
-- profile link and approves or rejects it - approval is what actually
-- creates the organizations/networks/organization_languages rows (see
-- app/admin/organizations/actions.ts's approveOrganizationRequest), not
-- this table. location_name/parent_country_id are captured here rather
-- than a real places row so a rejected request doesn't leave clutter in
-- places - the hidden places row only gets created on approval, same as
-- createOrganization already does for the manual/paid flow.
create table organization_requests (
  id bigint generated always as identity primary key,
  requested_by uuid not null references profiles(id),
  institutional_email text not null,
  profile_url text not null,
  school_name text not null,
  language_id bigint not null references languages(id),
  location_name text not null,
  parent_country_id bigint not null references places(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resulting_organization_id bigint references organizations(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table organization_requests enable row level security;

-- A signed-in instructor can submit their own request (proves they control
-- institutional_email via the session, not a typed-in claim) but can't see
-- anyone else's - only a global admin reviews the queue.
create policy "authenticated users can submit their own request" on organization_requests
  for insert with check (requested_by = auth.uid());

create policy "global admins can view and manage requests" on organization_requests
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "global admins can update requests" on organization_requests
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- This project has no default role grants (see 00000000000027) - every
-- table needs its permitted operations granted explicitly per role.
grant insert on organization_requests to authenticated;
grant select, update on organization_requests to authenticated;

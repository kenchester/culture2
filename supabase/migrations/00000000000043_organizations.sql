-- "Campus" tenants: a gated organization (e.g. a university) with its own
-- admin hierarchy, a whitelist of allowed members, and a fixed set of
-- pre-launched language networks. profiles.is_admin (00000000000010) is a
-- single flat global boolean with no precedent for scoping admin rights to
-- one organization, so this is a new, tenant-generic layer - Acme
-- University is seeded as the first (and so far only) row, not hardcoded
-- into the schema.

create table organizations (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  subdomain text not null unique,
  domain text,
  location_place_id bigint not null references places(id),
  created_at timestamptz not null default now()
);

-- Which of an org's fixed languages are enabled, and which pre-launched
-- network backs each one. A network can only be claimed by one org (an
-- org-gated network isn't meant to double as a second org's network too).
create table organization_languages (
  organization_id bigint not null references organizations(id) on delete cascade,
  language_id bigint not null references languages(id),
  network_id bigint not null references networks(id) unique,
  primary key (organization_id, language_id)
);

-- Org-level admins, distinct from the global profiles.is_admin flag.
create table organization_admins (
  organization_id bigint not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Token-based invite for bootstrapping an org's FIRST admin - there's no
-- existing org-admin yet to grant access another way, so this is the one
-- place a real accept-by-token flow is needed (every other admin, and
-- every student/instructor, gets in via organization_whitelist below,
-- claimed automatically on sign-in - no token to click through).
create table organization_admin_invites (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references profiles(id),
  accepted_by uuid references profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

-- Who's allowed into an org, their role, and (for students/instructors)
-- which language network(s) they're pre-enrolled into. Populated by an org
-- admin ahead of time; "claimed" - network_members seeded, claimed_by set -
-- the moment a matching email signs in, regardless of whether the person
-- had an account before being whitelisted or after.
create table organization_whitelist (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('student', 'instructor', 'admin')),
  language_ids bigint[] not null default '{}',
  invited_by uuid references profiles(id),
  claimed_by uuid references profiles(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

-- UNIQUE constraints can't take expressions like lower(email), only plain
-- column lists - a unique index is the standard way to get the same
-- guarantee (no re-whitelisting the same person twice under different
-- casing) against an expression.
create unique index organization_whitelist_org_email_idx
  on organization_whitelist (organization_id, lower(email));

-- Domain-availability banner leads: a school domain that doesn't match any
-- existing organization gets captured here instead of silently discarded.
create table organization_leads (
  id bigint generated always as identity primary key,
  domain text not null,
  created_at timestamptz not null default now()
);

-- Lets a place be excluded from the main site's location search/autocomplete
-- while still existing as a real places row - used for organization
-- location anchors (e.g. "Acme University") that should only be reachable
-- through that organization's own locked forms, never typed/found by a
-- general visitor searching for a location.
alter table places add column hidden_from_search boolean not null default false;

alter table organizations enable row level security;
alter table organization_languages enable row level security;
alter table organization_admins enable row level security;
alter table organization_admin_invites enable row level security;
alter table organization_whitelist enable row level security;
alter table organization_leads enable row level security;

-- Organizations + their language/network mapping: publicly readable (the
-- landing page and domain-check banner both need to work anonymously),
-- writable only by global admins - creating an org is a platform-level
-- action, same tier as creating an embed partner.
create policy "organizations are publicly readable" on organizations
  for select using (true);

create policy "global admins can create organizations" on organizations
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "global admins can update organizations" on organizations
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "organization languages are publicly readable" on organization_languages
  for select using (true);

create policy "global admins can manage organization languages" on organization_languages
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- Org admins: an org's own admins can see their co-admins; global admins
-- can see all of them too (for the platform-level Organizations tab).
-- Insert is deliberately not opened to `authenticated` at all - the only
-- two paths that grant admin status (invite-token acceptance, and a
-- role='admin' whitelist claim) both run through the service-role client,
-- same as the existing geo-translation cache-fill precedent.
create policy "org admins and global admins can view org admin lists" on organization_admins
  for select using (
    exists (
      select 1 from organization_admins oa
      where oa.organization_id = organization_admins.organization_id and oa.user_id = auth.uid()
    )
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- Admin invites: only global admins create them (bootstrapping an org's
-- first admin); an org's own admins can see which invites are outstanding.
-- Accepting one (setting accepted_by/accepted_at) runs through the
-- service-role client so a stolen/guessed token can't be validated by RLS
-- alone - the accept action itself checks expiry/prior-acceptance in code.
create policy "org admins and global admins can view admin invites" on organization_admin_invites
  for select using (
    exists (
      select 1 from organization_admins oa
      where oa.organization_id = organization_admin_invites.organization_id and oa.user_id = auth.uid()
    )
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "global admins can create admin invites" on organization_admin_invites
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- Whitelist: contains emails (PII-ish), so unlike most tables in this app
-- it is NOT publicly readable - only that org's own admins (or a global
-- admin) can see or manage it. claimed_by/claimed_at are set by the
-- service-role claim flow, not by the org admin directly.
create policy "org admins and global admins can view their whitelist" on organization_whitelist
  for select using (
    exists (
      select 1 from organization_admins oa
      where oa.organization_id = organization_whitelist.organization_id and oa.user_id = auth.uid()
    )
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "org admins can whitelist members" on organization_whitelist
  for insert with check (
    exists (
      select 1 from organization_admins oa
      where oa.organization_id = organization_whitelist.organization_id and oa.user_id = auth.uid()
    )
  );

create policy "org admins can edit their whitelist" on organization_whitelist
  for update using (
    exists (
      select 1 from organization_admins oa
      where oa.organization_id = organization_whitelist.organization_id and oa.user_id = auth.uid()
    )
  );

create policy "org admins can remove whitelist entries" on organization_whitelist
  for delete using (
    exists (
      select 1 from organization_admins oa
      where oa.organization_id = organization_whitelist.organization_id and oa.user_id = auth.uid()
    )
  );

-- Leads: anyone (including anonymous visitors on the public banner) can
-- submit one; only global admins can review the list.
create policy "anyone can submit a lead" on organization_leads
  for insert with check (true);

create policy "global admins can view leads" on organization_leads
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- This project has no default role grants (see 00000000000027) - every
-- table needs its permitted operations granted explicitly per role.
grant select on organizations, organization_languages to anon, authenticated;
grant insert, update on organizations to authenticated;
grant insert on organization_languages to authenticated;
grant select on organization_admins, organization_admin_invites to authenticated;
grant insert on organization_admin_invites to authenticated;
grant select, insert, update, delete on organization_whitelist to authenticated;
grant insert on organization_leads to anon, authenticated;
grant select on organization_leads to authenticated;

-- The whitelist-claim flow (auto-enrolling a whitelisted member the moment
-- they sign in) and invite-token acceptance both run through the
-- service-role client, bypassing RLS by design - same precedent as
-- lib/geo-translation.ts's cache-fill writes.
grant select, update on organization_whitelist to service_role;
grant select, insert, update on organization_admins to service_role;
grant select, update on organization_admin_invites to service_role;
grant select, insert on network_members to service_role;
grant select on organizations, organization_languages to service_role;

-- Today ANY authenticated user can join ANY network as themselves (see
-- "users can join a network as themselves" in 00000000000003_rls.sql) -
-- fine for the public product, but wrong for an org-gated network, where
-- membership is meant to come only from an admin's whitelist. A permissive
-- policy can only ever widen access, so blocking this specific case needs
-- a RESTRICTIVE policy (ANDed against every permissive one) - the first
-- use of `as restrictive` in this codebase. For the vast majority of
-- networks (not in organization_languages) the check is vacuously true, so
-- ordinary self-serve joining elsewhere on the site is unaffected; for an
-- org-gated network it blocks the existing permissive insert policy from
-- taking effect at all, leaving the service-role-driven whitelist-claim
-- flow as the only path in.
create policy "org-gated networks block self-serve join"
  on network_members as restrictive for insert
  with check (
    not exists (
      select 1 from organization_languages ol where ol.network_id = network_members.network_id
    )
  );

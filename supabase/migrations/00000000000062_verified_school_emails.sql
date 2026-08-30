-- Lets someone already signed in under one identity (their main
-- CultureMesh account, or an account tied to a school they've since left)
-- prove they also control a *different* school's email, without creating
-- a second account or losing their current one. verified_school_emails is
-- the durable result (checked by lib/organization-whitelist.ts's domain
-- matching alongside the sign-in email); pending_email_verifications is
-- the short-lived one-time code that proves it.
--
-- The code here is our own (see app/learn/[slug]/actions.ts), not routed
-- through Supabase Auth's own OTP - that mechanism issues a session for
-- the email it verifies, which would mean either creating a second
-- auth.users row for the same person or switching them out of the
-- session they're already in, neither of which is the point here.
create table verified_school_emails (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  email text not null,
  verified_at timestamptz not null default now(),
  unique (profile_id, email)
);

create table pending_email_verifications (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index pending_email_verifications_lookup_idx on pending_email_verifications (profile_id, email, code);

alter table verified_school_emails enable row level security;
alter table pending_email_verifications enable row level security;

-- A user can see which emails they've verified (e.g. a future account
-- settings page) but never write here directly - only the service-role
-- verifyEmailCode action inserts, once it's checked the code itself.
create policy "users can view their own verified emails" on verified_school_emails
  for select using (profile_id = auth.uid());

grant select on verified_school_emails to authenticated;
grant select, insert on verified_school_emails to service_role;

-- pending_email_verifications holds the actual code - no policy grants
-- select/insert/delete to anything but service_role, matching how a
-- bypassable one-time secret should be handled (nothing here is ever
-- meant to be readable by the client that's trying to prove the code).
grant select, insert, delete on pending_email_verifications to service_role;

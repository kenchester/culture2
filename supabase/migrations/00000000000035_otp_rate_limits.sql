-- Tracks sign-in/sign-up OTP attempts (by email and IP) so
-- sendOtp/checkEmailStatus can rate-limit abuse. Server-internal
-- bookkeeping, not user data - no policies and no grants to
-- anon/authenticated at all, so only a service-role client
-- (lib/supabase/admin.ts) can read or write it. RLS is still enabled
-- even with zero policies, matching this project's convention of never
-- relying on a table being ungranted as its only protection.
create table otp_attempts (
  id bigint generated always as identity primary key,
  email text,
  ip text,
  created_at timestamptz not null default now()
);

create index otp_attempts_email_idx on otp_attempts (email, created_at);
create index otp_attempts_ip_idx on otp_attempts (ip, created_at);

alter table otp_attempts enable row level security;

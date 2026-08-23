-- encrypted_password can never be trusted as a "did this user choose a
-- password" signal - Supabase/GoTrue sets it internally on every
-- auth.users row regardless of user intent (confirmed 42/42 accounts in
-- 00000000000037). has_password is the only genuine signal: it starts
-- false for everyone and is flipped to true exclusively by the app's own
-- new setPassword action (app/(auth)/actions.ts), after a real
-- supabase.auth.updateUser({ password }) call succeeds.
alter table profiles add column has_password boolean not null default false;

create or replace function public.email_account_status(p_email text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exists', exists(select 1 from auth.users where email = p_email),
    'hasPassword', coalesce(
      (select p.has_password from profiles p join auth.users u on u.id = p.id where u.email = p_email),
      false
    )
  );
$$;

-- Replaces two separate count queries (lib/rate-limit.ts) with one -
-- otp_attempts is service-role-only bookkeeping (00000000000036), so this
-- follows the same grant-only-to-service_role pattern.
create or replace function public.otp_rate_limit_exceeded(
  p_email text,
  p_ip text,
  p_email_limit int,
  p_ip_limit int,
  p_since timestamptz
) returns boolean
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from otp_attempts where email = p_email and created_at >= p_since) >= p_email_limit
    or
    (select count(*) from otp_attempts where ip = p_ip and created_at >= p_since) >= p_ip_limit;
$$;

grant execute on function public.otp_rate_limit_exceeded(text, text, int, int, timestamptz) to service_role;

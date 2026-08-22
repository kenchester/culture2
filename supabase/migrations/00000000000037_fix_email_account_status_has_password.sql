-- email_account_status's hasPassword check (encrypted_password is not
-- null) was always true for every single account - confirmed live,
-- 42/42 users - since Supabase/GoTrue sets a non-null encrypted_password
-- internally on every auth.users row regardless of whether a user ever
-- actually chose a password. This app has no "set a password" flow at
-- all, only the OTP path, so every account (new or returning) was
-- incorrectly routed to the password sign-in step on any visit after
-- the first, where entering anything failed with "Invalid login
-- credentials" - there being no real password to match. Until a real
-- password-setting feature exists and explicitly tracks it, hasPassword
-- can only ever correctly be false.
create or replace function public.email_account_status(p_email text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exists', exists(select 1 from auth.users where email = p_email),
    'hasPassword', false
  );
$$;

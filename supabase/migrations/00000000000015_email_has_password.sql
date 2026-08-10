-- Lets the sign-in form offer "sign in with your password" to returning
-- users who already set one, instead of always making them wait on an
-- emailed code - while brand-new/passwordless accounts (the common case for
-- embed registrations) still go straight to the code flow. Only exposes a
-- boolean, never anything else about the account.
create or replace function public.email_has_password(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where email = p_email
      and encrypted_password is not null
      and encrypted_password != ''
  );
$$;

grant execute on function public.email_has_password(text) to anon, authenticated;

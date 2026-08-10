-- Replaces email_has_password: the sign-in form also needs to know whether
-- an email is registered at all (not just whether it has a password), so it
-- can ask a brand-new registrant for their name before sending a code,
-- without asking returning users anything extra.
drop function if exists public.email_has_password(text);

create or replace function public.email_account_status(p_email text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exists', exists(select 1 from auth.users where email = p_email),
    'hasPassword', exists(
      select 1
      from auth.users
      where email = p_email
        and encrypted_password is not null
        and encrypted_password != ''
    )
  );
$$;

grant execute on function public.email_account_status(text) to anon, authenticated;

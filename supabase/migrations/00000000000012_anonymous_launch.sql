-- Launching a network no longer requires an account - only participating
-- (joining, posting, RSVPing) does. This lets a visitor arriving via
-- search, or via an embassy/partner embed, create a network on the spot
-- and land straight on its page, matching the same "sign in to join the
-- discussion" experience they'd see landing on any other network they
-- didn't create.

drop policy "authenticated users can launch a network" on networks;

create policy "anyone can launch a network" on networks
  for insert with check (auth.uid() = launched_by or launched_by is null);

grant insert on networks to anon;

-- Re-created rather than replaced in place so the function body is fully
-- visible here instead of split across two migrations. Anonymous callers
-- get launched_by = null and no membership row (there's no user to add as
-- a member); authenticated callers keep the original behavior exactly.
create or replace function launch_network(
  p_language_id bigint,
  p_origin_place_id bigint,
  p_location_place_id bigint,
  p_title text
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_network_id bigint;
begin
  insert into networks (language_id, origin_place_id, location_place_id, title, launched_by)
  values (p_language_id, p_origin_place_id, p_location_place_id, p_title, auth.uid())
  returning id into v_network_id;

  if auth.uid() is not null then
    insert into network_members (network_id, user_id)
    values (v_network_id, auth.uid());
  end if;

  return v_network_id;
end;
$$;

grant execute on function launch_network(bigint, bigint, bigint, text) to anon;

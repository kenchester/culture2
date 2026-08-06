-- Launching a network and joining as its first member happen together in
-- one transaction, so a failure partway through can't leave an orphaned
-- network with zero members. security invoker (the default, made explicit
-- here) means this still runs as the calling user — the existing RLS
-- policies on networks/network_members (auth.uid() = launched_by /
-- auth.uid() = user_id) apply exactly as they would for direct inserts.
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

  insert into network_members (network_id, user_id)
  values (v_network_id, auth.uid());

  return v_network_id;
end;
$$;

grant execute on function launch_network(bigint, bigint, bigint, text) to authenticated;

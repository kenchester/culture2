-- Adds religion as a third possible origin for launch_network, alongside
-- language and place. The old 4-arg signature is dropped explicitly
-- rather than left as a stale overload nobody calls anymore.
drop function launch_network(bigint, bigint, bigint, text);

create or replace function launch_network(
  p_language_id bigint,
  p_origin_place_id bigint,
  p_religion_id bigint,
  p_location_place_id bigint,
  p_title text
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_network_id bigint;
begin
  insert into networks (language_id, origin_place_id, religion_id, location_place_id, title, launched_by)
  values (p_language_id, p_origin_place_id, p_religion_id, p_location_place_id, p_title, auth.uid())
  returning id into v_network_id;

  if auth.uid() is not null then
    insert into network_members (network_id, user_id)
    values (v_network_id, auth.uid());
  end if;

  return v_network_id;
end;
$$;

grant execute on function launch_network(bigint, bigint, bigint, bigint, text) to anon;

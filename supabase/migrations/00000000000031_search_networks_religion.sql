-- Adds religion as a third possible origin match, alongside language and
-- place. The broader/narrower CTEs walk the *location* hierarchy only and
-- are completely unaffected by origin type, so this is a minimal, additive
-- change - just one more OR-clause on the origin match. Old 3-arg
-- signature dropped explicitly rather than left as a stale overload.
drop function search_networks(bigint, bigint, bigint);

create or replace function search_networks(
  p_language_id bigint,
  p_origin_place_id bigint,
  p_religion_id bigint,
  p_location_place_id bigint
)
returns table (
  match_kind text,
  network_id bigint,
  network_title text,
  location_place_id bigint,
  location_name text,
  location_type place_type,
  member_count int,
  post_count int
)
language sql stable
as $$
  with recursive ancestors as (
    select id, parent_id, 0 as depth from places where id = p_location_place_id
    union all
    select p.id, p.parent_id, a.depth + 1
    from places p join ancestors a on p.id = a.parent_id
  ),
  descendants as (
    select id, parent_id, 0 as depth from places where id = p_location_place_id
    union all
    select p.id, p.parent_id, d.depth + 1
    from places p join descendants d on p.parent_id = d.id
  ),
  matched as (
    select n.*,
      case
        when n.location_place_id = p_location_place_id then 'exact'
        when n.location_place_id in (select id from ancestors where depth > 0) then 'related_broader'
        else 'related_narrower'
      end as kind
    from networks n
    where (
      (p_language_id is not null and n.language_id = p_language_id)
      or (p_origin_place_id is not null and n.origin_place_id = p_origin_place_id)
      or (p_religion_id is not null and n.religion_id = p_religion_id)
    )
    and (
      n.location_place_id = p_location_place_id
      or n.location_place_id in (select id from ancestors where depth > 0)
      or n.location_place_id in (select id from descendants where depth > 0)
    )
  )
  select m.kind, m.id, m.title, m.location_place_id, loc.name, loc.type, m.member_count, m.post_count
  from matched m
  join places loc on loc.id = m.location_place_id
  order by case m.kind when 'exact' then 0 when 'related_broader' then 1 else 2 end
  limit 50;
$$;

grant execute on function search_networks(bigint, bigint, bigint, bigint) to anon, authenticated;

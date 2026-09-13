-- Keep school networks out of public search results.
--
-- search_networks walks the location hierarchy and returns anything whose
-- location is an ancestor or descendant of the one searched. A school
-- campus is a descendant of its city, which is a descendant of its region -
-- so searching "Mandarin + Michigan" returned "Mandarin speakers at
-- Michigan State University" as a narrower match, because the MSU campus
-- place sits under East Lansing under Michigan.
--
-- Offering that network is a dead end in three separate ways. Self-serve
-- joining is blocked for org-gated networks (00000000000043), its posts are
-- unreadable to non-members (00000000000078), and the page itself lives on
-- learn.culturemesh.com rather than the main site. Nothing about it is
-- reachable from a public search, so listing it only wastes a click and
-- advertises a school's roster of networks to people outside the school.
--
-- Demo organizations are excluded on the same terms. The Acme networks are
-- explored from their own school page, and surfacing seeded demo content in
-- real search results would be worse than useless.
--
-- This deliberately does NOT consult auth.uid(). Membership doesn't make a
-- school network a sensible search result on the main site - members reach
-- their networks from the school page, on the subdomain built for it - and
-- a stable, non-user-dependent result set keeps the function `stable` and
-- cacheable.
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
    -- The new clause: org-gated networks are not public search results.
    and not exists (
      select 1 from organization_languages ol where ol.network_id = n.id
    )
  )
  select m.kind, m.id, m.title, m.location_place_id, loc.name, loc.type, m.member_count, m.post_count
  from matched m
  join places loc on loc.id = m.location_place_id
  order by case m.kind when 'exact' then 0 when 'related_broader' then 1 else 2 end
  limit 50;
$$;

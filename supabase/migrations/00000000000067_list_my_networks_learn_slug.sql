-- app/my-networks/page.tsx needs to link each network to the right host:
-- a campus-anchored network (launched from learn.culturemesh.com) must
-- always resolve to learn.culturemesh.com/networks/{id}, everything else to
-- the plain host - regardless of which subdomain the visitor is currently
-- browsing my-networks from (see app/networks/[id]/page.tsx's identical
-- "campus location -> the one org anchored there" lookup for the same
-- reasoning). learn_slug is null for every non-campus network.
-- Adds a return column (learn_slug) - Postgres won't let create-or-replace
-- change an existing function's row type, so the old signature has to be
-- dropped first.
drop function if exists list_my_networks(int, int);

create or replace function list_my_networks(p_limit int default 10, p_offset int default 0)
returns table (
  network_id bigint,
  title text,
  member_count int,
  post_count int,
  last_activity timestamptz,
  learn_slug text
)
language sql stable as $$
  select n.id, n.title, n.member_count, n.post_count, max(activity.at) as last_activity,
    case when p.type = 'campus' then o.slug else null end as learn_slug
  from (
    select network_id, joined_at as at from network_members where user_id = auth.uid()
    union all
    select id as network_id, launched_at as at from networks where launched_by = auth.uid()
  ) activity
  join networks n on n.id = activity.network_id
  left join places p on p.id = n.location_place_id
  left join organizations o on o.location_place_id = n.location_place_id
  group by n.id, n.title, n.member_count, n.post_count, p.type, o.slug
  order by last_activity desc
  limit p_limit offset p_offset;
$$;

grant execute on function list_my_networks(int, int) to authenticated;

-- Backs app/my-networks/page.tsx - "most recently joined" alone
-- (network_members.joined_at) misses a network someone launched
-- themselves without a separate join event ever being recorded for them
-- (networks.launched_by/launched_at). Unions both activity sources, takes
-- the more recent per network, and dedupes via group by - a network
-- someone both launched AND is a member of only appears once. Plain sql
-- (not security definer), same as search_networks - both source tables
-- are already publicly readable, this just adds auth.uid()-scoping and
-- pagination on top.
create or replace function list_my_networks(p_limit int default 10, p_offset int default 0)
returns table (
  network_id bigint,
  title text,
  member_count int,
  post_count int,
  last_activity timestamptz
)
language sql stable as $$
  select n.id, n.title, n.member_count, n.post_count, max(activity.at) as last_activity
  from (
    select network_id, joined_at as at from network_members where user_id = auth.uid()
    union all
    select id as network_id, launched_at as at from networks where launched_by = auth.uid()
  ) activity
  join networks n on n.id = activity.network_id
  group by n.id, n.title, n.member_count, n.post_count
  order by last_activity desc
  limit p_limit offset p_offset;
$$;

grant execute on function list_my_networks(int, int) to authenticated;

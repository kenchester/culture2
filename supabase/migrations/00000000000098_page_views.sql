-- Counting what gets looked at, so an experiment can be read.
--
-- Everything built this month rests on one bet: that reference pages are
-- worth landing on before anyone has joined. That bet is currently
-- untestable - there is no measurement of any kind on this site, so
-- "nobody came" and "we cannot tell" are the same observation.
--
-- Deliberately the least data that answers the question. A path and a
-- day. No IP address, no user agent, no cookie, no session, no user id,
-- no referrer - none of which is needed to learn whether corridor pages
-- attract anybody, and all of which would turn a counter into a tracking
-- system. A diaspora platform in particular has no business holding a
-- log of who read which origin's page.
create table page_views (
  path text not null,
  day date not null,
  views int not null default 0,
  primary key (path, day)
);

-- Counts are aggregate and nobody is identified by them, but there is no
-- reason for them to be public either.
alter table page_views enable row level security;

-- Written through a function so the only possible operation is "add one
-- to this path today" - not insert, not update, not delete.
create or replace function record_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bound the key space: a path is a route, and anything longer than this
  -- is someone probing rather than reading.
  if p_path is null or length(p_path) > 200 then return; end if;

  insert into page_views (path, day, views)
  values (p_path, current_date, 1)
  on conflict (path, day) do update set views = page_views.views + 1;
end;
$$;

grant execute on function record_page_view(text) to anon, authenticated;
grant select, insert, update, delete on page_views to service_role;

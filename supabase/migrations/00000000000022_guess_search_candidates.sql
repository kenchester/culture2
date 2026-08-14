-- Powers the search-results fallback: when a visitor types a place or
-- language but submits without picking a suggestion from the dropdown, we
-- guess candidate matches instead of dead-ending on "missing parameters".
-- Substring matches (the same ILIKE the live dropdown already uses) are
-- tried first so results stay identical to what the user saw while typing;
-- pg_trgm-based fuzzy matching only kicks in as a fallback when nothing
-- matched literally, to recover from misspellings (e.g. "michgan").
create extension if not exists pg_trgm;

create or replace function guess_places(p_query text, p_type text default null, p_limit int default 3)
returns table (id bigint, name text, type place_type, parent_name text)
language sql
stable
as $$
  with substring_matches as (
    select pl.id, pl.name, pl.type, parent.name as parent_name
    from places pl
    left join places parent on parent.id = pl.parent_id
    where pl.name ilike '%' || p_query || '%'
      and (p_type is null or pl.type::text = p_type)
    order by pl.name
    limit p_limit
  ),
  fuzzy_matches as (
    select pl.id, pl.name, pl.type, parent.name as parent_name
    from places pl
    left join places parent on parent.id = pl.parent_id
    where not exists (select 1 from substring_matches)
      and (p_type is null or pl.type::text = p_type)
      and lower(pl.name) % lower(p_query)
    order by similarity(lower(pl.name), lower(p_query)) desc, pl.name
    limit p_limit
  )
  select * from substring_matches
  union all
  select * from fuzzy_matches;
$$;

grant execute on function guess_places(text, text, int) to anon, authenticated;

create or replace function guess_languages(p_query text, p_limit int default 3)
returns table (id bigint, name text)
language sql
stable
as $$
  with substring_matches as (
    select id, name
    from languages
    where name ilike '%' || p_query || '%'
    order by name
    limit p_limit
  ),
  fuzzy_matches as (
    select id, name
    from languages
    where not exists (select 1 from substring_matches)
      and lower(name) % lower(p_query)
    order by similarity(lower(name), lower(p_query)) desc, name
    limit p_limit
  )
  select * from substring_matches
  union all
  select * from fuzzy_matches;
$$;

grant execute on function guess_languages(text, int) to anon, authenticated;

-- Powers the faith search's "guess candidates from typed text" fallback,
-- same substring-then-fuzzy pattern as guess_places/guess_languages
-- (00000000000022_guess_search_candidates.sql), but with an explicit
-- alias tier in between: "Baha'i" must deterministically resolve to
-- "Bahá'í" rather than relying on trigram-similarity luck, so alias
-- substring matches are tried before falling back to fuzzy matching.
create or replace function guess_religions(p_query text, p_limit int default 3)
returns table (id bigint, name text)
language sql
stable
as $$
  with name_matches as (
    select id, name
    from religions
    where name ilike '%' || p_query || '%'
    order by name
    limit p_limit
  ),
  alias_matches as (
    select r.id, r.name
    from religions r
    where not exists (select 1 from name_matches)
      and exists (select 1 from unnest(r.aliases) a where a ilike '%' || p_query || '%')
    order by r.name
    limit p_limit
  ),
  fuzzy_matches as (
    select id, name
    from religions
    where not exists (select 1 from name_matches)
      and not exists (select 1 from alias_matches)
      and lower(name) % lower(p_query)
    order by similarity(lower(name), lower(p_query)) desc, name
    limit p_limit
  )
  select * from name_matches
  union all
  select * from alias_matches
  union all
  select * from fuzzy_matches;
$$;

grant execute on function guess_religions(text, int) to anon, authenticated;

-- Let a place search be scoped to one parent.
--
-- Without this, every region in the world is offered wherever a region is
-- asked for. Choosing Mexico and then picking Bavaria is accepted, and the
-- mistake only surfaces later when someone reads the result. The same gap
-- exists in the admin place editor, where a city's state/province comes
-- from an unfiltered list.
--
-- Matches the DIRECT parent, not any ancestor. That is exactly right for
-- the case this serves - a region's parent is always its country - and
-- deliberately not extended to descendants: a city's parent may be either a
-- region or a country (00000000000001), so "cities in country X" is a
-- different question needing a recursive walk, and nothing asks it.
--
-- The old 4-argument function is dropped rather than left alongside. A
-- default-valued fifth parameter would make search_places(a, b, c, d)
-- ambiguous between the two, and PostgreSQL refuses such a call rather
-- than choosing.
--
-- The body is otherwise byte-for-byte the one from 00000000000044 - same
-- immutable_unaccent contains-match, same hidden_from_search exclusion,
-- same ordering. Only the one AND clause is new.
drop function if exists search_places(text, text, int, text);

create or replace function search_places(
  p_query text,
  p_type text default null,
  p_limit int default 10,
  p_locale text default 'en',
  p_parent_id bigint default null
)
returns table(id bigint, name text, type place_type, parent_id bigint, parent_name text, parent_type place_type)
language sql stable as $$
  select
    pl.id,
    coalesce(gt.translated_name, pl.name) as name,
    pl.type,
    pl.parent_id,
    coalesce(pgt.translated_name, parent.name) as parent_name,
    parent.type as parent_type
  from places pl
  left join places parent on parent.id = pl.parent_id
  left join geo_translations gt
    on gt.entity_type = 'place' and gt.entity_id = pl.id and gt.locale = p_locale
  left join geo_translations pgt
    on pgt.entity_type = 'place' and pgt.entity_id = parent.id and pgt.locale = p_locale
  where not pl.hidden_from_search
    and (
      immutable_unaccent(lower(pl.name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
      or (
        gt.translated_name is not null
        and immutable_unaccent(lower(gt.translated_name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
      )
    )
    and (p_type is null or pl.type::text = p_type)
    and (p_parent_id is null or pl.parent_id = p_parent_id)
  order by pl.name
  limit p_limit;
$$;

grant execute on function search_places(text, text, int, text, bigint) to anon, authenticated;

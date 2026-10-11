-- Return the whole geographic chain, not just one level up.
--
-- "Xiamen, Fujian" is ambiguous to anyone who doesn't already know where
-- Fujian is, and the problem is much worse for repeated names: there is a
-- San Jose in California, in Costa Rica, and in the Philippines, and a
-- picker showing "San Jose, California" versus "San Jose, San Jose" asks
-- the reader to supply the knowledge the picker should be giving them.
--
-- A city's parent may be a region OR a country (00000000000001), so the
-- chain is at most three deep and the third element is only sometimes
-- present: city -> region -> country, or city -> country. Returning the
-- grandparent and letting the caller drop the blanks keeps that shape
-- honest without a recursive walk.
--
-- Body is otherwise exactly 00000000000083's, including its parent filter.
-- Only the two joins and two output columns are new.
drop function if exists search_places(text, text, int, text, bigint);

create or replace function search_places(
  p_query text,
  p_type text default null,
  p_limit int default 10,
  p_locale text default 'en',
  p_parent_id bigint default null
)
returns table(
  id bigint,
  name text,
  type place_type,
  parent_id bigint,
  parent_name text,
  parent_type place_type,
  grandparent_name text,
  grandparent_type place_type
)
language sql stable as $$
  select
    pl.id,
    coalesce(gt.translated_name, pl.name) as name,
    pl.type,
    pl.parent_id,
    coalesce(pgt.translated_name, parent.name) as parent_name,
    parent.type as parent_type,
    coalesce(ggt.translated_name, grandparent.name) as grandparent_name,
    grandparent.type as grandparent_type
  from places pl
  left join places parent on parent.id = pl.parent_id
  left join places grandparent on grandparent.id = parent.parent_id
  left join geo_translations gt
    on gt.entity_type = 'place' and gt.entity_id = pl.id and gt.locale = p_locale
  left join geo_translations pgt
    on pgt.entity_type = 'place' and pgt.entity_id = parent.id and pgt.locale = p_locale
  left join geo_translations ggt
    on ggt.entity_type = 'place' and ggt.entity_id = grandparent.id and ggt.locale = p_locale
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

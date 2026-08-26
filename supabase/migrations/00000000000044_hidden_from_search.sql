-- Excludes places.hidden_from_search rows (00000000000043) from the two
-- general-purpose location-search RPCs, so an organization's location
-- anchor (e.g. "Acme University") never surfaces in the main site's
-- location picker - only that organization's own locked forms reference it
-- directly by id, never via search. search_languages/guess_languages are
-- untouched (languages has no hidden_from_search column). The
-- partner-scoped RPCs (search_places_for_partner/guess_places_for_partner)
-- are also untouched - a hidden place is never inside an embed partner's
-- jurisdiction tree in the first place, so there's nothing for them to
-- leak.
create or replace function search_places(
  p_query text,
  p_type text default null,
  p_limit int default 10,
  p_locale text default 'en'
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
  order by pl.name
  limit p_limit;
$$;

create or replace function guess_places(
  p_query text,
  p_type text default null,
  p_limit int default 5,
  p_locale text default 'en'
)
returns table(id bigint, name text, type place_type, parent_name text)
language sql stable as $$
  with substring_matches as (
    select
      pl.id,
      coalesce(gt.translated_name, pl.name) as name,
      pl.type,
      coalesce(pgt.translated_name, parent.name) as parent_name
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
    order by pl.name
    limit p_limit
  ),
  fuzzy_matches as (
    select
      pl.id,
      coalesce(gt.translated_name, pl.name) as name,
      pl.type,
      coalesce(pgt.translated_name, parent.name) as parent_name
    from places pl
    left join places parent on parent.id = pl.parent_id
    left join geo_translations gt
      on gt.entity_type = 'place' and gt.entity_id = pl.id and gt.locale = p_locale
    left join geo_translations pgt
      on pgt.entity_type = 'place' and pgt.entity_id = parent.id and pgt.locale = p_locale
    where not pl.hidden_from_search
      and not exists (select 1 from substring_matches)
      and (p_type is null or pl.type::text = p_type)
      and lower(pl.name) % lower(p_query)
    order by similarity(lower(pl.name), lower(p_query)) desc, pl.name
    limit p_limit
  )
  select * from substring_matches
  union all
  select * from fuzzy_matches;
$$;

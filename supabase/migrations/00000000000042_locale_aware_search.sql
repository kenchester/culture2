-- Lets someone browsing in Spanish type "Estados Unidos" and find
-- "United States" - search now matches against a cached geo_translations
-- name for the current locale too, not just the raw English name, and
-- returns that translated name in place of the English one so autocomplete
-- results and the selected value both show up already localized (no
-- frontend display changes needed - callers already just render `name`).
--
-- Deliberately only matches what's ALREADY cached, same as
-- lib/geo-translation.ts's getGeoName - a search keystroke never triggers
-- a new Azure translation. Countries and languages are eagerly cached in
-- every locale (scripts/backfill-geo-cldr.ts), so this covers the most
-- commonly searched case immediately; a region/city becomes searchable by
-- its translated name only after it's been viewed at least once in that
-- locale, consistent with the existing lazy-translation design.
--
-- p_locale is appended as a new trailing parameter with a default, so
-- every existing caller that doesn't pass it (e.g. the embed flow, which
-- stays deliberately English-only) keeps working unchanged.
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
  where (
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

create or replace function search_languages(p_query text, p_limit int default 10, p_locale text default 'en')
returns table(id bigint, name text)
language sql stable as $$
  select l.id, coalesce(gt.translated_name, l.name) as name
  from languages l
  left join geo_translations gt
    on gt.entity_type = 'language' and gt.entity_id = l.id and gt.locale = p_locale
  where (
    immutable_unaccent(lower(l.name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
    or (
      gt.translated_name is not null
      and immutable_unaccent(lower(gt.translated_name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
    )
  )
  order by l.name
  limit p_limit;
$$;

-- Same locale-aware matching for the typed-text fallback path
-- (app/search/results/page.tsx, reached when nothing was selected from
-- the autocomplete dropdown) - the trigram fuzzy tier is untouched.
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
    where (
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

create or replace function guess_languages(p_query text, p_limit int default 5, p_locale text default 'en')
returns table(id bigint, name text)
language sql stable as $$
  with substring_matches as (
    select l.id, coalesce(gt.translated_name, l.name) as name
    from languages l
    left join geo_translations gt
      on gt.entity_type = 'language' and gt.entity_id = l.id and gt.locale = p_locale
    where (
      immutable_unaccent(lower(l.name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
      or (
        gt.translated_name is not null
        and immutable_unaccent(lower(gt.translated_name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
      )
    )
    order by l.name
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

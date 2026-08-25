-- Lets someone type "Sao Tome" or "Aland" and still find "São Tomé and
-- Príncipe" / "Åland" - display names keep their real, correct
-- diacritics (stripping them would make otherwise-correct English
-- exonyms look wrong), but every search path now matches with or
-- without them.
create extension if not exists unaccent;

-- unaccent() itself isn't marked immutable (its behavior technically
-- depends on the search_path-resolved text search dictionary), so
-- Postgres won't allow it directly in an index expression. This is the
-- standard workaround: a thin wrapper pinned to a specific dictionary,
-- which Postgres will accept as immutable.
-- Fully schema-qualified (both the function and the dictionary
-- argument) so this doesn't depend on search_path including public at
-- call time - an unqualified call resolved fine in an interactive
-- session but failed during `supabase db push`'s migration execution,
-- which apparently runs under a narrower search_path. set search_path
-- pins it for good measure too, matching this project's existing
-- SECURITY DEFINER RPCs.
create or replace function immutable_unaccent(text) returns text as $$
  select public.unaccent('public.unaccent'::regdictionary, $1);
$$ language sql immutable parallel safe set search_path = public;

create index places_name_unaccent_trgm_idx
  on places using gin (immutable_unaccent(lower(name)) gin_trgm_ops);
create index languages_name_unaccent_trgm_idx
  on languages using gin (immutable_unaccent(lower(name)) gin_trgm_ops);
create index religions_name_unaccent_trgm_idx
  on religions using gin (immutable_unaccent(lower(name)) gin_trgm_ops);

-- New: the live-autocomplete endpoint (app/api/places/search/route.ts)
-- previously did a plain ilike straight from the client, with no
-- diacritic tolerance at all. Same query shape as before (including the
-- nested parent name/type places already returns), just unaccent-aware.
create or replace function search_places(p_query text, p_type text default null, p_limit int default 10)
returns table(id bigint, name text, type place_type, parent_id bigint, parent_name text, parent_type place_type)
language sql stable as $$
  select pl.id, pl.name, pl.type, pl.parent_id, parent.name, parent.type
  from places pl
  left join places parent on parent.id = pl.parent_id
  where immutable_unaccent(lower(pl.name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
    and (p_type is null or pl.type::text = p_type)
  order by pl.name
  limit p_limit;
$$;

create or replace function search_languages(p_query text, p_limit int default 10)
returns table(id bigint, name text)
language sql stable as $$
  select id, name
  from languages
  where immutable_unaccent(lower(name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
  order by name
  limit p_limit;
$$;

grant execute on function search_places(text, text, int) to anon, authenticated;
grant execute on function search_languages(text, int) to anon, authenticated;

-- Existing guess_*/search_places_for_partner RPCs: swap their substring
-- tier from a plain ilike to the same unaccent-aware match. The trigram
-- (%) fuzzy fallback tier is untouched - still useful for genuine typos
-- beyond just missing diacritics.
create or replace function guess_places(p_query text, p_type text default null, p_limit int default 5)
returns table(id bigint, name text, type place_type, parent_name text)
language sql stable as $$
  with substring_matches as (
    select pl.id, pl.name, pl.type, parent.name as parent_name
    from places pl
    left join places parent on parent.id = pl.parent_id
    where immutable_unaccent(lower(pl.name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
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

create or replace function guess_languages(p_query text, p_limit int default 5)
returns table(id bigint, name text)
language sql stable as $$
  with substring_matches as (
    select id, name
    from languages
    where immutable_unaccent(lower(name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
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

create or replace function guess_religions(p_query text, p_limit int default 5)
returns table(id bigint, name text)
language sql stable as $$
  with name_matches as (
    select id, name
    from religions
    where immutable_unaccent(lower(name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
    order by name
    limit p_limit
  ),
  alias_matches as (
    select r.id, r.name
    from religions r
    where not exists (select 1 from name_matches)
      and exists (
        select 1 from unnest(r.aliases) a
        where immutable_unaccent(lower(a)) ilike immutable_unaccent(lower('%' || p_query || '%'))
      )
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

create or replace function search_places_for_partner(p_partner_slug text, p_query text)
returns table(id bigint, name text, type place_type, parent_name text)
language sql stable as $$
  with recursive partner as (
    select id, is_global, jurisdiction_regions_only
    from embed_partners
    where slug = p_partner_slug
  ),
  roots as (
    select ej.place_id
    from partner p
    join embed_partner_jurisdictions ej on ej.partner_id = p.id
  ),
  scoped as (
    select id from places where id in (select place_id from roots)
    union all
    select pl.id from places pl join scoped s on pl.parent_id = s.id
  )
  select pl.id, pl.name, pl.type, parent.name as parent_name
  from places pl
  left join places parent on parent.id = pl.parent_id
  where immutable_unaccent(lower(pl.name)) ilike immutable_unaccent(lower('%' || p_query || '%'))
    and (
      (select coalesce(is_global, false) from partner)
      or pl.id in (select id from scoped)
    )
    and (
      not (select coalesce(jurisdiction_regions_only, false) from partner)
      or pl.type <> 'city'
      or parent.type = 'country'
    )
  order by pl.name
  limit 10;
$$;

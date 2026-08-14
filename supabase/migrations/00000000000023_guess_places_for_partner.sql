-- Jurisdiction-scoped counterpart to guess_places(), for the embed flow.
-- Mirrors search_places_for_partner's scoping (jurisdiction tree, is_global,
-- jurisdiction_regions_only) but adds the same substring-then-fuzzy fallback
-- guess_places() uses, so a visitor who types a location without picking a
-- dropdown suggestion (or misspells it) still gets candidates instead of
-- the picker just silently re-rendering itself.
create or replace function guess_places_for_partner(
  p_partner_slug text,
  p_query text,
  p_limit int default 3
)
returns table (id bigint, name text, type place_type, parent_name text)
language sql
stable
as $$
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
  ),
  eligible as (
    select pl.id, pl.name, pl.type, parent.name as parent_name
    from places pl
    left join places parent on parent.id = pl.parent_id
    where (
      (select coalesce(is_global, false) from partner)
      or pl.id in (select id from scoped)
    )
    and (
      not (select coalesce(jurisdiction_regions_only, false) from partner)
      or pl.type <> 'city'
      or parent.type = 'country'
    )
  ),
  substring_matches as (
    select * from eligible
    where name ilike '%' || p_query || '%'
    order by name
    limit p_limit
  ),
  fuzzy_matches as (
    select * from eligible
    where not exists (select 1 from substring_matches)
      and lower(name) % lower(p_query)
    order by similarity(lower(name), lower(p_query)) desc, name
    limit p_limit
  )
  select * from substring_matches
  union all
  select * from fuzzy_matches;
$$;

grant execute on function guess_places_for_partner(text, text, int) to anon, authenticated;

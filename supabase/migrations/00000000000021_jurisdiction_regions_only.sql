-- Lets an admin restrict a country-level jurisdiction to region-level
-- results only (e.g. "United States" -> visitors can pick Michigan or
-- Florida, but not St. Louis or San Diego). Cities with no containing
-- region - assigned directly to the country, like Washington, D.C. - are
-- exempted and still show up, since they have no region-level equivalent
-- to fall back to.
alter table embed_partners
  add column jurisdiction_regions_only boolean not null default false;

create or replace function search_places_for_partner(p_partner_slug text, p_query text)
returns table (id bigint, name text, type place_type, parent_name text)
language sql
security invoker
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
  )
  select pl.id, pl.name, pl.type, parent.name as parent_name
  from places pl
  left join places parent on parent.id = pl.parent_id
  where pl.name ilike '%' || p_query || '%'
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

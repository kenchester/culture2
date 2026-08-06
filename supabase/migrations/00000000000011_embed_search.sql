-- Location picker for the embed page: only returns places inside the
-- partner's jurisdiction (the roots in embed_partner_jurisdictions, plus
-- everything nested under them via the places hierarchy), scoped by name.
create or replace function search_places_for_partner(p_partner_slug text, p_query text)
returns table (id bigint, name text, type place_type, parent_name text)
language sql
security invoker
stable
as $$
  with recursive roots as (
    select ej.place_id
    from embed_partners ep
    join embed_partner_jurisdictions ej on ej.partner_id = ep.id
    where ep.slug = p_partner_slug
  ),
  scoped as (
    select id from places where id in (select place_id from roots)
    union all
    select p.id from places p join scoped s on p.parent_id = s.id
  )
  select pl.id, pl.name, pl.type, parent.name as parent_name
  from places pl
  left join places parent on parent.id = pl.parent_id
  where pl.id in (select id from scoped)
    and pl.name ilike '%' || p_query || '%'
  order by pl.name
  limit 10;
$$;

grant execute on function search_places_for_partner(text, text) to anon, authenticated;

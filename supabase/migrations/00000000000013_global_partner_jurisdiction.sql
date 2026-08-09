-- Without at least one jurisdiction row, search_places_for_partner's
-- recursive CTE starts from an empty root set and returns nothing - not
-- "everywhere," but "nowhere." That's broken for a partner (e.g. a
-- country's state department, as opposed to a single embassy/consulate)
-- that wants to lock the origin but leave "where do you live now"
-- completely open. is_global makes that an explicit, intentional choice
-- instead of an accidental side effect of forgetting to add a jurisdiction.
alter table embed_partners add column is_global boolean not null default false;

create or replace function search_places_for_partner(p_partner_slug text, p_query text)
returns table (id bigint, name text, type place_type, parent_name text)
language sql
security invoker
stable
as $$
  with recursive partner as (
    select id, is_global from embed_partners where slug = p_partner_slug
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
  order by pl.name
  limit 10;
$$;

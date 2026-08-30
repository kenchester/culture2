-- A campus's parent may be a country, region, or (usually) a real city -
-- the same flexibility already given to cities themselves
-- (00000000000001_initial_schema.sql), since not every town in the places
-- data has a city-level entry either. Unlike a city, a campus's own parent
-- may also be a city - that's the whole point of the new tier.
create or replace function enforce_place_hierarchy() returns trigger as $$
declare
  parent_type place_type;
begin
  if new.type = 'country' then
    if new.parent_id is not null then
      raise exception 'a country cannot have a parent';
    end if;
    return new;
  end if;

  select type into parent_type from places where id = new.parent_id;
  if parent_type is null then
    raise exception 'non-country places must have a parent';
  end if;

  if new.type = 'region' and parent_type != 'country' then
    raise exception 'a region''s parent must be a country';
  end if;

  if new.type = 'city' and parent_type not in ('country', 'region') then
    raise exception 'a city''s parent must be a country or a region';
  end if;

  if new.type = 'campus' and parent_type not in ('country', 'region', 'city') then
    raise exception 'a campus''s parent must be a country, region, or city';
  end if;

  return new;
end;
$$ language plpgsql;

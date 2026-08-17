-- Widens a network's origin from exactly-one-of(language, place) to
-- exactly-one-of(language, place, religion). Column, constraint, and
-- unique index are one atomic change to the same origin model - splitting
-- them would leave the table in an invalid intermediate state.
alter table networks add column religion_id bigint references religions(id);

alter table networks drop constraint exactly_one_origin;
alter table networks add constraint exactly_one_origin check (
  (language_id is not null)::int + (origin_place_id is not null)::int + (religion_id is not null)::int = 1
);

-- Every existing row gets coalesce(religion_id, -1) = -1 uniformly, so this
-- introduces no new collisions among current data.
drop index networks_unique_triple;
create unique index networks_unique_triple on networks (
  coalesce(language_id, -1),
  coalesce(origin_place_id, -1),
  coalesce(religion_id, -1),
  location_place_id
);

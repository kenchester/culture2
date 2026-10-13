-- Where a city's people came from WITHIN the country.
--
-- The counterpart to city_origin_stats, which only counts the
-- foreign-born. A city page that answers "where did these people come
-- from" with immigration alone tells half the story, and for somewhere
-- like Detroit the domestic half is the more historically loaded one.
--
-- Granularity is census region, not state, because that is the ceiling of
-- what exists: ACS publishes place-of-birth for a city broken down as
-- Northeast / Midwest / South / West, and does not publish individual
-- states at city level at all. Storing a `kind` rather than pretending
-- these are states keeps the page honest about what it is showing.
--
-- No equivalent exists for most countries, so the section simply does not
-- render where there is nothing to render.

create table city_domestic_origins (
  id bigint generated always as identity primary key,
  city_place_id bigint not null references places(id) on delete cascade,
  -- same_state: born in the state the city is in.
  -- region: born in another state, grouped by census region.
  kind text not null check (kind in ('same_state', 'region')),
  label text not null,
  people int not null,
  source text not null,
  period text not null,
  created_at timestamptz not null default now()
);
create index city_domestic_origins_city_idx on city_domestic_origins (city_place_id);
create unique index city_domestic_origins_unique_idx
  on city_domestic_origins (city_place_id, label, period);

alter table city_domestic_origins enable row level security;
create policy "domestic origins are publicly readable" on city_domestic_origins
  for select using (true);

grant select on city_domestic_origins to anon, authenticated;
grant select, insert, update, delete on city_domestic_origins to service_role;
grant usage, select on sequence city_domestic_origins_id_seq to service_role;

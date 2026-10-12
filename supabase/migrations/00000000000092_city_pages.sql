-- Reference data for the city pages.
--
-- A city page answers three questions side by side: where this city's
-- people came from (official statistics), who the city has a formal
-- relationship with (its sister cities), and where a living community
-- actually exists on CultureMesh. The third we already hold; the first
-- two are outside data, loaded by script and attributed on the page.
--
-- Keeping them in separate tables with their own `source` is the whole
-- point. The credibility of the page rests on a reader being able to see
-- which number came from the Census Bureau, which came from a city hall,
-- and which came from us - a single blended figure would be worthless to
-- exactly the audience this is for.

-- Sister / twin / friendship city relationships.
create table city_sister_cities (
  id bigint generated always as identity primary key,
  city_place_id bigint not null references places(id) on delete cascade,
  -- The partner is stored by NAME first and linked to a places row only
  -- if one happens to match. Most sister cities are small towns that are
  -- not in this dataset, and place-name matching here has already drawn
  -- blood twice (the mojibake repair, then the lossy '?' names). A
  -- partner we can name but not link is still worth showing, so the page
  -- must never depend on the match.
  partner_name text not null,
  partner_country_iso text,
  partner_place_id bigint references places(id),
  since_year int,
  source text not null,
  source_url text,
  created_at timestamptz not null default now()
);
create index city_sister_cities_city_idx on city_sister_cities (city_place_id);
create unique index city_sister_cities_unique_idx
  on city_sister_cities (city_place_id, lower(partner_name));

-- Foreign-born residents by country of birth, for one city, from one
-- statistical release. `period` is the release label ("ACS 2019-2023"),
-- not a date, because that is how the figure must be cited.
create table city_origin_stats (
  id bigint generated always as identity primary key,
  city_place_id bigint not null references places(id) on delete cascade,
  origin_country_iso text not null,
  origin_label text not null,
  people int not null,
  -- Null on a country row; set when the source only reports a region.
  is_total boolean not null default false,
  source text not null,
  period text not null,
  created_at timestamptz not null default now()
);
create index city_origin_stats_city_idx on city_origin_stats (city_place_id);
create unique index city_origin_stats_unique_idx
  on city_origin_stats (city_place_id, origin_country_iso, period);

alter table city_sister_cities enable row level security;
alter table city_origin_stats enable row level security;

-- Both are public reference data: a city page is meant to be forwarded to
-- someone in a city hall who has never signed in.
create policy "sister cities are publicly readable" on city_sister_cities
  for select using (true);
create policy "origin statistics are publicly readable" on city_origin_stats
  for select using (true);

grant select on city_sister_cities, city_origin_stats to anon, authenticated;
grant select, insert, update, delete on city_sister_cities to service_role;
grant select, insert, update, delete on city_origin_stats to service_role;
grant usage, select on sequence city_sister_cities_id_seq to service_role;
grant usage, select on sequence city_origin_stats_id_seq to service_role;

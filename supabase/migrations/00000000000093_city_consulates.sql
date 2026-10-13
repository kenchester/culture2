-- Official consular presence in a city.
--
-- The third civic layer on a city page, and the most informative one.
-- Sister cities are chosen by a city for reasons of its own; consulates
-- are placed by foreign governments, and governments put them where their
-- nationals actually are. So the two measure very different things, and
-- showing them beside the census is what turns the page from a list into
-- an argument.
--
-- It also sits directly against the Unofficial Consul work: this is who
-- IS officially represented here, next to the communities that have no
-- representation at all and have to elect their own.

create table city_consulates (
  id bigint generated always as identity primary key,
  city_place_id bigint not null references places(id) on delete cascade,
  country_iso text not null,
  country_name text not null,
  -- Consulate-General, Honorary Consulate, Trade Office, and so on. Kept
  -- verbatim from the source rather than normalised: the distinction
  -- between a career consulate-general and an honorary consul run out of
  -- a lawyer's office is exactly the kind of thing a reader wants to see.
  mission_type text,
  source text not null,
  source_url text,
  created_at timestamptz not null default now()
);
create index city_consulates_city_idx on city_consulates (city_place_id);
create unique index city_consulates_unique_idx
  on city_consulates (city_place_id, country_iso);

alter table city_consulates enable row level security;
create policy "consulates are publicly readable" on city_consulates
  for select using (true);

grant select on city_consulates to anon, authenticated;
grant select, insert, update, delete on city_consulates to service_role;
grant usage, select on sequence city_consulates_id_seq to service_role;

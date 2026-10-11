-- Digital outposts: a geography represented somewhere it has no building.
--
-- A consulate represents a PLACE to another PLACE. It does not represent a
-- language - a Spanish consulate serves Spain, not Spanish speakers - so a
-- principal here is geographic. (language_id exists only because the
-- theoretical case was raised, and a null column is cheaper than a later
-- migration; nothing uses it yet.)
--
-- The pairing is the same shape the networks table already uses: an origin
-- place and a location place. Which means the 33 place-origin networks on
-- this site are already consular districts in everything but name - "people
-- from X living in Y" is the population a consulate in Y for X exists to
-- serve. An outpost therefore has a natural network without anyone
-- assembling one.
--
-- Entirely additive. Nothing existing reads or writes these tables, so no
-- current behaviour changes.

-- Who is being represented. Deliberately not a foreign-keyed "country_id":
-- 8 of the origin places already in use are CITIES and 5 are regions, and
-- the model should hold an indigenous nation or a city hall as readily as
-- a state.
create table principals (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('country', 'region', 'city', 'people', 'institution')),
  name text not null,
  place_id bigint references places(id),
  language_id bigint references languages(id),
  website text,
  -- Set when we have checked this principal is who it claims to be. Null
  -- means "listed", not "endorsed" - the directory is largely seeded from
  -- geography, so most rows will never be verified and must not imply it.
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint principal_has_a_subject check (place_id is not null or language_id is not null)
);
create unique index principals_place_idx on principals (place_id) where place_id is not null;

-- The outpost itself: a principal present in a host place.
create table outposts (
  id bigint generated always as identity primary key,
  principal_id bigint not null references principals(id) on delete cascade,
  host_place_id bigint not null references places(id),
  kind text not null default 'virtual'
    check (kind in ('consulate', 'honorary', 'trade_office', 'cultural', 'virtual')),
  -- listed      : we put it in the directory; nobody has claimed it
  -- claimed     : someone says it is theirs, not yet checked
  -- accredited  : verified, and allowed to speak as the principal
  -- historical  : existed once and does not now (the Xiamen case)
  status text not null default 'listed'
    check (status in ('listed', 'claimed', 'accredited', 'historical')),
  website text,
  -- Free text for a closed mission: the building, the year, what happened.
  heritage_note text,
  opened_year int,
  closed_year int,
  created_at timestamptz not null default now(),
  unique (principal_id, host_place_id, kind)
);
create index outposts_host_idx on outposts (host_place_id);
create index outposts_principal_idx on outposts (principal_id);

-- The people appointed to an outpost - an honorary consul, most of the
-- time. This is the institution worth reviving: it already exists in law,
-- costs a government almost nothing, and is usually invisible because the
-- appointee has no reach. An appointment here gives them one.
--
-- An appointment is a row, not a flag, so history is kept: revoked_at is
-- set rather than the row deleted, and who appointed whom survives.
create table outpost_officers (
  id bigint generated always as identity primary key,
  outpost_id bigint not null references outposts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'honorary_consul'
    check (role in ('honorary_consul', 'consul', 'duty_officer', 'liaison')),
  title text,
  appointed_at timestamptz not null default now(),
  appointed_by uuid references profiles(id),
  revoked_at timestamptz,
  revocation_reason text
);
create index outpost_officers_outpost_idx on outpost_officers (outpost_id);
-- One live appointment per person per outpost; revoked ones may repeat.
create unique index outpost_officers_live_idx
  on outpost_officers (outpost_id, user_id) where revoked_at is null;

alter table principals enable row level security;
alter table outposts enable row level security;
alter table outpost_officers enable row level security;

-- A directory is only useful if it is public. Reading is open to everyone;
-- writing is service-role only for now, which keeps accreditation - the
-- part that carries authority - behind the admin surface rather than
-- anything a signed-in user can reach.
create policy "principals are publicly readable" on principals for select using (true);
create policy "outposts are publicly readable" on outposts for select using (true);
-- Revoked appointments stay in the table for the record but leave the
-- directory, so a former consul is not still listed as one.
create policy "current officers are publicly readable" on outpost_officers
  for select using (revoked_at is null);

-- This project has no default role grants (see 00000000000027) - every
-- table needs its permitted operations granted explicitly per role.
grant select on principals, outposts to anon, authenticated;
grant select on outpost_officers to anon, authenticated;
grant select, insert, update, delete on principals to service_role;
grant select, insert, update, delete on outposts to service_role;
grant select, insert, update, delete on outpost_officers to service_role;
grant usage, select on sequence principals_id_seq to service_role;
grant usage, select on sequence outposts_id_seq to service_role;
grant usage, select on sequence outpost_officers_id_seq to service_role;

create type place_type as enum ('country', 'region', 'city');

create table places (
  id bigint generated always as identity primary key,
  parent_id bigint references places(id),
  type place_type not null,
  name text not null,
  lat double precision,
  lng double precision
);
create index places_parent_idx on places (parent_id);
create index places_type_idx on places (type);

-- A trigger, not a CHECK constraint, because validating parent type requires
-- looking at another row: countries have no parent; regions' parent must be
-- a country; cities' parent must be a country or a region.
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

  return new;
end;
$$ language plpgsql;

create trigger places_hierarchy_check
  before insert or update on places
  for each row execute function enforce_place_hierarchy();

create table languages (
  id bigint generated always as identity primary key,
  name text not null unique
);

-- Users (auth.users is managed by Supabase Auth; this is the public profile)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  first_name text,
  last_name text,
  about_me text,
  img_path text, -- Supabase Storage object path, not a filesystem path
  created_at timestamptz not null default now()
);

-- Networks: origin is EITHER a language OR a place at any tier (never both);
-- location is ALWAYS a place at any tier, and is never a language.
create table networks (
  id bigint generated always as identity primary key,
  language_id bigint references languages(id),
  origin_place_id bigint references places(id),
  location_place_id bigint not null references places(id),
  title text not null,
  member_count int not null default 0,
  post_count int not null default 0,
  launched_at timestamptz not null default now(),
  launched_by uuid references profiles(id),
  constraint exactly_one_origin check (
    (language_id is not null and origin_place_id is null) or
    (language_id is null and origin_place_id is not null)
  )
);
create unique index networks_unique_triple on networks (
  coalesce(language_id, -1),
  coalesce(origin_place_id, -1),
  location_place_id
);

create table network_members (
  network_id bigint not null references networks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (network_id, user_id)
);

create table posts (
  id bigint generated always as identity primary key,
  network_id bigint not null references networks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  img_path text,
  video_url text,
  created_at timestamptz not null default now()
);

create table post_replies (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table events (
  id bigint generated always as identity primary key,
  network_id bigint not null references networks(id) on delete cascade,
  host_id uuid not null references profiles(id),
  title text not null,
  description text,
  event_date timestamptz not null,
  location text,
  created_at timestamptz not null default now()
);

create table event_rsvps (
  event_id bigint not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'going' check (status in ('going','interested','declined')),
  primary key (event_id, user_id)
);

-- Private messaging
create table conversations (
  id bigint generated always as identity primary key,
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ordered_pair check (user_a < user_b),
  unique (user_a, user_b)
);

create table messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at);

-- Notification preferences
create table notification_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  events_upcoming boolean not null default true,
  events_interested_in boolean not null default true,
  network_activity boolean not null default true,
  product_updates boolean not null default true
);

-- Suggested networks (user submits, staff reviews)
create table suggested_networks (
  id bigint generated always as identity primary key,
  suggested_by uuid references profiles(id),
  origin_text text not null,
  location_text text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- Embassy/partner white-label embeds
create table embed_partners (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  locked_language_id bigint references languages(id),
  locked_origin_place_id bigint references places(id),
  hide_origin_label boolean not null default true,
  created_at timestamptz not null default now(),
  constraint at_most_one_locked_origin check (
    locked_language_id is null or locked_origin_place_id is null
  )
);

-- A partner's jurisdiction can be more than one root (an embassy may also
-- cover a nearby smaller country's diaspora within the same location UI).
-- Each row is a root; the recursive descendants of each root are in-scope.
create table embed_partner_jurisdictions (
  partner_id bigint not null references embed_partners(id) on delete cascade,
  place_id bigint not null references places(id),
  primary key (partner_id, place_id)
);

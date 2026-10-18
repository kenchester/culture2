-- Two things a corridor can do that a feed cannot.
--
-- Both work at two people rather than twenty, which is the whole reason
-- they are here: a corridor has ends, and a match needs one person at
-- each. A feed needs a crowd.

-- Are you in one of the communities on this route?
--
-- The gate for everything below. security definer because it has to read
-- network_members on the caller's behalf regardless of that table's own
-- policies - it answers only "is the CALLER a member", never who else is,
-- so passing an arbitrary pair discloses nothing.
create or replace function is_corridor_member(p_a bigint, p_b bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from networks n
      join network_members m on m.network_id = n.id
     where m.user_id = auth.uid()
       and (
         (n.origin_place_id = p_a and n.location_place_id = p_b)
         or (n.origin_place_id = p_b and n.location_place_id = p_a)
       )
  );
$$;

grant execute on function is_corridor_member(bigint, bigint) to authenticated;

-- Somebody is travelling this route.
--
-- Deliberately NOT a marketplace. There is no price, no item list, no
-- anonymous matching and no payment: carrying things across borders is
-- how people get used as mules, and the liability lands on the carrier.
-- What this does is make visible, inside a community that already knows
-- each other, something diasporas have always done informally - the
-- person flying home carries the medicine.
--
-- Visible only to members of a community on the same route, for the same
-- reason: the trust is the mechanism, not a feature on top of it.
create table trips (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  from_place_id bigint not null references places(id),
  to_place_id bigint not null references places(id),
  travel_date date not null,
  -- carry  : willing to take something small
  -- meet   : happy to meet people at the other end
  -- advice : has done this route and will answer questions
  offering text not null check (offering in ('carry', 'meet', 'advice')),
  note text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint trips_distinct_places check (from_place_id <> to_place_id)
);
create index trips_route_idx on trips (from_place_id, to_place_id, travel_date);
create index trips_user_idx on trips (user_id);

alter table trips enable row level security;

create policy "corridor members can see trips on their route" on trips
  for select using (
    cancelled_at is null
    and travel_date >= current_date
    and is_corridor_member(from_place_id, to_place_id)
  );

create policy "corridor members can post their own trips" on trips
  for insert with check (
    user_id = auth.uid()
    and is_corridor_member(from_place_id, to_place_id)
    and travel_date >= current_date
  );

-- Cancelling only. A trip is never edited into a different trip, because
-- somebody may already have arranged around the one that was posted.
create policy "people can cancel their own trips" on trips
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A fixed set of questions, asked of every corridor.
--
-- Keyed rather than stored as text so the wording stays translatable -
-- these are interface copy that happens to live in a table, not data.
create table corridor_questions (
  id bigint generated always as identity primary key,
  key text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

-- One paragraph, from one person, about one direction of one route.
--
-- Directional on purpose: what an arrival needs to know depends entirely
-- on which way they are going. The corridor page shows both.
--
-- Publicly readable, which is the point - this is the content that makes
-- a corridor page worth landing on before anybody has joined. Writing one
-- requires being in the community, so answering is a reason to join
-- rather than a thing that happens instead of joining.
create table corridor_answers (
  id bigint generated always as identity primary key,
  question_id bigint not null references corridor_questions(id) on delete cascade,
  from_place_id bigint not null references places(id),
  to_place_id bigint not null references places(id),
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  hidden_at timestamptz,
  constraint corridor_answers_distinct_places check (from_place_id <> to_place_id)
);
create index corridor_answers_route_idx
  on corridor_answers (from_place_id, to_place_id, question_id);
-- One answer per person per question per direction; they edit it rather
-- than stacking replies.
create unique index corridor_answers_one_each_idx
  on corridor_answers (question_id, from_place_id, to_place_id, user_id)
  where hidden_at is null;

alter table corridor_questions enable row level security;
alter table corridor_answers enable row level security;

create policy "questions are publicly readable" on corridor_questions
  for select using (active);

create policy "answers are publicly readable" on corridor_answers
  for select using (hidden_at is null);

create policy "corridor members can answer" on corridor_answers
  for insert with check (
    user_id = auth.uid()
    and is_corridor_member(from_place_id, to_place_id)
  );

create policy "people can edit their own answer" on corridor_answers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on corridor_questions to anon, authenticated;
grant select on corridor_answers to anon, authenticated;
grant select, insert, update on trips to authenticated;
grant insert, update on corridor_answers to authenticated;
grant usage, select on sequence trips_id_seq to authenticated;
grant usage, select on sequence corridor_answers_id_seq to authenticated;

grant select, insert, update, delete on trips to service_role;
grant select, insert, update, delete on corridor_questions to service_role;
grant select, insert, update, delete on corridor_answers to service_role;
grant usage, select on sequence trips_id_seq to service_role;
grant usage, select on sequence corridor_questions_id_seq to service_role;
grant usage, select on sequence corridor_answers_id_seq to service_role;

-- The First 90 Days, asked one question at a time. Concrete enough that
-- somebody can answer in a paragraph without preparing.
insert into corridor_questions (key, sort_order) values
  ('firstWeek', 10),
  ('gather', 20),
  ('food', 30),
  ('money', 40),
  ('mistake', 50);

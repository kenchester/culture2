-- A tap instead of a paragraph.
--
-- community_notes (00000000000099) and corridor_answers (00000000000096)
-- both asked a real question and got a real answer - of zero people. Not
-- for lack of traffic: the busiest reference pages get 14-28 views a
-- month. A textarea in front of a stranger is a real cost even when the
-- stranger agrees with every word on the page, and most visitors to a
-- city or language page are not wrong about the figures, they are
-- confirming them silently and leaving no trace of having done so.
--
-- This is the same inverted-ask as community_notes - "does this look
-- right?" rather than "contribute something" - reduced to the smallest
-- possible action: one tap, no typing, no topic to choose. Still gated
-- on an account (so the aggregate means something; see is_accurate's own
-- unique-per-person constraint below), never on network membership - the
-- person best placed to confirm Houston's Honduran figure may belong to
-- nothing here yet, same reasoning as the note it sits beside.
create table stat_reactions (
  id bigint generated always as identity primary key,
  -- Exactly one subject, same shape and same reasoning as
  -- community_notes: a place, a corridor (both ends), or a language.
  place_a bigint references places(id) on delete cascade,
  place_b bigint references places(id) on delete cascade,
  language_id bigint references languages(id) on delete cascade,
  -- Matches community_notes' own topic domain, deliberately - a tap and
  -- a written note are two different amounts of friction for responding
  -- to the SAME claim, not two different vocabularies for it.
  topic text not null check (
    topic in ('population', 'consulate', 'distance', 'twinning', 'speakers', 'endangerment', 'general')
  ),
  is_accurate boolean not null,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint stat_reactions_ordered check (place_b is null or place_a < place_b),
  constraint stat_reactions_subject check (
    (place_a is not null and language_id is null)
    or (place_a is null and place_b is null and language_id is not null)
  )
);

-- One reaction per person per claim. A second tap on the same stat
-- UPDATES this row (flips is_accurate, stamps updated_at) rather than
-- stacking a second one - a person confirming the same figure twice is
-- one opinion, not two, and an upsert is what lets the UI be a toggle
-- rather than a one-shot button.
create unique index stat_reactions_one_each_idx on stat_reactions (
  coalesce(place_a, -1), coalesce(place_b, -1), coalesce(language_id, -1), topic, user_id
);

alter table stat_reactions enable row level security;

-- Public to read: the aggregate ("12 of 14 people say this looks right")
-- is itself the social proof this exists to create, and it has to be
-- visible to a reader who never signs in for that to work.
create policy "reactions are publicly readable" on stat_reactions
  for select using (true);

create policy "signed-in people can react" on stat_reactions
  for insert with check (user_id = auth.uid());

create policy "people can change their own reaction" on stat_reactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on stat_reactions to anon, authenticated;
grant insert, update on stat_reactions to authenticated;
grant usage, select on sequence stat_reactions_id_seq to authenticated;
grant select, insert, update, delete on stat_reactions to service_role;
grant usage, select on sequence stat_reactions_id_seq to service_role;

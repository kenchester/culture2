-- Let people correct the page rather than fill it.
--
-- Every ask on this site so far has been "contribute something", and an
-- empty page invites nothing: it is a chore with no social proof. But
-- people will argue with a wrong statement about their own community
-- immediately. Blank pages do not recruit editors; wrong ones do.
--
-- Notes rather than an editable wiki, deliberately. The sourced figures
-- stay sourced - a census number with a citation is the reason these
-- pages are credible, and letting it be overwritten would trade that away
-- for nothing. A note sits BESIDE the fact it disputes, attributed, so a
-- reader sees both the official figure and the person saying it
-- undercounts. There is also nothing to vandalise and no revert war,
-- because nothing is being replaced.
--
-- Writing one needs an account but NOT membership of any network, unlike
-- corridor answers. The person best placed to correct Houston's Honduran
-- figure may belong to nothing here yet, and gating the correction behind
-- joining would block exactly the contribution worth having. The
-- correction is the signup.

create table community_notes (
  id bigint generated always as identity primary key,
  -- A city note has place_b null; a corridor note names both ends, in
  -- canonical order so one route cannot accumulate two sets of notes.
  place_a bigint not null references places(id) on delete cascade,
  place_b bigint references places(id) on delete cascade,
  -- Which fact is being disputed or added to. 'general' is for anything
  -- the page does not already state.
  topic text not null check (
    topic in ('population', 'consulate', 'distance', 'twinning', 'general')
  ),
  body text not null check (length(trim(body)) between 1 and 2000),
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  hidden_at timestamptz,
  constraint community_notes_ordered check (place_b is null or place_a < place_b)
);
create index community_notes_subject_idx on community_notes (place_a, place_b);

alter table community_notes enable row level security;

-- Public to read: the notes are the content, and a reader who will never
-- sign in should still see what the community said about the figures.
create policy "notes are publicly readable" on community_notes
  for select using (hidden_at is null);

create policy "signed-in people can add a note" on community_notes
  for insert with check (user_id = auth.uid());

create policy "people can edit their own note" on community_notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on community_notes to anon, authenticated;
grant insert, update on community_notes to authenticated;
grant usage, select on sequence community_notes_id_seq to authenticated;
grant select, insert, update, delete on community_notes to service_role;
grant usage, select on sequence community_notes_id_seq to service_role;

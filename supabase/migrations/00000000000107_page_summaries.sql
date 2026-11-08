-- A cache for the one paragraph that ties a page's disjoint sections
-- together.
--
-- A city page states its foreign-born total, its domestic migration, its
-- sister cities and its consulates as four separate blocks, each sourced
-- separately and correctly - and a first-time visitor has to assemble
-- those themselves into "why does this page matter". A language page has
-- the same shape: status, coverage, speaker figures, in that order, with
-- nothing connecting them into one read.
--
-- Cached rather than generated per request, for the obvious reason
-- (latency, cost) and a less obvious one: the underlying data changes
-- rarely (a census load, a Glottolog refresh) but is read 14-28 times a
-- month on the busiest pages, so regenerating on every view would spend
-- a model call on almost every single visit to produce the identical
-- paragraph. input_hash is what makes the cache self-invalidating - the
-- next request after a data refresh sees a hash mismatch and regenerates
-- once, the same staleness check scripts/translate-messages.ts already
-- uses for message catalogues.
--
-- One row per subject, not per topic - this summarises the whole page,
-- unlike stat_reactions and community_notes which are about one claim at
-- a time.
create table page_summaries (
  id bigint generated always as identity primary key,
  place_a bigint references places(id) on delete cascade,
  place_b bigint references places(id) on delete cascade,
  language_id bigint references languages(id) on delete cascade,
  -- A hash of the structured facts the summary was built from, not of
  -- the summary itself - this is what lets a request detect "the data
  -- moved since this was written" without diffing the prose.
  input_hash text not null,
  summary_text text not null,
  model text not null,
  generated_at timestamptz not null default now(),
  constraint page_summaries_ordered check (place_b is null or place_a < place_b),
  constraint page_summaries_subject check (
    (place_a is not null and language_id is null)
    or (place_a is null and place_b is null and language_id is not null)
  )
);

-- One summary per subject, period - a fresh generation REPLACES the row
-- (see lib/page-summary.ts), it never accumulates history.
create unique index page_summaries_subject_idx on page_summaries (
  coalesce(place_a, -1), coalesce(place_b, -1), coalesce(language_id, -1)
);

alter table page_summaries enable row level security;

-- Public to read, same as every other reference table here - a page
-- summary is meant to be read by someone who has never signed in.
create policy "summaries are publicly readable" on page_summaries
  for select using (true);

grant select on page_summaries to anon, authenticated;
-- No insert/update/delete grant for authenticated or anon: generation
-- happens server-side only, from within the page render itself
-- (lib/page-summary.ts uses the admin client), never from a form a
-- visitor could submit arbitrary text through. This is the one piece of
-- content on the site that is never user-authored, so it is the one
-- table here with no user-facing write path at all.
grant select, insert, update, delete on page_summaries to service_role;
grant usage, select on sequence page_summaries_id_seq to service_role;

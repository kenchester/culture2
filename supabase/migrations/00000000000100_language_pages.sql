-- Make the language a subject, not a dropdown value.
--
-- A language has been a foreign key since the first migration: a network
-- is EITHER a language or a place plus a location, so "Cantonese speakers
-- in Miami" has always been expressible. What has never existed is a page
-- about Cantonese. For an ordinary diaspora network that absence is fine,
-- because the place pages carry the context. For a language that is
-- losing speakers it is the whole thing - the people doing this work are
-- organised around the language itself, scattered across places, and what
-- they need to see is how many are left and where.
--
-- Three additions, each with a different source and kept separate for the
-- same reason city_pages keeps its three apart: a reader has to be able
-- to see which number came from Glottolog, which from the Census Bureau,
-- and which from us.

-- 1. Identity and endangerment, from Glottolog.
--
-- languages.name has been free text ("Taiwanese/Hokkien/Min Nan",
-- "Shanghainese/Wu") and iso_code holds ISO 639-1 where one exists, which
-- is only the ~180 biggest languages - by construction it is null for
-- every language this feature is about. Glottocode and ISO 639-3 identify
-- the other 7,500, and the glottocode is also the citation link.
alter table languages add column glottocode text;
alter table languages add column iso639_3 text;

-- Glottolog's own primary name, kept when it differs from ours.
--
-- It differs constantly, and in a way a reader needs to see rather than
-- have smoothed over: we call it Cantonese, Glottolog calls it Yue
-- Chinese; we call it Greek, they call it Modern Greek. Showing both is
-- what lets somebody check the status against the source, and silently
-- renaming a community's language to a linguist's preferred term is its
-- own small insult.
alter table languages add column glottolog_name text;

-- Glottolog's Agglomerated Endangerment Status, which is itself a
-- consolidation of EGIDS, UNESCO's Atlas and ElCat. Stored with
-- Glottolog's own vocabulary rather than UNESCO's prettier wording
-- ("moribund" not "severely endangered") so the value can be checked
-- against the source without a translation table in between; the page
-- shows the UNESCO equivalent alongside.
alter table languages add column endangerment text check (
  endangerment in (
    'not_endangered', 'threatened', 'shifting', 'moribund', 'nearly_extinct', 'extinct'
  )
);
-- The release, not a date: this is how the figure has to be cited.
alter table languages add column endangerment_source text;

-- Whether this row is one language or several.
--
-- About a quarter of them are several. "Quechua" covers varieties running
-- from not endangered to extinct; "Zapotec" is some sixty languages;
-- "Arabic" as anybody actually speaks it is a dozen. Glottolog has no
-- single status for these, and inventing one by picking a representative
-- variety would put a confident label on the page exactly where the truth
-- is "it depends which one, and that distinction is the whole subject".
--
-- So 'group' means deliberately no status, and the page says why. This is
-- the same discipline as is_exact on language_census_labels below: where
-- the data stops, say so rather than estimating past it.
alter table languages add column coverage text check (coverage in ('single', 'group'));

create index languages_endangerment_idx on languages (endangerment);
-- Made non-unique by 00000000000101: two of our rows can legitimately
-- cite the same languoid, because Glottolog treats Teochew and
-- Wenzhounese as varieties of languages we list separately.
create unique index languages_glottocode_idx on languages (glottocode)
  where glottocode is not null;

-- 2. Speakers at home, from the American Community Survey.
--
-- Stored under the census's OWN category label, verbatim, rather than
-- resolved to a languages row - because the category frequently is not
-- one language. B16001 has 42 of them for the whole world, and the
-- coarseness is not uniform: Vietnamese and Korean get a row each, while
-- every indigenous language of North America except Navajo is counted as
-- "Other Native languages of North America", and Cantonese, Hakka and
-- Hokkien are all inside "Chinese (incl. Mandarin, Cantonese)".
--
-- Mapping those onto one language each would invent precision the source
-- does not have, and it would do so in exactly the direction that hurts:
-- the languages with the least data are the ones this page exists for.
-- So the label is kept as written and the page says what the label
-- actually covers.
create table city_language_stats (
  id bigint generated always as identity primary key,
  city_place_id bigint not null references places(id) on delete cascade,
  census_label text not null,
  speakers int not null,
  -- "Speak English less than 'very well'", the census's own phrase. This
  -- is the number a school district or a court interpreter office acts
  -- on, and it is the half of the table that is about service rather
  -- than about heritage.
  limited_english int,
  source text not null,
  period text not null,
  created_at timestamptz not null default now()
);
create index city_language_stats_city_idx on city_language_stats (city_place_id);
create index city_language_stats_label_idx on city_language_stats (census_label);
create unique index city_language_stats_unique_idx
  on city_language_stats (city_place_id, census_label, period);

-- Which census category, if any, counts a given language - and whether it
-- counts anything else as well.
--
-- is_exact is the honest part of this whole feature. When true, the
-- category is this language and nothing else, so the figure is the
-- language's figure. When false, the language is one of several inside
-- the category, and the only truthful statement is the category total
-- plus "how many of these speak Hakka is not recorded". The page renders
-- those two cases differently, and the second one is where a community
-- note is worth more than the statistic.
create table language_census_labels (
  language_id bigint not null references languages(id) on delete cascade,
  census_label text not null,
  is_exact boolean not null,
  primary key (language_id, census_label)
);
create index language_census_labels_label_idx on language_census_labels (census_label);

-- 3. What to record, from us.
--
-- Keyed rather than stored as prose, matching corridor_questions
-- (00000000000096): these are interface copy that happens to live in a
-- table, so they stay translatable.
--
-- The point is to replace "record something" with something a person can
-- finish in one sitting. A speaker asked to document their language does
-- nothing, because the task has no edge; a speaker asked how their
-- grandmother said goodbye answers in forty seconds. Ten of those is a
-- corpus.
create table language_prompts (
  id bigint generated always as identity primary key,
  key text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

alter table language_prompts enable row level security;
create policy "prompts are publicly readable" on language_prompts
  for select using (active);
grant select on language_prompts to anon, authenticated;
grant select, insert, update, delete on language_prompts to service_role;
grant usage, select on sequence language_prompts_id_seq to service_role;

-- A post can answer a prompt. Nullable and ON DELETE SET NULL, because
-- the recording is the valuable thing and must outlive any editing of
-- the prompt list - retiring a prompt must never delete what it drew out.
alter table posts add column language_prompt_id bigint
  references language_prompts(id) on delete set null;
create index posts_language_prompt_idx on posts (language_prompt_id)
  where language_prompt_id is not null;
-- No new grant: 00000000000004 grants INSERT and UPDATE on posts to
-- authenticated at table level rather than per column, so a new column is
-- already covered. Who may post is unchanged - posts' existing policies
-- still require network membership.

-- Notes about a language, not only about a place.
--
-- community_notes (00000000000099) is keyed on places because every page
-- that had figures to dispute was a place page. A language page has the
-- most disputable figure on the site - a census category that openly
-- declines to count the language - so the correction mechanism has to
-- reach it. Same table rather than a second one: it is the same act, and
-- a reader looking for what people said should not have to know which
-- kind of subject they are looking at.
alter table community_notes alter column place_a drop not null;
alter table community_notes add column language_id bigint
  references languages(id) on delete cascade;

-- Exactly one subject. A language note has no ends, so place_b must be
-- null too; without that clause a row could name a language and half a
-- corridor and the ordering check above would happily allow it.
alter table community_notes add constraint community_notes_subject check (
  (place_a is not null and language_id is null)
  or (place_a is null and place_b is null and language_id is not null)
);
create index community_notes_language_idx on community_notes (language_id)
  where language_id is not null;

-- 'speakers' for the count, 'endangerment' for the status.
--
-- The check being replaced was written inline in 00000000000099, so its
-- name was generated by Postgres rather than chosen. The convention makes
-- it community_notes_topic_check, but a migration that hard-codes a
-- guessed identifier either fails outright or - worse, with DROP IF
-- EXISTS - silently leaves the old constraint in place and rejects every
-- 'speakers' note for reasons no error message would explain. So it is
-- looked up instead.
do $$
declare
  existing text;
begin
  select con.conname into existing
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'community_notes'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%topic%';
  if existing is null then
    raise exception 'no topic check constraint found on community_notes';
  end if;
  execute format('alter table community_notes drop constraint %I', existing);
end $$;
alter table community_notes add constraint community_notes_topic_check check (
  topic in (
    'population', 'consulate', 'distance', 'twinning', 'speakers',
    'endangerment', 'general'
  )
);

-- The ask, one thing at a time. Ordered so the easiest come first: a
-- greeting needs no preparation, a story needs twenty minutes and a
-- decision about which one.
insert into language_prompts (key, sort_order) values
  ('greeting', 10),
  ('counting', 20),
  ('family', 30),
  ('goodbye', 40),
  ('food', 50),
  ('weather', 60),
  ('placeName', 70),
  ('proverb', 80),
  ('lullaby', 90),
  ('story', 100);

grant select, insert, update, delete on city_language_stats to service_role;
grant usage, select on sequence city_language_stats_id_seq to service_role;
grant select, insert, update, delete on language_census_labels to service_role;
-- No grant needed on languages itself: 00000000000040 already gives
-- service_role select and update there, which is what the loader uses.
-- Writes by `authenticated` stay gated to admins by the RLS policy from
-- 00000000000018, so the new columns are admin-editable and nothing else.

alter table city_language_stats enable row level security;
alter table language_census_labels enable row level security;

-- Public reference data, like city_origin_stats: a language page is meant
-- to be forwarded to someone who has never signed in.
create policy "language statistics are publicly readable" on city_language_stats
  for select using (true);
create policy "census label mappings are publicly readable" on language_census_labels
  for select using (true);

grant select on city_language_stats, language_census_labels to anon, authenticated;

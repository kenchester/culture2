-- Language figures are not only about cities.
--
-- 00000000000100 called this table city_language_stats and keyed it on
-- city_place_id, because every other statistical table here is about a
-- city. Loading it revealed that assumption is wrong for this particular
-- census table, in a way that matters most to the languages this feature
-- exists for.
--
-- ACS table B16001 - the one with 42 named language categories - is
-- published for only about fourteen US cities. Everywhere else the
-- Bureau publishes C16001 instead, which collapses the world into
-- thirteen buckets ("Asian and Pacific Island languages"), useless for a
-- page about one language. But B16001 IS published for every state.
--
-- And for the languages that need these pages, the state is the better
-- geography anyway. Cherokee speakers are not a Charlotte phenomenon,
-- they are an Oklahoma and North Carolina one; Navajo belongs to Arizona
-- and New Mexico, not to Phoenix. Indexing this on cities would have
-- produced empty pages for exactly the languages whose pages are the
-- point.
--
-- So the table holds any place, and the column says so. Renamed rather
-- than widened with a second nullable column: one subject per row, named
-- correctly, with no pair of columns that have to be kept consistent.
alter table city_language_stats rename to place_language_stats;
alter table place_language_stats rename column city_place_id to place_id;

-- Index and constraint names do not follow a rename, and a misleading
-- name on a unique index is how the next person loads duplicate rows.
alter index city_language_stats_city_idx rename to place_language_stats_place_idx;
alter index city_language_stats_label_idx rename to place_language_stats_label_idx;
alter index city_language_stats_unique_idx rename to place_language_stats_unique_idx;
alter index city_language_stats_pkey rename to place_language_stats_pkey;
alter sequence city_language_stats_id_seq rename to place_language_stats_id_seq;

-- Policies carry over with the table, but the policy NAME still says
-- city. Dropped and recreated rather than left to confuse.
drop policy "language statistics are publicly readable" on place_language_stats;
create policy "language statistics are publicly readable" on place_language_stats
  for select using (true);

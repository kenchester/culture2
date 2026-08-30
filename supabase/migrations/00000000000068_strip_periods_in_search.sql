-- Typing "US Virgin Islands" (no periods) previously failed to find "U.S.
-- Virgin Islands" - immutable_unaccent is already the one shared
-- normalization primitive every search/guess RPC in this codebase filters
-- through (search_places, search_languages, guess_places, guess_languages,
-- guess_religions, search_places_for_partner - see
-- 00000000000041_unaccent_search.sql), so folding period-stripping in here
-- makes every one of those match with or without periods, with no changes
-- needed to any of them individually.
create or replace function immutable_unaccent(text) returns text as $$
  select public.unaccent('public.unaccent'::regdictionary, replace($1, '.', ''));
$$ language sql immutable parallel safe set search_path = public;

-- The three trigram indexes built on immutable_unaccent(lower(name))
-- stored trigrams computed under the old (period-preserving) behavior -
-- changing the function body doesn't retroactively recompute already-
-- indexed values, so a stale index could silently prune real matches
-- (e.g. "U.S. Virgin Islands") before the query ever rechecks them.
reindex index places_name_unaccent_trgm_idx;
reindex index languages_name_unaccent_trgm_idx;
reindex index religions_name_unaccent_trgm_idx;

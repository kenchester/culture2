-- A glottocode is a reference, not an identity.
--
-- 00000000000100 made languages.glottocode unique, which assumed our rows
-- map one-to-one onto Glottolog languoids. They do not, and the places
-- they do not are deliberate.
--
-- Glottolog classifies Teochew as a variety of Min Nan Chinese and
-- Wenzhounese as a variety of Wu Chinese. We list them separately because
-- their speakers treat them as separate - which is the entire editorial
-- position of this project applied to language instead of geography: the
-- unit that matters is the one people identify with, not the one an
-- authority finds convenient. So two of our rows legitimately cite the
-- same languoid, and the page shows Glottolog's broader name beside ours
-- rather than pretending the distinction does not exist.
--
-- The unique index would have forced a choice between dropping those
-- rows and leaving them uncited. Neither is acceptable, so the constraint
-- goes instead.
drop index languages_glottocode_idx;
create index languages_glottocode_idx on languages (glottocode)
  where glottocode is not null;

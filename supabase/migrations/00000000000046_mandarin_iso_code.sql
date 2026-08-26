-- scripts/backfill-iso-codes.ts matches languages against
-- Intl.DisplayNames(["en"], {type:"language"}).of(code) - CLDR's English
-- display name for 'zh' is just "Chinese", which doesn't match our stored
-- "Mandarin Chinese/Putonghua" closely enough to backfill automatically.
-- Needed for lib/language-purity-check.ts, which resolves the expected
-- script (Han) for Acme University's Mandarin network from this column.
update languages set iso_code = 'zh' where id = 1 and name = 'Mandarin Chinese/Putonghua';

-- Transcripts and captions for audio/video posts (WCAG 1.2.1/1.2.2/1.2.3,
-- all Level A). transcript itself already exists on both tables from
-- 00000000000063_post_media.sql, where it was added as "filled in by
-- Phase 2" and never populated - this migration finally gives it the
-- surrounding columns it needs.

-- Whether a language is signed rather than spoken/written. Set explicitly
-- by an admin when adding a language, deliberately NOT inferred:
--   * Name matching "sign" happens to catch all four we have today, but
--     misses "Auslan", "Libras", "Lengua de Señas Mexicana", "Deutsche
--     Gebärdensprache" and 日本手話.
--   * iso_code IS NULL looks tempting (all four signed languages have a
--     null iso_code) but is badly wrong as a proxy: 89 of 162 languages
--     have no iso_code, including Bengali, Cantonese, Hmong, Tagalog,
--     Cherokee and Hawaiian. Using it would silently deny transcription
--     to ~85 spoken languages, disproportionately minority and
--     indigenous ones - the opposite of what this feature is for.
alter table languages add column is_signed boolean not null default false;

update languages set is_signed = true
where name in (
  'American Sign Language (ASL)',
  'British Sign Language (BSL)',
  'Taiwanese Sign Language',
  'Chinese Sign Language'
);

-- Whisper's auto-detected language (ISO-639-1). We deliberately do NOT
-- send a language hint (see lib/transcription.ts), so this is an
-- independent signal: it drives the soft "this sounded like English"
-- advisory, and sets lang= on the rendered transcript so a screen reader
-- reads it with the right pronunciation rules.
alter table posts add column transcript_language text;
alter table post_replies add column transcript_language text;

-- Segment timestamps from Whisper's verbose_json, kept so WebVTT captions
-- can be regenerated on demand without re-transcribing. Re-running costs
-- money and, with auto-detection, isn't deterministic - so the timings are
-- stored rather than recomputed.
alter table posts add column transcript_segments jsonb;
alter table post_replies add column transcript_segments jsonb;

-- Optional written summary for signed-language posts, which Whisper can
-- never transcribe (there is no speech in a signed video, and sign
-- recognition is not a solved problem at any price).
--
-- summary_language_id is not optional metadata. A signed language has no
-- written form, so summarizing one in writing is a *translation* into some
-- other language - and which language has to be known both for
-- translateEntry (it needs a source language) and to set lang= on the
-- element. A Spanish summary rendered in an English UI without lang= gets
-- read aloud by a screen reader using English pronunciation, which is
-- exactly the bug fixed for the language switcher in dfc6a44.
alter table posts add column summary_text text;
alter table posts add column summary_language_id bigint references languages(id);
alter table post_replies add column summary_text text;
alter table post_replies add column summary_language_id bigint references languages(id);

alter table posts add constraint posts_summary_has_language check (
  (summary_text is null) = (summary_language_id is null)
);
alter table post_replies add constraint replies_summary_has_language check (
  (summary_text is null) = (summary_language_id is null)
);

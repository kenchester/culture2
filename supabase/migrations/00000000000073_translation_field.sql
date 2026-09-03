-- A post can now have up to three separately translatable pieces of text:
-- its body, its Whisper transcript (00000000000072), and a signed-language
-- author summary. The original cache was keyed on (post_id, target_locale)
-- alone, so translating a post's transcript into the same locale its body
-- was already translated into would collide on the unique index and either
-- fail or serve the wrong text back.
--
-- Defaulting to 'body' keeps every existing cached row correct as-is.
alter table post_translations
  add column field text not null default 'body'
  check (field in ('body', 'transcript', 'summary'));

drop index post_translations_unique_post;
drop index post_translations_unique_reply;

create unique index post_translations_unique_post
  on post_translations (post_id, target_locale, field) where post_id is not null;
create unique index post_translations_unique_reply
  on post_translations (reply_id, target_locale, field) where reply_id is not null;

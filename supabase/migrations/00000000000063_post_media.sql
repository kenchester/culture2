-- Lets a post or reply be a 60-second audio/video recording instead of
-- text (app/networks/[id]/record-media.tsx). Flat nullable columns
-- directly on posts/post_replies, not a separate table (like the
-- likes/post_translations XOR pattern) - every feed and post-detail render
-- needs to know unconditionally whether a row has media, for every row on
-- every load, and both pages already do that with a single flat select();
-- a join or per-row lookup would regress that. transcript is filled in by
-- the Phase 2 audio purity check (app/networks/actions.ts).
alter table posts add column media_type text check (media_type in ('audio', 'video'));
alter table posts add column media_path text;
alter table posts add column media_duration_seconds smallint;
alter table posts add column transcript text;

alter table post_replies add column media_type text check (media_type in ('audio', 'video'));
alter table post_replies add column media_path text;
alter table post_replies add column media_duration_seconds smallint;
alter table post_replies add column transcript text;

-- body stays not null (a media post/reply stores '') so updatePost/
-- updateReply's text-only signature, Linkify, and translation caching stay
-- untouched for text posts - these constraints are the actual guarantee
-- that a row has *something* to show, and that media_type/media_path are
-- set together or not at all.
alter table posts add constraint posts_body_or_media check (
  (media_path is not null) or (length(trim(body)) > 0)
);
alter table posts add constraint posts_media_fields_consistent check (
  (media_path is null) = (media_type is null)
);

alter table post_replies add constraint post_replies_body_or_media check (
  (media_path is not null) or (length(trim(body)) > 0)
);
alter table post_replies add constraint post_replies_media_fields_consistent check (
  (media_path is null) = (media_type is null)
);

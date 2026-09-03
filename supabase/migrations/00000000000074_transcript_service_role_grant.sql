-- The live transcription path writes as the post's own author (the
-- per-request client in lib/transcription.ts), which already works:
-- 00000000000004 grants UPDATE on posts/post_replies to authenticated, and
-- the "authors can edit their own posts" RLS policy covers it.
--
-- The backfill script (scripts/backfill-transcripts.ts) can't do that -
-- it runs with no user session and has to touch rows belonging to many
-- different authors - and service_role has no UPDATE on these tables at
-- all (00000000000047 deliberately granted it only on profiles). Without
-- this the backfill fails with a bare "permission denied for table posts".
--
-- Column-scoped rather than a blanket table grant, following the same
-- pattern as 00000000000055's instructor_prompt grant: service_role gets
-- exactly the three transcript columns and nothing else, so this can never
-- become a path for rewriting a post's body or reassigning its author.
grant update (transcript, transcript_language, transcript_segments)
  on posts to service_role;
grant update (transcript, transcript_language, transcript_segments)
  on post_replies to service_role;

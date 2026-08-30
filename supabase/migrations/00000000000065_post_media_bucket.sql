-- Private storage for recorded post/reply audio+video
-- (00000000000063_post_media.sql) - unlike the public avatars bucket
-- (00000000000007_avatars_bucket.sql), recorded speech/video is more
-- sensitive than a profile photo, so playback goes through a signed URL
-- minted server-side rather than a world-readable object URL.
--
-- The select policy below only lets an uploader read their own folder -
-- that's NOT what makes a post's media visible to other members. Posts
-- are publicly readable (posts_are_publicly_readable), so any viewer needs
-- to see any poster's media: getPostMediaUrl (lib/profiles.ts) mints
-- signed URLs via the service-role admin client, which bypasses this
-- policy entirely. This select policy exists only as a narrow fallback for
-- a user inspecting their own uploads directly with their own session, not
-- as the mechanism that makes posts actually visible to others.
--
-- No update policy: re-recording is delete+re-upload, not overwrite.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  26214400, -- 25MB ceiling, generous for a 60s clip
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'video/webm', 'video/mp4']
);

create policy "users can upload their own post media"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can read their own post media"
  on storage.objects for select
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own post media"
  on storage.objects for delete
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

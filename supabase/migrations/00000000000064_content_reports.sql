-- Minimal capture-only safety net for audio/video posts shipping site-wide
-- with no moderation system yet (00000000000063_post_media.sql) - just a
-- "Report" link that records who flagged what and why. Deliberately no
-- admin review queue/UI yet; that's real future work once there's data on
-- what actually gets reported.
create table content_reports (
  id bigint generated always as identity primary key,
  post_id bigint references posts(id) on delete cascade,
  reply_id bigint references post_replies(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint exactly_one_reported_target check ((post_id is not null) <> (reply_id is not null))
);

alter table content_reports enable row level security;

create policy "authenticated users can report content" on content_reports
  for insert with check (reporter_id = auth.uid());

create policy "global admins can view reports" on content_reports
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

grant insert on content_reports to authenticated;
grant select on content_reports to authenticated;

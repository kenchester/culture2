-- A simple thumbs-up on posts and replies, backing the "Likes on your
-- posts" notification. One table for both, distinguished by which of
-- post_id/reply_id is set (mirrors the exactly_one_origin pattern already
-- used on networks) - avoids two near-identical tables for what's really
-- the same relationship.
create table likes (
  post_id bigint references posts(id) on delete cascade,
  reply_id bigint references post_replies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint exactly_one_liked_target check (
    (post_id is not null and reply_id is null) or
    (post_id is null and reply_id is not null)
  )
);

-- Partial unique indexes rather than a composite primary key, since
-- exactly one of post_id/reply_id is always null and a PK can't enforce
-- "one like per user per item" across two nullable columns on its own.
create unique index likes_unique_post_like on likes (post_id, user_id) where post_id is not null;
create unique index likes_unique_reply_like on likes (reply_id, user_id) where reply_id is not null;

alter table likes enable row level security;

create policy "likes are publicly readable" on likes for select using (true);
create policy "users can like as themselves" on likes for insert with check (auth.uid() = user_id);
create policy "users can unlike their own like" on likes for delete using (auth.uid() = user_id);

grant select on likes to anon, authenticated;
grant insert, delete on likes to authenticated;

-- Deleting a post shouldn't silently destroy a reply someone has shared.
--
-- Until now deleting a post cascaded its replies out of existence. That is
-- the right default - a thread without the thing it answers is usually
-- noise - but it also means a permalink someone copied and sent to another
-- person dies with a post they had no control over.
--
-- So: a reply whose permalink has actually been copied survives; one that
-- has never been linked to does not. If nothing survives, the post is
-- removed outright as before, because there is nothing left to preserve
-- and keeping the row would be hoarding. If something does survive, the
-- post is soft-deleted: the row stays so the reply's URL
-- (/networks/x/posts/y/replies/z) still resolves, but it is hidden from the
-- feed, from its own page, and from the post count.
--
-- Deliberate consequence, agreed with the product owner: a soft-deleted
-- post's text remains in the database, invisible to every surface, for as
-- long as a permalinked reply hangs off it. Genuine purging (illegal
-- content, a takedown) is an admin action, not something this path does.

alter table posts add column deleted_at timestamptz;

-- Set the first time anyone copies this reply's permalink. Null means
-- nobody has ever shared it, which is what makes it safe to remove.
alter table post_replies add column permalink_copied_at timestamptz;

-- Partial index: the feed's "not deleted" filter is the hot path, and the
-- deleted rows are the rare ones.
create index posts_not_deleted_idx on posts (network_id, created_at desc, id desc)
  where deleted_at is null;

comment on column posts.deleted_at is
  'Soft-deleted: hidden everywhere, retained only so permalinked replies beneath it still resolve. See 00000000000081.';
comment on column post_replies.permalink_copied_at is
  'First time this reply''s permalink was copied. Non-null means it survives deletion of its post.';

-- Marking a permalink as copied.
--
-- Callable by anyone, including signed-out visitors, because anyone can
-- copy a link. It only ever stamps a timestamp on a reply that already
-- exists and never overwrites an earlier one, so the worst it can do is
-- preserve a reply that nobody really shared.
create or replace function mark_reply_permalink_copied(p_reply_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update post_replies
  set permalink_copied_at = now()
  where id = p_reply_id and permalink_copied_at is null;
$$;

grant execute on function mark_reply_permalink_copied(bigint) to anon, authenticated;

-- Deleting a post.
--
-- SECURITY DEFINER because this has to remove OTHER people's replies - the
-- ones never linked to - which the author has no direct right to do
-- ("authors can delete their own replies" in 00000000000003_rls.sql). The
-- author check is therefore done explicitly here, first, rather than being
-- inherited from a policy.
--
-- post_count is adjusted by hand in the soft-delete branch: the
-- posts_count_sync trigger only fires on INSERT and DELETE, so a soft
-- delete would otherwise leave the network claiming a post nobody can see.
create or replace function delete_post(p_post_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_network_id bigint;
  v_survivors int;
begin
  select network_id into v_network_id
  from posts
  where id = p_post_id and user_id = auth.uid();

  if v_network_id is null then
    raise exception 'post not found or not yours';
  end if;

  delete from post_replies
  where post_id = p_post_id and permalink_copied_at is null;

  select count(*) into v_survivors
  from post_replies
  where post_id = p_post_id;

  if v_survivors = 0 then
    delete from posts where id = p_post_id;
    return 'deleted';
  end if;

  update posts set deleted_at = now() where id = p_post_id;
  update networks set post_count = greatest(post_count - 1, 0) where id = v_network_id;
  return 'soft_deleted';
end;
$$;

grant execute on function delete_post(bigint) to authenticated;

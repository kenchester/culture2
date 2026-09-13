-- Position a reply under the reply it answers.
--
-- 00000000000079 added reply_to_user_id, which is enough to name someone
-- and notify them but not enough to place the reply: two people can both
-- answer the same person under different replies, so the user id doesn't
-- identify a position in the thread.
--
-- This stays ONE level deep on purpose. When someone answers a reply that
-- is itself an answer, the new reply is attached to the same root rather
-- than nesting under its immediate target - the application resolves that
-- before inserting. So a thread is a list of top-level replies, each with a
-- flat batch beneath it, and never a tree. Nesting past one level is
-- unreadable on a phone and the indentation carries no information the
-- named person doesn't already convey.
--
-- Cascades: deleting a reply takes its batch with it, which matches what
-- deleting the thing they were all answering means.
alter table post_replies
  add column parent_reply_id bigint references post_replies(id) on delete cascade;

-- Every thread render groups by this, scoped to one post.
create index post_replies_parent_idx on post_replies (parent_reply_id);

comment on column post_replies.parent_reply_id is
  'The top-level reply this one sits beneath, or null if it is itself top-level. Never more than one level deep - see 00000000000080.';

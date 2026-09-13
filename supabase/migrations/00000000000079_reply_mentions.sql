-- Replying to a reply, without nesting.
--
-- post_replies has always been flat (post_id, no parent_id), and it stays
-- flat. Threads that nest arbitrarily are the thing this deliberately
-- avoids: they get unreadable on a phone within two levels, and the
-- indentation carries no information anyone needs. Facebook solved this
-- years ago by keeping one level and naming the person instead, which is
-- what this column does.
--
-- Storing WHO is being answered, rather than parsing an "@name" back out of
-- the body text, keeps three things honest: the notification goes to a real
-- account rather than a string that happens to look like a name; renaming
-- or deleting a profile can't orphan the mention; and someone typing
-- "@ana" in the middle of a sentence doesn't accidentally notify anyone.
alter table post_replies
  add column reply_to_user_id uuid references profiles(id) on delete set null;

-- Only meaningful on the read path, and every read is already scoped to one
-- post, so no index: the planner is filtering a handful of rows it has
-- already fetched.

comment on column post_replies.reply_to_user_id is
  'The person this reply answers, when it answers another reply rather than the post itself. Rendered as a link before the body and notified in place of the post author.';

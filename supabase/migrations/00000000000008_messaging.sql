-- Per-user read state per conversation. Unread count is derived as
-- "messages after last_read_at not sent by me" rather than a per-message
-- read flag, since that scales to any conversation length with one row
-- per (conversation, user) instead of one per (message, user).
create table conversation_reads (
  conversation_id bigint not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table conversation_reads enable row level security;

create policy "users can read their own read-state" on conversation_reads
  for select using (auth.uid() = user_id);

create policy "users can set their own read-state" on conversation_reads
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from conversations
      where conversations.id = conversation_reads.conversation_id
        and (conversations.user_a = auth.uid() or conversations.user_b = auth.uid())
    )
  );

create policy "users can update their own read-state" on conversation_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on conversation_reads to authenticated;

-- Live message delivery: Postgres Changes on `messages`, scoped by the
-- table's existing RLS (a participant only ever receives events for their
-- own conversations - Realtime enforces the same select policy).
alter publication supabase_realtime add table messages;

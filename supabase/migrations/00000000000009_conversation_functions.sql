-- Finds or creates the conversation between the caller and another user,
-- handling the user_a < user_b canonical ordering (see Phase 0's comment
-- on the conversations table) so callers never have to know or care which
-- side of the pair they are.
create or replace function start_conversation(p_other_user_id uuid)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_conversation_id bigint;
begin
  if auth.uid() = p_other_user_id then
    raise exception 'cannot start a conversation with yourself';
  end if;

  if auth.uid() < p_other_user_id then
    v_user_a := auth.uid();
    v_user_b := p_other_user_id;
  else
    v_user_a := p_other_user_id;
    v_user_b := auth.uid();
  end if;

  insert into conversations (user_a, user_b)
  values (v_user_a, v_user_b)
  on conflict (user_a, user_b) do nothing;

  select id into v_conversation_id
  from conversations
  where user_a = v_user_a and user_b = v_user_b;

  return v_conversation_id;
end;
$$;

grant execute on function start_conversation(uuid) to authenticated;

-- Inbox listing: other participant, last message preview, and an unread
-- count derived from conversation_reads. security invoker (default, made
-- explicit) - the underlying RLS on conversations/messages/profiles/
-- conversation_reads already scopes everything to the caller correctly,
-- so this doesn't need to bypass anything.
create or replace function list_conversations()
returns table (
  conversation_id bigint,
  other_user_id uuid,
  other_username text,
  other_first_name text,
  other_last_name text,
  other_img_path text,
  last_message_body text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
security invoker
stable
as $$
  select
    c.id as conversation_id,
    other.id as other_user_id,
    other.username,
    other.first_name,
    other.last_name,
    other.img_path,
    lm.body as last_message_body,
    lm.created_at as last_message_at,
    (
      select count(*) from messages m
      where m.conversation_id = c.id
        and m.sender_id != auth.uid()
        and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    ) as unread_count
  from conversations c
  join profiles other on other.id = (case when c.user_a = auth.uid() then c.user_b else c.user_a end)
  left join lateral (
    select body, created_at from messages
    where messages.conversation_id = c.id
    order by created_at desc
    limit 1
  ) lm on true
  left join conversation_reads cr on cr.conversation_id = c.id and cr.user_id = auth.uid()
  where c.user_a = auth.uid() or c.user_b = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

grant execute on function list_conversations() to authenticated;

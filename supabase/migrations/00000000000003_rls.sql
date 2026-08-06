alter table places enable row level security;
alter table languages enable row level security;
alter table profiles enable row level security;
alter table networks enable row level security;
alter table network_members enable row level security;
alter table posts enable row level security;
alter table post_replies enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notification_prefs enable row level security;
alter table suggested_networks enable row level security;
alter table embed_partners enable row level security;
alter table embed_partner_jurisdictions enable row level security;

-- Reference geography/language data: readable by anyone (search, and the
-- public embassy embed pages need this with no session at all), writable
-- only by service_role (migrations/seed data, no end-user write path yet).
create policy "places are publicly readable" on places
  for select using (true);

create policy "languages are publicly readable" on languages
  for select using (true);

-- Profiles: public read (names/avatars show up alongside posts, events,
-- member lists), but a user can only edit their own row. Row creation is
-- handled by the handle_new_auth_user trigger (security definer, bypasses
-- RLS), so there's no insert policy for end users.
create policy "profiles are publicly readable" on profiles
  for select using (true);

create policy "users can update their own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Networks: public read (search, embed pages). Any authenticated user can
-- launch a network (the "possible network becomes real the moment someone
-- joins it" flow), but only as themselves. No update/delete policy yet —
-- member_count/post_count are maintained by security-definer triggers, and
-- there's no network-editing feature to authorize otherwise.
create policy "networks are publicly readable" on networks
  for select using (true);

create policy "authenticated users can launch a network" on networks
  for insert with check (auth.uid() = launched_by);

-- Membership: public read (member lists/counts), but a user can only join
-- or leave on their own behalf.
create policy "network membership is publicly readable" on network_members
  for select using (true);

create policy "users can join a network as themselves" on network_members
  for insert with check (auth.uid() = user_id);

create policy "users can leave a network they joined" on network_members
  for delete using (auth.uid() = user_id);

-- Posts: public read. Posting requires being a member of that network, and
-- only as yourself. Editing/deleting is limited to the post's own author.
create policy "posts are publicly readable" on posts
  for select using (true);

create policy "network members can post as themselves" on posts
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from network_members
      where network_members.network_id = posts.network_id
        and network_members.user_id = auth.uid()
    )
  );

create policy "authors can edit their own posts" on posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authors can delete their own posts" on posts
  for delete using (auth.uid() = user_id);

-- Replies: public read; any authenticated user can reply as themselves
-- (lower-friction than posts — no membership gate on commenting).
create policy "post replies are publicly readable" on post_replies
  for select using (true);

create policy "authenticated users can reply as themselves" on post_replies
  for insert with check (auth.uid() = user_id);

create policy "authors can edit their own replies" on post_replies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authors can delete their own replies" on post_replies
  for delete using (auth.uid() = user_id);

-- Events: public read. Hosting requires network membership, same reasoning
-- as posts. Only the host can edit/cancel their own event.
create policy "events are publicly readable" on events
  for select using (true);

create policy "network members can host events as themselves" on events
  for insert with check (
    auth.uid() = host_id
    and exists (
      select 1 from network_members
      where network_members.network_id = events.network_id
        and network_members.user_id = auth.uid()
    )
  );

create policy "hosts can edit their own events" on events
  for update using (auth.uid() = host_id) with check (auth.uid() = host_id);

create policy "hosts can delete their own events" on events
  for delete using (auth.uid() = host_id);

-- RSVPs: public read (attendee counts/lists), but a user can only manage
-- their own RSVP.
create policy "event rsvps are publicly readable" on event_rsvps
  for select using (true);

create policy "users can rsvp as themselves" on event_rsvps
  for insert with check (auth.uid() = user_id);

create policy "users can change their own rsvp" on event_rsvps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can cancel their own rsvp" on event_rsvps
  for delete using (auth.uid() = user_id);

-- Conversations/messages: private to the two participants. No update/delete
-- policy — neither conversations nor messages are edited or deleted by
-- users in the current feature set.
create policy "participants can read their conversations" on conversations
  for select using (auth.uid() = user_a or auth.uid() = user_b);

create policy "a participant can start a conversation" on conversations
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

create policy "participants can read their messages" on messages
  for select using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and (conversations.user_a = auth.uid() or conversations.user_b = auth.uid())
    )
  );

create policy "participants can send messages as themselves" on messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and (conversations.user_a = auth.uid() or conversations.user_b = auth.uid())
    )
  );

-- Notification preferences: private, own-row only. Row creation is handled
-- by the handle_new_auth_user trigger.
create policy "users can read their own notification prefs" on notification_prefs
  for select using (auth.uid() = user_id);

create policy "users can update their own notification prefs" on notification_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Suggested networks: a user can submit and see their own suggestions.
-- Review/approval is a staff action done via service_role (no admin UI or
-- role concept exists yet), so there's no update/delete policy for users.
create policy "users can read their own suggestions" on suggested_networks
  for select using (auth.uid() = suggested_by);

create policy "authenticated users can suggest a network" on suggested_networks
  for insert with check (auth.uid() = suggested_by);

-- Embassy/partner embeds: publicly readable (the whole point is that an
-- anonymous embassy-site visitor can load /embed/[partnerSlug] with no
-- session), but only staff (service_role, via the future admin panel) can
-- create or modify them — no insert/update/delete policy for anon/authenticated.
create policy "embed partners are publicly readable" on embed_partners
  for select using (true);

create policy "embed partner jurisdictions are publicly readable" on embed_partner_jurisdictions
  for select using (true);

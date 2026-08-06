-- Structurally prevents the legacy bug class where a controller had to
-- remember to recompute member/post counts after every join/leave/post.
-- security definer: once RLS policies land in Phase 1, an ordinary user
-- won't have UPDATE rights on `networks` directly, but this trigger still
-- needs to bump the count on their behalf when they join/post.
create or replace function sync_network_member_count() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update networks set member_count = member_count + 1 where id = new.network_id;
    return new;
  elsif tg_op = 'DELETE' then
    update networks set member_count = member_count - 1 where id = old.network_id;
    return old;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create trigger network_members_count_sync
  after insert or delete on network_members
  for each row execute function sync_network_member_count();

create or replace function sync_network_post_count() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update networks set post_count = post_count + 1 where id = new.network_id;
    return new;
  elsif tg_op = 'DELETE' then
    update networks set post_count = post_count - 1 where id = old.network_id;
    return old;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create trigger posts_count_sync
  after insert or delete on posts
  for each row execute function sync_network_post_count();

-- Every auth.users row needs a matching profiles row for the rest of the
-- schema (network_members, posts, etc.) to reference. Supabase Auth creates
-- auth.users directly, so nothing else would ever create this row.
create or replace function handle_new_auth_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

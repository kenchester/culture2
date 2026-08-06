-- RLS policies only filter rows within what a role already has table-level
-- privilege to touch. This project didn't inherit Supabase's usual default
-- grants for anon/authenticated on newly created tables, so without this,
-- every policy above is unreachable and every request 401s with
-- "permission denied for table X" regardless of what the policy allows.
grant usage on schema public to anon, authenticated;

grant select on
  places, languages, profiles, networks, network_members, posts, post_replies,
  events, event_rsvps, notification_prefs, suggested_networks,
  embed_partners, embed_partner_jurisdictions
to anon, authenticated;

grant select on conversations, messages to authenticated;

grant insert on
  networks, network_members, posts, post_replies, events, event_rsvps,
  suggested_networks, conversations, messages
to authenticated;

grant update on profiles, posts, post_replies, events, event_rsvps, notification_prefs
to authenticated;

grant delete on network_members, posts, post_replies, events, event_rsvps
to authenticated;

grant usage on all sequences in schema public to authenticated;

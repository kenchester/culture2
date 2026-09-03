-- Tracks whether each of the two unconfirmed-signup nudge emails
-- (app/api/cron/signup-reminders) has already gone out for this account -
-- the cron job checks these before sending so a run that's late, doubles
-- up, or catches up on a backlog can never send either reminder twice.
-- Lives on profiles rather than auth.users: every auth.users row already
-- gets a profiles row at creation time via on_auth_user_created
-- (00000000000002), confirmed or not, and auth.users itself is
-- Supabase-managed schema this app doesn't otherwise alter.
alter table profiles add column signup_reminder_24h_sent_at timestamptz;
alter table profiles add column signup_reminder_final_sent_at timestamptz;

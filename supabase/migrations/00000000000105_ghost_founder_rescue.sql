-- Tracks whether the lone-founder rescue email has gone out for a network.
--
-- 24 networks have no members at all; 51 have exactly one, and 47 of
-- those have been stuck there for 30+ days. Nothing on this site has ever
-- followed up with that person again - the only existing cron
-- (signup-reminders) nudges someone who never finished confirming an
-- account, which is a different person at a different, earlier moment.
--
-- The rescue email (app/api/cron/network-rescue) is deliberately narrow:
-- it only fires when page_views shows real, recent traffic on this
-- person's own network page or its corridor/city/language page, and it
-- quotes that real number. An email that says "nobody has come" would be
-- worse than silence; this column exists so the ONE email that says
-- "people HAVE come" only ever goes out once per month to any given
-- founder, matching the existing signup-reminder job's own discipline of
-- re-querying live state rather than trusting a stale flag.
alter table networks add column rescue_email_sent_at timestamptz;

-- service_role has only ever had select+insert on networks (00000000000047)
-- plus a column-scoped update for `title` alone (00000000000077, which
-- explains why: a blanket UPDATE grant paired with RLS would make the
-- WHOLE row writable once any policy allows it, far more than intended).
-- Same reasoning here - the cron job must be able to stamp exactly this
-- one column and nothing else about a network it does not own.
grant update (rescue_email_sent_at) on networks to service_role;

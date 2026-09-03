-- 00000000000047 gave service_role INSERT on post_replies (for the Acme
-- seed script) but never SELECT, so scripts/backfill-transcripts.ts fails
-- with "permission denied for table post_replies" the moment it looks for
-- replies needing a transcript. There are no media replies yet, so the
-- failure is currently invisible - it would simply have skipped every
-- reply forever once there were.
--
-- posts already has service_role SELECT; this just closes the asymmetry.
grant select on post_replies to service_role;

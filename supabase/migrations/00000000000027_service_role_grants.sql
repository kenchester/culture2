-- This project never inherited Supabase's default grants for anon/
-- authenticated (see 00000000000004_grants.sql) - it turns out service_role
-- is in the same boat: confirmed live that a service-role-authenticated
-- PostgREST request gets "permission denied for table notification_prefs"
-- (42501), not an RLS rejection - RLS is bypassed correctly for
-- service_role, but the role has no table-level grant at all here. The new
-- admin client (lib/supabase/admin.ts) needs to read notification_prefs to
-- resolve who's opted into each notification category.
grant select on notification_prefs to service_role;

-- The program-admin "remove a member" action deletes someone ELSE's
-- network_members row (the self-serve "leave a network" RLS policy only
-- covers auth.uid() = user_id), so it runs through the service-role client
-- - which had select/insert from 00000000000043_organizations.sql but not
-- delete yet.
grant delete on network_members to service_role;

-- Missed alongside 00000000000047: the seed script also selects profiles
-- by username to check idempotency before creating a fake student.
grant select on profiles to service_role;

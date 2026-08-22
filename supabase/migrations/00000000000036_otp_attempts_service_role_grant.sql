-- This project has no default grants (see 00000000000027_service_role_grants.sql) -
-- otp_attempts needs an explicit service_role grant so the admin client used by
-- the rate-limit helper can actually read/write it, same gap that already bit
-- notification_prefs once before.
grant select, insert on otp_attempts to service_role;
grant usage on sequence otp_attempts_id_seq to service_role;

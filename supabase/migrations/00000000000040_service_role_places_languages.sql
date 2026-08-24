-- scripts/backfill-iso-codes.ts runs as service_role (a plain ops script,
-- not an authenticated admin session) to populate the new iso_code
-- column - this project has no default role grants (confirmed precedent
-- at 00000000000027_service_role_grants.sql), and the existing
-- places/languages grants only cover `authenticated` (admin UI edits,
-- see 00000000000018_admin_places_languages.sql).
grant select, update on places, languages to service_role;

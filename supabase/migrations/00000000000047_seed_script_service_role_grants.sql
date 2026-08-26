-- scripts/seed-acme-university.ts writes through the admin (service-role)
-- client throughout, same as every other privileged script/flow in this
-- project - it needs its own explicit grants on tables that previously
-- only had service_role select/update (or no grant at all), since this
-- project has no default role grants (see 00000000000027).
grant insert on places to service_role;
grant insert on organizations to service_role;
grant insert on organization_languages to service_role;
grant select, insert on networks to service_role;
grant insert on posts to service_role;
grant insert on post_replies to service_role;
grant update on profiles to service_role;

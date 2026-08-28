-- Multiple schools will share subdomain='learn' (the shared
-- learn.culturemesh.com entry point), distinguished by the already-unique
-- slug column instead - a dedicated per-org subdomain is no longer the only
-- addressing scheme, so subdomain can no longer be globally unique. slug's
-- own unique constraint (organizations_slug_key) already gives every school
-- a collision-free path segment, so nothing else needs to change here.
alter table organizations drop constraint organizations_subdomain_key;

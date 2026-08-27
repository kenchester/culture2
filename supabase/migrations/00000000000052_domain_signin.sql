-- Lets an org admin turn off domain-based auto-recognition even when a
-- domain is on file (kept for the marketing banner's domain-check) -
-- some small language schools don't issue students institutional email
-- addresses at all, so domain-matching would never be meaningful for
-- them. Meaningless when domain itself is null, which already prevents
-- any domain-matching regardless of this flag.
alter table organizations add column domain_signin_enabled boolean not null default true;

-- Org offboarding (deleteOrganization in app/admin/organizations/actions.ts)
-- needs to delete the org's networks (cascades to posts/post_replies/
-- network_members), its location place row, and the organizations row
-- itself, all via the service-role client - only select/insert/update
-- were granted on these tables previously, never delete.
grant delete on organizations to service_role;
grant delete on places to service_role;
grant delete on networks to service_role;

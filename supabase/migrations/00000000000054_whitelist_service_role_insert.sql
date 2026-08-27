-- The domain-match branch in lib/organization-whitelist.ts's
-- claimWhitelistSeat() inserts a new (pending, empty language_ids)
-- organization_whitelist row via the admin client - previously only
-- select/update/delete were granted to service_role on this table (only
-- the org-admin-driven insert via the regular authenticated client existed
-- before).
grant insert on organization_whitelist to service_role;

-- Missed alongside 00000000000043: cleanup/offboarding via the admin
-- client (e.g. removing a whitelist row whose claimed_by references a
-- profile about to be deleted) needs delete too, not just select/update.
grant delete on organization_whitelist to service_role;

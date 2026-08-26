-- Missed alongside 00000000000047: ensurePosts checks for existing seed
-- posts (idempotency) before inserting, which needs select too.
grant select on posts to service_role;

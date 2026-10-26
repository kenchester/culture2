-- Let a script create and inspect an embed partner.
--
-- embed_partners has only ever been written through the admin UI, so its
-- writes are granted to `authenticated` and gated by the is_admin policy
-- (00000000000010). service_role was never given anything at all - not
-- even SELECT - which means every verification script written against
-- this table silently reads back null rather than failing, the same trap
-- that hid the pageview bug.
--
-- Granting service_role here matches every other reference table that is
-- loaded or checked by script (00000000000047, 00000000000092). It does
-- not widen what a signed-in admin or an anonymous visitor can do: the
-- RLS policies and the `authenticated` grants are untouched, and
-- service_role is already trusted across the rest of the schema.
grant select, insert, update, delete on embed_partners to service_role;
grant usage, select on sequence embed_partners_id_seq to service_role;
grant select, insert, update, delete on embed_partner_jurisdictions to service_role;

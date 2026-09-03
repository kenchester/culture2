-- Until now a network could only be removed by deleting its entire
-- organization (deleteOrganization in app/admin/organizations/actions.ts),
-- which is the wrong tool for "this one network was created by mistake" -
-- it takes the school, its whitelist, its admins and every other network
-- with it. The new /admin/organizations/[id]/networks screen manages a
-- single network at a time and needs the grants to do it.
--
-- 00000000000047 gave service_role only select+insert on networks, so both
-- renaming and deleting were denied outright.
--
-- Renaming is column-scoped to title, matching the pattern used for
-- instructor_prompt (00000000000055) and the transcript columns
-- (00000000000074): an admin renaming a network has no business
-- reassigning its language, its location, or who launched it.
grant update (title) on networks to service_role;

-- Deleting a network cascades to its posts, replies and members via
-- existing FKs, but organization_languages.network_id is a plain FK with
-- no ON DELETE CASCADE, so that link row has to be removed first or the
-- delete fails with a foreign key violation - the same ordering
-- deleteOrganization already works around by deleting the org first.
grant delete on organization_languages to service_role;
grant delete on networks to service_role;

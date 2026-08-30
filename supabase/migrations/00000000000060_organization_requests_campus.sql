-- Matches the "Create an organization" admin form's equivalent fix: the
-- campus place created on approval is now auto-named after the school
-- (school_name), so a separately-typed location_name is redundant and
-- removed. parent_country_id is renamed since it's no longer country-only -
-- an instructor can now anchor their school under a country, region, or
-- (usually) a real city.
alter table organization_requests drop column location_name;
alter table organization_requests rename column parent_country_id to parent_place_id;

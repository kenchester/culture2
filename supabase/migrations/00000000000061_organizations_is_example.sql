-- Distinguishes the one demo org (Acme) from every real school - the
-- public /learn/[slug] page shows different messaging for each (an
-- "Example Network" badge and a locked example-language search for Acme;
-- a real "log in with your school email" CTA and self-serve network launch
-- for everyone else). A flag rather than hardcoding the Acme slug in app
-- code, since nothing about the distinction is otherwise slug-specific.
alter table organizations add column is_example boolean not null default false;
update organizations set is_example = true where slug = 'acme-university';

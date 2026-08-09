-- For a partner without a single origin to represent - a country's state
-- department wanting a general diaspora tool for citizens anywhere, as
-- opposed to one embassy locked to that one country - leave the origin
-- unrestricted too. locked_language_id/locked_origin_place_id both being
-- null already means "no lock" at the schema level (at_most_one_locked_origin
-- allows both null), but an explicit flag makes that a deliberate choice
-- rather than indistinguishable from an admin who forgot to set one.
alter table embed_partners add column origin_is_global boolean not null default false;

-- Make the username a usable alternative to a real name.
--
-- profiles.username has existed since 00000000000001 and getDisplayName()
-- has always fallen back to it, but nothing ever explained it, nothing
-- validated it, and registration asked only for a "Name" - required if
-- left blank. So the one affordance that lets someone take part without
-- publishing their legal name was reachable only by finding the profile
-- editor and guessing what the field was for.
--
-- This migration fixes the three things that made it unsafe to recommend:
--
-- 1. The unique constraint was case-sensitive, so "Ken" and "ken" could
--    both exist. In a product whose premise is that a small community
--    recognises its own members, two accounts one case-flip apart is an
--    impersonation tool, not a cosmetic issue.
-- 2. No format rule, so a username could contain spaces, be one character
--    long, or consist of punctuation.
-- 3. Nothing stopped an account calling itself "culturemesh", "admin" or
--    "consul" - the last especially, now that the platform grants that
--    office by election.
--
-- Verified against production before writing: of 36 existing usernames,
-- none violate the format below and none collide case-insensitively, so
-- every constraint here applies to current data without a backfill.

-- Case-insensitive uniqueness. The original case-sensitive constraint is
-- left in place; this one is strictly stronger and both are reported by
-- name, which lib/username.ts matches on to tell a person their choice is
-- taken rather than showing them a constraint violation.
create unique index profiles_username_lower_idx on profiles (lower(username));

alter table profiles add constraint profiles_username_shape
  check (
    username is null
    or (
      length(username) between 3 and 30
      -- Must open with an alphanumeric, so a name can't begin with
      -- punctuation that reads as formatting or vanishes in a list.
      and username ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]*$'
    )
  );

-- Kept in sync by hand with RESERVED in apps/web/lib/username.ts. If the
-- two ever drift, this is the stricter of the pair and the person sees a
-- generic rejection instead of a specific one - the safe direction.
alter table profiles add constraint profiles_username_not_reserved
  check (
    username is null
    or lower(username) not in (
      'admin', 'administrator', 'api', 'consul', 'culturemesh', 'help',
      'learn', 'mod', 'moderator', 'official', 'root', 'security',
      'staff', 'support', 'system', 'team', 'www'
    )
  );

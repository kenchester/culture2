-- School content was world-readable.
--
-- posts and post_replies have carried `for select using (true)` since
-- 00000000000003_rls.sql, and nothing has narrowed it since. The only
-- restrictive policy added for organizations (00000000000043) blocks
-- self-serve INSERT into network_members - it says who may JOIN an
-- org-gated network, never who may READ one. So anyone holding a
-- learn.culturemesh.com network URL could read students' posts and their
-- Whisper transcripts without signing in, and because lib/post-media.ts
-- mints signed URLs with the service-role client on behalf of any viewer,
-- could play their audio and video too.
--
-- These restrictive policies close that. A restrictive policy is ANDed
-- against every permissive one, which is what's needed here: the existing
-- "publicly readable" policy stays exactly as it is for the rest of the
-- site, and this narrows it only where an organization is involved.
--
-- Three ways a row passes:
--
--   1. The network isn't org-gated at all. True for nearly every network
--      on the main site, and for faith./redeemed./any future subdomain, so
--      public content stays public and link-sharing there is unaffected.
--   2. The network belongs to a demo organization (organizations.is_example
--      - today just acme-university). The Acme networks exist precisely so
--      an anonymous visitor can look around without an account, so gating
--      them would break the demo.
--   3. The viewer is a member of that specific network. Membership in an
--      org-gated network only ever comes from the admin whitelist/claim
--      flow, so this is exactly "signed in and belongs to that school's
--      network" with no new tables or columns.
--
-- service_role bypasses RLS, so admin tooling and the transcript/backfill
-- scripts are unaffected.

create policy "org-gated posts require network membership"
  on posts as restrictive for select
  using (
    not exists (
      select 1 from organization_languages ol
      where ol.network_id = posts.network_id
    )
    or exists (
      select 1 from organization_languages ol
      join organizations o on o.id = ol.organization_id
      where ol.network_id = posts.network_id
        and o.is_example
    )
    or exists (
      select 1 from network_members nm
      where nm.network_id = posts.network_id
        and nm.user_id = auth.uid()
    )
  );

-- Same rule, reached through the reply's parent post. A reply is no less
-- sensitive than the post it hangs off.
create policy "org-gated replies require network membership"
  on post_replies as restrictive for select
  using (
    exists (
      select 1
      from posts p
      where p.id = post_replies.post_id
        and (
          not exists (
            select 1 from organization_languages ol
            where ol.network_id = p.network_id
          )
          or exists (
            select 1 from organization_languages ol
            join organizations o on o.id = ol.organization_id
            where ol.network_id = p.network_id
              and o.is_example
          )
          or exists (
            select 1 from network_members nm
            where nm.network_id = p.network_id
              and nm.user_id = auth.uid()
          )
        )
    )
  );

-- The membership lookup above runs per row on every feed render. The
-- primary key on network_members is (network_id, user_id) in that order,
-- which already serves it; organization_languages.network_id is unique,
-- so it is indexed too. No new indexes needed.

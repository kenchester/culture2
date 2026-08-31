-- Backs the smart redirect at learn.culturemesh.com's bare root
-- (app/learn/page.tsx): a signed-in visitor recognized at more than one
-- real school should land on whichever one they were most recently
-- active in, not a "choose your school" picker on every visit. Updated
-- by lib/organization-whitelist.ts whenever a signed-in visitor is
-- confirmed as a member of a real (non-example) school; nullable since
-- most profiles never touch learn.culturemesh.com at all.
alter table profiles add column last_learn_organization_id bigint references organizations(id);

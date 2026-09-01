-- Acme's example events (app/networks/[id]/events/page.tsx) should always
-- read as "coming up soon", not drift into the past the longer the demo
-- has existed. When set, an event's *displayed* date is computed live as
-- now() + N days (lib/demo-network.ts) instead of using the stored
-- event_date, which stays fixed only as a stable sort key. Null for every
-- real event - a real event has a genuine fixed date an instructor set.
alter table events add column demo_days_from_now int;

comment on column events.demo_days_from_now is
  'When set, this example event''s displayed date is computed live as now() + N days instead of using event_date - see lib/demo-network.ts.';

-- The "sooner" event in each of Acme's 4 example networks always shows as
-- ~2 weeks out, the "later" one as ~3 weeks out.
update events set demo_days_from_now = 14 where id in (3, 5, 7, 9);
update events set demo_days_from_now = 21 where id in (4, 6, 8, 10);

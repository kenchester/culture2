-- 00000000000088 added outpost_officers.election_id with no on-delete
-- action, so the default NO ACTION made the officer row block deletion of
-- the election that created it. Removing a mistaken or test election then
-- fails with a foreign-key violation, and the only way out is to delete
-- the officer first - which is backwards, since the officer is the thing
-- worth keeping.
--
-- set null, not cascade: losing the trace back to the mandate is a
-- shame, losing the consul is a bug.
alter table outpost_officers
  drop constraint outpost_officers_election_id_fkey;
alter table outpost_officers
  add constraint outpost_officers_election_id_fkey
  foreign key (election_id) references elections(id) on delete set null;

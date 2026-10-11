-- Community elections for an Unofficial Consul.
--
-- The office is elected, not appointed. That is not a workaround for
-- lacking government buy-in: the commercial consul began as an elected
-- office, chosen by a trading community abroad from among its own members,
-- and state appointment came later. This restores the older form.
--
-- The title is always rendered "Unofficial Consul - chosen by community
-- members for a 2-year term", never the bare word, because "consul" has
-- legal meaning and nobody here is appointed by a state.
--
-- Scoped to place-origin networks only. A consul represents a geography to
-- a geography; "Tamil speakers in Ohio" has no government on either end
-- and no business holding this office.
--
-- Entirely additive. Nothing existing is altered, and nothing outside
-- /outposts links to any of it.

create table elections (
  id bigint generated always as identity primary key,
  -- The from->to pairing. A network IS a consular district, so this is
  -- both the constituency and the electoral roll.
  network_id bigint not null references networks(id) on delete cascade,
  -- Frozen roll. Anyone who joined the network after nominations opened
  -- may watch but not vote: without this, the cheapest attack on a small
  -- election is to recruit voters once you know who is standing.
  roll_cutoff timestamptz not null,
  nominations_close_at timestamptz not null,
  voting_opens_at timestamptz not null,
  voting_closes_at timestamptz not null,
  term_months int not null default 24,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint election_windows_ordered check (
    roll_cutoff <= nominations_close_at
    and nominations_close_at <= voting_opens_at
    and voting_opens_at < voting_closes_at
  )
);
create index elections_network_idx on elections (network_id);
-- One live election per network at a time.
create unique index elections_one_live_idx on elections (network_id)
  where cancelled_at is null;

create table election_candidates (
  id bigint generated always as identity primary key,
  election_id bigint not null references elections(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  -- Why they are standing, and their stated connection to the community.
  -- Ties are declared and public precisely because this is the office
  -- someone would want in order to watch a diaspora.
  statement text not null,
  ties text,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index election_candidates_election_idx on election_candidates (election_id);
create unique index election_candidates_one_live_idx
  on election_candidates (election_id, user_id) where withdrawn_at is null;

-- Ballots are secret; totals are public. RLS below lets a voter see only
-- their own row, and the tally function reports counts without exposing
-- who voted for whom. In a community where everyone knows everyone, an
-- open ballot is an invitation to pressure.
create table election_votes (
  id bigint generated always as identity primary key,
  election_id bigint not null references elections(id) on delete cascade,
  candidate_id bigint not null references election_candidates(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  -- With one candidate this is a confirmation vote - yes or no - rather
  -- than an unopposed walk-in. A 60/40 yes is information; acclamation is
  -- not.
  support boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index election_votes_one_per_voter_idx on election_votes (election_id, voter_id);

alter table elections enable row level security;
alter table election_candidates enable row level security;
alter table election_votes enable row level security;

create policy "elections are publicly readable" on elections for select using (true);
create policy "candidates are publicly readable" on election_candidates
  for select using (withdrawn_at is null);
-- Deliberately narrow: you may confirm your own ballot, and nothing else.
create policy "voters can see their own ballot" on election_votes
  for select using (auth.uid() = voter_id);

-- Writes all go through functions below, so the eligibility rules live in
-- one place rather than being restated as policies that can drift apart.
grant select on elections, election_candidates to anon, authenticated;
grant select on election_votes to authenticated;
grant select, insert, update, delete on elections to service_role;
grant select, insert, update, delete on election_candidates to service_role;
grant select, insert, update, delete on election_votes to service_role;
grant usage, select on sequence elections_id_seq to service_role;
grant usage, select on sequence election_candidates_id_seq to service_role;
grant usage, select on sequence election_votes_id_seq to service_role;

-- Only a member of the community may open its election. That is the
-- cheapest honest gate against drive-by elections for places the creator
-- has nothing to do with, and it needs no moderation queue.
create or replace function open_election(
  p_network_id bigint,
  p_nomination_days int default 14,
  p_voting_days int default 7
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'sign in to open an election';
  end if;
  if not exists (
    select 1 from network_members
    where network_id = p_network_id and user_id = auth.uid()
  ) then
    raise exception 'only a member of this network can open its election';
  end if;
  if not exists (
    select 1 from networks where id = p_network_id and origin_place_id is not null
  ) then
    raise exception 'this office is only for place-to-place networks';
  end if;
  if exists (select 1 from elections where network_id = p_network_id and cancelled_at is null) then
    raise exception 'this network already has an election';
  end if;

  insert into elections (
    network_id, roll_cutoff, nominations_close_at, voting_opens_at, voting_closes_at, created_by
  ) values (
    p_network_id,
    v_now,
    v_now + make_interval(days => p_nomination_days),
    v_now + make_interval(days => p_nomination_days),
    v_now + make_interval(days => p_nomination_days + p_voting_days),
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function nominate_for_election(
  p_election_id bigint,
  p_statement text,
  p_ties text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election elections;
  v_id bigint;
begin
  select * into v_election from elections where id = p_election_id and cancelled_at is null;
  if v_election is null then raise exception 'no such election'; end if;
  if now() > v_election.nominations_close_at then raise exception 'nominations have closed'; end if;
  if auth.uid() is null then raise exception 'sign in to stand'; end if;
  -- Standing requires being on the frozen roll, not merely a member now.
  if not exists (
    select 1 from network_members
    where network_id = v_election.network_id
      and user_id = auth.uid()
      and joined_at <= v_election.roll_cutoff
  ) then
    raise exception 'only members who joined before nominations opened can stand';
  end if;
  if coalesce(trim(p_statement), '') = '' then raise exception 'a statement is required'; end if;

  insert into election_candidates (election_id, user_id, statement, ties)
  values (p_election_id, auth.uid(), trim(p_statement), nullif(trim(p_ties), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function cast_election_vote(
  p_election_id bigint,
  p_candidate_id bigint,
  p_support boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election elections;
begin
  select * into v_election from elections where id = p_election_id and cancelled_at is null;
  if v_election is null then raise exception 'no such election'; end if;
  if now() < v_election.voting_opens_at then raise exception 'voting has not opened'; end if;
  if now() > v_election.voting_closes_at then raise exception 'voting has closed'; end if;
  if auth.uid() is null then raise exception 'sign in to vote'; end if;
  if not exists (
    select 1 from network_members
    where network_id = v_election.network_id
      and user_id = auth.uid()
      and joined_at <= v_election.roll_cutoff
  ) then
    raise exception 'only members who joined before nominations opened can vote';
  end if;
  if not exists (
    select 1 from election_candidates
    where id = p_candidate_id and election_id = p_election_id and withdrawn_at is null
  ) then
    raise exception 'no such candidate in this election';
  end if;

  insert into election_votes (election_id, candidate_id, voter_id, support)
  values (p_election_id, p_candidate_id, auth.uid(), p_support);
end;
$$;

-- Counts without ballots. Security definer so totals are visible while the
-- votes table itself stays unreadable.
create or replace function election_tally(p_election_id bigint)
returns table(candidate_id bigint, votes_for bigint, votes_against bigint)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    count(v.id) filter (where v.support) as votes_for,
    count(v.id) filter (where not v.support) as votes_against
  from election_candidates c
  left join election_votes v on v.candidate_id = c.id
  where c.election_id = p_election_id and c.withdrawn_at is null
  group by c.id
  order by votes_for desc, c.id;
$$;

-- Roll size and turnout are published alongside every result, so a thin
-- mandate reads as thin rather than as authority.
create or replace function election_roll(p_election_id bigint)
returns table(roll_size bigint, turnout bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from network_members m
       join elections e on e.id = p_election_id
      where m.network_id = e.network_id and m.joined_at <= e.roll_cutoff),
    (select count(distinct v.voter_id) from election_votes v where v.election_id = p_election_id);
$$;

grant execute on function open_election(bigint, int, int) to authenticated;
grant execute on function nominate_for_election(bigint, text, text) to authenticated;
grant execute on function cast_election_vote(bigint, bigint, boolean) to authenticated;
grant execute on function election_tally(bigint) to anon, authenticated;
grant execute on function election_roll(bigint) to anon, authenticated;

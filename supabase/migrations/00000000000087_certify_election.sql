-- Give an election an ending.
--
-- 00000000000086 shipped voting without a close-out: the window expired
-- and nothing happened. No winner, no term, no consul on the directory -
-- the whole point of the exercise simply failed to occur.
--
-- Certification is idempotent and callable by anyone, because the
-- alternative is a scheduled job this project has no infrastructure for,
-- or a human remembering. The election page calls it on render once voting
-- has closed, so the first person to look after the deadline settles it.
-- There is nothing to abuse: the result is computed from votes already
-- cast, and calling it twice changes nothing.

alter table elections add column certified_at timestamptz;
-- Null winner with certified_at set means "settled, nobody won" - a tie,
-- an empty field, or a confirmation vote that failed. That is a real
-- outcome and has to be distinguishable from "not yet counted".
alter table elections add column winning_candidate_id bigint references election_candidates(id);
alter table elections add column outcome text
  check (outcome in ('elected', 'tied', 'no_candidates', 'rejected'));

create or replace function certify_election(p_election_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election elections;
  v_count int;
  v_top record;
  v_runner_up int;
  v_outcome text;
  v_winner bigint;
  v_outpost_id bigint;
  v_principal_id bigint;
  v_network networks;
begin
  select * into v_election from elections
   where id = p_election_id and cancelled_at is null;
  if v_election is null then return 'no_such_election'; end if;
  if now() <= v_election.voting_closes_at then return 'still_open'; end if;
  if v_election.certified_at is not null then return v_election.outcome; end if;

  select count(*) into v_count from election_candidates
   where election_id = p_election_id and withdrawn_at is null;

  if v_count = 0 then
    v_outcome := 'no_candidates';
  else
    select c.id,
           count(v.id) filter (where v.support) as votes_for,
           count(v.id) filter (where not v.support) as votes_against
      into v_top
      from election_candidates c
      left join election_votes v on v.candidate_id = c.id
     where c.election_id = p_election_id and c.withdrawn_at is null
     group by c.id
     order by votes_for desc
     limit 1;

    if v_count = 1 then
      -- A lone candidate stands for confirmation, so more against than for
      -- is a genuine rejection rather than a win by default.
      if v_top.votes_for > v_top.votes_against then
        v_outcome := 'elected';
        v_winner := v_top.id;
      else
        v_outcome := 'rejected';
      end if;
    else
      select count(*) into v_runner_up
        from (
          select count(v.id) filter (where v.support) as votes_for
            from election_candidates c
            left join election_votes v on v.candidate_id = c.id
           where c.election_id = p_election_id and c.withdrawn_at is null
           group by c.id
        ) tallies
       where tallies.votes_for = v_top.votes_for;

      -- A tie is left unresolved on purpose. Breaking it by id, or by who
      -- stood first, would be inventing a mandate nobody voted for.
      if v_runner_up > 1 then
        v_outcome := 'tied';
      else
        v_outcome := 'elected';
        v_winner := v_top.id;
      end if;
    end if;
  end if;

  update elections
     set certified_at = now(), outcome = v_outcome, winning_candidate_id = v_winner
   where id = p_election_id;

  if v_outcome <> 'elected' then
    return v_outcome;
  end if;

  -- An elected consul needs somewhere to be listed. The outpost is the
  -- from->to pairing, which the network already describes, so both it and
  -- its principal are created on demand rather than required up front.
  select * into v_network from networks where id = v_election.network_id;

  select id into v_principal_id from principals where place_id = v_network.origin_place_id;
  if v_principal_id is null then
    insert into principals (kind, name, place_id)
    select p.type::text, p.name, p.id from places p where p.id = v_network.origin_place_id
    returning id into v_principal_id;
  end if;

  select id into v_outpost_id from outposts
   where principal_id = v_principal_id
     and host_place_id = v_network.location_place_id
     and kind = 'honorary';
  if v_outpost_id is null then
    insert into outposts (principal_id, host_place_id, kind, status)
    values (v_principal_id, v_network.location_place_id, 'honorary', 'claimed')
    returning id into v_outpost_id;
  end if;

  -- Not 'accredited': nobody has been appointed by a government. The
  -- directory must not imply otherwise.
  insert into outpost_officers (outpost_id, user_id, role, title, appointed_at)
  select v_outpost_id, c.user_id, 'honorary_consul',
         'Unofficial Consul', now()
    from election_candidates c
   where c.id = v_winner
  on conflict do nothing;

  return v_outcome;
end;
$$;

grant execute on function certify_election(bigint) to anon, authenticated;

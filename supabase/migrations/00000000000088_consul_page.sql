-- Give an elected consul something to hold, and give a term an end.
--
-- Two gaps left by 00000000000086 and 00000000000087:
--
-- 1. An elected consul had nowhere to be. The directory listed their
--    name in a table cell and that was the entire office.
-- 2. A "2-year term" had no expiry anywhere. outpost_officers records
--    appointed_at and revoked_at; term_months lives on the election,
--    which is not linked to the officer row. So the first consul was a
--    consul for life, which is the opposite of the legitimacy the
--    election was for.
--
-- The renewal rule is the one the community chose: hold a new election at
-- term end, and if nobody challenges, the incumbent stays. Generalised to
-- a single rule - ANY outcome that would leave the seat empty, when there
-- is a sitting incumbent, becomes 'incumbent_continues'. A vacancy is
-- worse than an unchallenged incumbent, so a tie, an empty field, and a
-- lone challenger the community rejects all leave the incumbent in place
-- rather than emptying the office.
--
-- Removal is deliberately NOT an election outcome. outpost_officers has
-- revoked_at and revocation_reason for that, admin-side, because a
-- community that wants someone gone can also simply elect someone else.

-- A page the consul writes. Narrow on purpose: who the community is and
-- how to reach them. Nothing shaped like issuing documents, letters, or
-- statements on behalf of a place - that is where an unofficial office
-- starts sounding official, and the disclaimer stops being believed.
alter table outposts add column about text;
alter table outposts add column contact text;
alter table outposts add column page_updated_at timestamptz;

-- Null means no fixed end (the historical Xiamen mission, or an officer
-- recorded outside an election).
alter table outpost_officers add column term_ends_at timestamptz;
-- Which election put them there, so a term can be traced to its mandate.
alter table outpost_officers add column election_id bigint references elections(id);

create index outpost_officers_serving_idx on outpost_officers (outpost_id)
  where revoked_at is null;

-- No policy or grant change is needed for the new columns: 84 granted
-- table-level select on outpost_officers, which covers columns added
-- later. A term with a public end date is the point, so the existing
-- "current officers are publicly readable" policy is already right.

/**
 * The serving consul edits their own page. Nobody else does.
 *
 * security definer because outposts has no update policy at all and is
 * not getting one: the only permitted update is this one, by this person,
 * on these three columns.
 */
create or replace function update_outpost_page(
  p_outpost_id bigint,
  p_about text default null,
  p_contact text default null,
  p_website text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sign in to edit this page'; end if;

  -- An expired term loses the page with it, which is why term_ends_at is
  -- checked and not merely displayed.
  if not exists (
    select 1 from outpost_officers
    where outpost_id = p_outpost_id
      and user_id = auth.uid()
      and revoked_at is null
      and (term_ends_at is null or term_ends_at > now())
  ) then
    raise exception 'only the serving consul can edit this page';
  end if;

  update outposts
     set about = nullif(trim(coalesce(p_about, '')), ''),
         contact = nullif(trim(coalesce(p_contact, '')), ''),
         website = nullif(trim(coalesce(p_website, '')), ''),
         page_updated_at = now()
   where id = p_outpost_id;
end;
$$;

grant execute on function update_outpost_page(bigint, text, text, text) to authenticated;

/**
 * Certification, now with terms and incumbents.
 *
 * Replaces 00000000000087's version. The counting is unchanged; what is
 * new is that an elected consul gets a term_ends_at, a replaced consul is
 * stood down, and a seat that would fall empty keeps its incumbent.
 */
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
  v_winner_user uuid;
  v_outpost_id bigint;
  v_principal_id bigint;
  v_network networks;
  v_incumbent outpost_officers;
begin
  select * into v_election from elections
   where id = p_election_id and cancelled_at is null;
  if v_election is null then return 'no_such_election'; end if;
  if now() <= v_election.voting_closes_at then return 'still_open'; end if;
  if v_election.certified_at is not null then return v_election.outcome; end if;

  select * into v_network from networks where id = v_election.network_id;

  -- The seat this election is for, if it exists yet, and whoever is
  -- sitting in it. Both are optional: a first election has neither.
  select id into v_principal_id from principals where place_id = v_network.origin_place_id;
  if v_principal_id is not null then
    select id into v_outpost_id from outposts
     where principal_id = v_principal_id
       and host_place_id = v_network.location_place_id
       and kind = 'honorary';
  end if;
  if v_outpost_id is not null then
    select * into v_incumbent from outpost_officers
     where outpost_id = v_outpost_id and revoked_at is null
     order by appointed_at desc
     limit 1;
  end if;

  select count(*) into v_count from election_candidates
   where election_id = p_election_id and withdrawn_at is null;

  if v_count = 0 then
    v_outcome := 'no_candidates';
  else
    select c.id, c.user_id,
           count(v.id) filter (where v.support) as votes_for,
           count(v.id) filter (where not v.support) as votes_against
      into v_top
      from election_candidates c
      left join election_votes v on v.candidate_id = c.id
     where c.election_id = p_election_id and c.withdrawn_at is null
     group by c.id, c.user_id
     order by votes_for desc
     limit 1;

    if v_count = 1 then
      -- An incumbent standing unopposed is a renewal, not a confirmation
      -- vote: nobody challenged, and requiring the community to turn out
      -- to keep the lights on just risks an empty office.
      if v_incumbent.user_id is not null and v_top.user_id = v_incumbent.user_id then
        v_outcome := 'incumbent_continues';
      elsif v_top.votes_for > v_top.votes_against then
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

      -- A tie is still left unresolved. Breaking it by id, or by who
      -- stood first, would be inventing a mandate nobody voted for.
      if v_runner_up > 1 then
        v_outcome := 'tied';
      else
        v_outcome := 'elected';
        v_winner := v_top.id;
      end if;
    end if;
  end if;

  -- Someone is better than no one: an outcome that elects nobody leaves a
  -- sitting incumbent in place rather than emptying the office.
  if v_outcome in ('no_candidates', 'tied', 'rejected') and v_incumbent.id is not null then
    v_outcome := 'incumbent_continues';
  end if;

  if v_outcome = 'incumbent_continues' then
    update outpost_officers
       set term_ends_at = greatest(coalesce(term_ends_at, now()), now())
                          + make_interval(months => v_election.term_months),
           election_id = p_election_id
     where id = v_incumbent.id;
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
  if v_principal_id is null then
    insert into principals (kind, name, place_id)
    select p.type::text, p.name, p.id from places p where p.id = v_network.origin_place_id
    returning id into v_principal_id;
  end if;

  if v_outpost_id is null then
    insert into outposts (principal_id, host_place_id, kind, status)
    values (v_principal_id, v_network.location_place_id, 'honorary', 'claimed')
    returning id into v_outpost_id;
  end if;

  -- A new consul means the previous one stands down. Recorded as a
  -- revocation with a reason rather than a deletion, so the succession
  -- stays readable.
  if v_incumbent.id is not null then
    update outpost_officers
       set revoked_at = now(), revocation_reason = 'term ended; successor elected'
     where id = v_incumbent.id;
  end if;

  -- Not 'accredited': nobody has been appointed by a government. The
  -- directory must not imply otherwise.
  insert into outpost_officers (
    outpost_id, user_id, role, title, appointed_at, term_ends_at, election_id
  )
  select v_outpost_id, c.user_id, 'honorary_consul', 'Unofficial Consul',
         now(), now() + make_interval(months => v_election.term_months), p_election_id
    from election_candidates c
   where c.id = v_winner
  on conflict do nothing;

  return v_outcome;
end;
$$;

grant execute on function certify_election(bigint) to anon, authenticated;

-- 'incumbent_continues' is a real outcome and has to be storable.
alter table elections drop constraint if exists elections_outcome_check;
alter table elections add constraint elections_outcome_check
  check (outcome in ('elected', 'tied', 'no_candidates', 'rejected', 'incumbent_continues'));

-- Backfill: the only officers that exist are from certify_election, which
-- until now set no term. Leaving them null would mean "no fixed end",
-- which is exactly the bug this migration is about.
update outpost_officers o
   set term_ends_at = o.appointed_at + make_interval(months => 24)
 where o.term_ends_at is null
   and o.revoked_at is null
   and o.role = 'honorary_consul';

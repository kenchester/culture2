-- Let an institution hand someone a link into a community, without ever
-- recording who it handed it to.
--
-- The need: a resettlement agency is funded for roughly 90 days of case
-- management, then the client is cut loose and the agency has no way to
-- keep serving them. A link into the corridor they belong to is a handoff
-- that outlives the case. The agency wants a number for its reporting;
-- the client must not become a row in a list of "clients of the refugee
-- agency", which is a sensitive attribute entirely on its own.
--
-- So attribution is a COUNTER, not a join table. There is deliberately no
-- column anywhere linking a user to the institution that referred them.
-- This does not hide anything from the agency - they met the person - it
-- means CultureMesh cannot produce that list, for anyone, ever, including
-- under legal process. "It was never stored that way" is only true if you
-- build it that way first.
--
-- Separate from organizations on purpose. That table is school-shaped:
-- subdomain is not null unique and domain exists for matching institutional
-- email. A resettlement agency has no subdomain and issues nobody an email
-- address - its clients arrive with whatever address they already have, or
-- none. Forcing the two together is how a table ends up with six nullable
-- columns that matter for one kind of row.

create table institutions (
  id bigint generated always as identity primary key,
  name text not null,
  kind text not null check (
    kind in (
      'resettlement_agency', 'association', 'faith', 'library',
      'clinic', 'school_office', 'city_office', 'other'
    )
  ),
  -- Where it works. A referral link is almost always local to one city.
  place_id bigint references places(id),
  contact_email text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index institutions_place_idx on institutions (place_id);

create table institution_staff (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institutions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  added_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index institution_staff_live_idx
  on institution_staff (institution_id, user_id) where revoked_at is null;

-- Reusable by design. A caseworker gives the same link to everyone they
-- see that month - often read aloud or printed, because a client may have
-- no email yet and creating one is frequently what the caseworker helps
-- with. Single-use, email-bound invites (00000000000043) fail exactly the
-- population this is for.
create table corridor_invites (
  id bigint generated always as identity primary key,
  institution_id bigint not null references institutions(id) on delete cascade,
  network_id bigint not null references networks(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  -- A label for staff only ("October arrivals"), never shown to the
  -- person accepting.
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  -- Null means no limit; the counter exists only to enforce max_uses.
  expires_at timestamptz,
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  revoked_at timestamptz
);
create index corridor_invites_institution_idx on corridor_invites (institution_id);

-- The whole of attribution. Institution x network x month, and a count.
-- No user_id, by construction.
create table institution_referrals (
  institution_id bigint not null references institutions(id) on delete cascade,
  network_id bigint not null references networks(id) on delete cascade,
  month date not null,
  joined_count int not null default 0,
  primary key (institution_id, network_id, month)
);

alter table institutions enable row level security;
alter table institution_staff enable row level security;
alter table corridor_invites enable row level security;
alter table institution_referrals enable row level security;

-- The accept page has to name who is inviting you, so this much is public.
create policy "institutions are publicly readable" on institutions
  for select using (archived_at is null);

-- Not public: who works for a resettlement agency is nobody else's
-- business, and the staff list is the one place a person could be inferred.
create policy "staff can see their own membership" on institution_staff
  for select using (auth.uid() = user_id and revoked_at is null);

-- Deliberately no select policy for corridor_invites. A token is a secret;
-- granting select would allow enumeration, so the accept page resolves a
-- token through corridor_invite_preview() instead.
create policy "staff can see their institution's invites" on corridor_invites
  for select using (
    exists (
      select 1 from institution_staff s
      where s.institution_id = corridor_invites.institution_id
        and s.user_id = auth.uid()
        and s.revoked_at is null
    )
  );

create policy "staff can see their institution's counts" on institution_referrals
  for select using (
    exists (
      select 1 from institution_staff s
      where s.institution_id = institution_referrals.institution_id
        and s.user_id = auth.uid()
        and s.revoked_at is null
    )
  );

/**
 * Public-safe view of a token: enough to decide whether to accept, and
 * nothing more. Returns no row for an invalid, revoked, expired or
 * exhausted token, so a wrong link cannot be told apart from a made-up one.
 */
create or replace function corridor_invite_preview(p_token uuid)
returns table (
  institution_name text,
  institution_kind text,
  network_id bigint,
  network_title text
)
language sql
security definer
set search_path = public
as $$
  select i.name, i.kind, n.id, n.title
    from corridor_invites ci
    join institutions i on i.id = ci.institution_id
    join networks n on n.id = ci.network_id
   where ci.token = p_token
     and ci.revoked_at is null
     and i.archived_at is null
     and (ci.expires_at is null or ci.expires_at > now())
     and (ci.max_uses is null or ci.uses < ci.max_uses);
$$;

/**
 * Join the community a link points at.
 *
 * Refuses any network that an organisation gates (00000000000078). Without
 * that check a referral link would be a way to hand a stranger read access
 * to a school's private network, which is the one thing this must never
 * become.
 *
 * The count is incremented only when a membership row is actually created,
 * so re-opening the link is not a second referral - which also means
 * deduplication needs no per-person record.
 */
create or replace function accept_corridor_invite(p_token uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite corridor_invites;
  v_inserted int;
begin
  if auth.uid() is null then raise exception 'sign in to join'; end if;

  select * into v_invite from corridor_invites
   where token = p_token
     and revoked_at is null
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses < max_uses);
  if v_invite is null then raise exception 'this link is not valid'; end if;

  if exists (select 1 from institutions where id = v_invite.institution_id and archived_at is not null) then
    raise exception 'this link is not valid';
  end if;

  if exists (select 1 from organization_languages where network_id = v_invite.network_id) then
    raise exception 'this link cannot be used for a private network';
  end if;

  insert into network_members (network_id, user_id)
  values (v_invite.network_id, auth.uid())
  on conflict (network_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update corridor_invites set uses = uses + 1 where id = v_invite.id;

    -- Month-bucketed so the agency can report a quarter without anything
    -- per-person existing to report on.
    insert into institution_referrals (institution_id, network_id, month, joined_count)
    values (v_invite.institution_id, v_invite.network_id, date_trunc('month', now())::date, 1)
    on conflict (institution_id, network_id, month)
    do update set joined_count = institution_referrals.joined_count + 1;
  end if;

  return v_invite.network_id;
end;
$$;

grant select on institutions to anon, authenticated;
grant select on institution_staff, corridor_invites, institution_referrals to authenticated;
grant execute on function corridor_invite_preview(uuid) to anon, authenticated;
grant execute on function accept_corridor_invite(uuid) to authenticated;

-- Staff manage their own invites; everything else is admin-side for now,
-- since institutions are vetted by hand rather than self-served.
grant insert, update on corridor_invites to authenticated;
create policy "staff can create invites for their institution" on corridor_invites
  for insert with check (
    exists (
      select 1 from institution_staff s
      where s.institution_id = corridor_invites.institution_id
        and s.user_id = auth.uid()
        and s.revoked_at is null
    )
    -- accept_corridor_invite refuses a gated network anyway, but an invite
    -- that could never work should not be creatable in the first place -
    -- a staff member would otherwise hand out a dead link and find out
    -- from the person who tried it.
    and not exists (
      select 1 from organization_languages ol
      where ol.network_id = corridor_invites.network_id
    )
  );
create policy "staff can revoke their institution's invites" on corridor_invites
  for update using (
    exists (
      select 1 from institution_staff s
      where s.institution_id = corridor_invites.institution_id
        and s.user_id = auth.uid()
        and s.revoked_at is null
    )
  );

grant usage, select on sequence institutions_id_seq to service_role;
grant usage, select on sequence institution_staff_id_seq to service_role;
grant usage, select on sequence corridor_invites_id_seq to service_role;
grant select, insert, update, delete on institutions to service_role;
grant select, insert, update, delete on institution_staff to service_role;
grant select, insert, update, delete on corridor_invites to service_role;
grant select, insert, update, delete on institution_referrals to service_role;

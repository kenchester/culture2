# CultureMesh 2.0 — Rebuild Plan (validated)

This supersedes `5Aug2026_culturemesh-rebuild-plan_2.md`. That draft claimed to be "confirmed by reading the live code, not assumed" — this version actually was: every feature claim below was checked against `htdocs/` (the live PHP) and `5Aug2026_culturp7_ktc.sql` (the live database dump), with file:line citations where it mattered. One claim in the draft did not survive that check, two real features were missing from it entirely, and three open questions from the draft were resolved by the site owner. See **§0** for what changed and why.

---

## 0. Corrections vs. the draft plan

1. **The "embassy embed" feature was not a legacy feature.** The draft asserted an existing iframe/widget with jurisdiction-locking was "the actual distribution mechanism that gave this site its real-world traction." There is no `embed_partners` table, no embed/widget code, no jurisdiction logic anywhere in `htdocs` or the SQL dump. The only "embassy" string in the entire codebase and database is the title of one user's meetup event. Per the site owner: the real history is that Indonesia's embassy simply linked to CultureMesh's per-state network pages with plain URLs — no embed ever existed. The *idea* of a white-labeled, jurisdiction-locked embed is a genuine v2 upgrade the owner wants, but it's being built honestly as new scope, not restored as lost functionality — see §6.
2. **Private messaging was missing from the draft entirely.** `conversations`/`messages` tables and a working backend (`lib/dobj/Conversation.php`, `data/dal_message.php`, `start_conversation.php`) exist in the legacy code, but the only UI entry point is commented out (`profile_edit_pg_body.php:290`) and the include file itself has a broken PHP opening tag. It shipped code, never shipped a feature. The owner wants it finished properly in v2 — now a first-class feature, §1 and §3.
3. **Twitter/tweet aggregation is more deeply embedded than the draft implied**, wired directly into the core network page template with its own pagination, scoping, and reply system. The owner confirmed: drop it. No replacement.
4. Two more real, live legacy features the draft never mentioned are folded in below: per-user **notification preferences** and the **suggested-network** submission/review flow.

---

## 1. What CultureMesh actually is (feature inventory, validated)

- **Diaspora networks** are defined by an (origin, location) pair — e.g. "Indonesian speakers in Michigan." Origin is a `Language` or geography at any tier; location is always geography (city/region/country), never a language.
- **Search** takes an origin + location, matches existing networks, and separately surfaces "possible" networks (a valid combination nobody's created yet) and "related" networks (broader/narrower matches). Confirmed the legacy implementation of "related" is three separate flat proximity tables (`nearby_cities`, `nearby_regions`, `nearby_countries`), each joined via a class-name switch in `lib/search/NearbyLocationSearch.php` — real code, and exactly the kind of per-tier duplication the v2 `places` hierarchy (§3) replaces with one recursive query.
- **Launch flow**: a "possible" network becomes real the moment someone joins it.
- **Membership**: users join networks; member/post counts shown per network.
- **Posts**: lightweight feed per network (text, optional image/video link). No Twitter aggregation in v2 (dropped, confirmed above).
- **Events**: hosted per network, with RSVP/attendee tracking.
- **Private messaging**: 1:1 conversations between users. Built but never shipped in legacy (§0.2) — a real, finished feature in v2.
- **Notification preferences**: confirmed live in legacy (`profile_accounts_tab_include.php`, `update_notifications.php`, `user_notifications` table) — four toggles: upcoming events, events you're interested in, network activity, and product/company updates.
- **Suggested networks**: confirmed live end-to-end in legacy (`suggestNetwork.php` → `SuggestedNetwork::Save()` → `suggested_networks` table → reviewed in the admin panel). A user can suggest a network combination that doesn't exist yet; staff review and can launch it.
- **Auth**: email + password, MD5-hashed(!), email confirmation via a mailed activation code, forgot-password via a mailed reset code, session-based login. Confirmed via `r.php:129-131`, `l.php:86`, `confirmation.php`, `forgotpass-email.php`, `forgotpass-change.php`.
- **Profile**: name, bio, uploaded profile picture, dashboard showing hosted events / network events / own posts.
- **Admin panel**: confirmed scope — users, networks, careers listings, press posts, team bios, suggested-network review. Per the original brief, the team page/bios are dropped from the public site in v2 (design modernization), but careers and press stay as real marketing-site content management.
- **Embassy/partner white-label embed**: a genuine new capability for v2, not a rediscovered legacy one — see §6 for the honest scope.

---

## 2. Target stack

| Layer | Legacy | New |
|---|---|---|
| App framework | Raw PHP, custom router (AltoRouter — confirmed via `composer.json` and `network/index.php:11-27`), Mustache templates (confirmed via `lib/misc/MustacheComponent.php`) | Next.js 15 (App Router), TypeScript, React Server Components |
| Hosting | Bluehost shared hosting (Apache/mod_php) | Vercel |
| Database | MySQL via hand-rolled `Do2Db` query builder | Supabase (Postgres) |
| Auth | Custom session + MD5 passwords + mailed codes | Supabase Auth (email/password + magic link), RLS-backed |
| Email | PHP `mail()`, no SPF/DKIM | Resend, with Supabase Auth's SMTP hook pointed at Resend |
| File storage | Filesystem + broken hardcoded paths (`home3` references confirmed in `environment.php`, `profile_img_upload.php`) | Supabase Storage (public bucket + signed uploads) |
| Search | Manual polymorphic-class query building; three parallel flat proximity tables for "nearby" matching | Normalized Postgres tables + `pg_trgm` fuzzy matching + recursive CTEs over `places` |
| Messaging | Built, never shipped (disabled UI, broken include) | Real feature: Supabase Realtime-backed conversations |
| Realtime | None (full page reloads / manual AJAX polling) | Supabase Realtime (live post feed, RSVP counts, message delivery) |
| Background jobs | None (counts computed inline per request) | Supabase Edge Functions + `pg_cron`, Vercel Cron for email digests |
| CI/CD | Manual FTP/cPanel file edits | GitHub Actions + Vercel preview deployments per PR |
| Repo/migrations | None — no version control on the live site | GitHub, Supabase CLI migrations checked into the repo |

---

## 3. Data model (Supabase/Postgres)

Core geography/network model is unchanged from the draft — that part was sound and is now additionally justified by the `nearby_*`/`search_keys` findings in §1. Reproduced here with the additions this revision makes (messaging, notification prefs, suggested networks, revised embed partners).

```sql
create type place_type as enum ('country', 'region', 'city');

create table places (
  id bigint generated always as identity primary key,
  parent_id bigint references places(id),
  type place_type not null,
  name text not null,
  lat double precision,
  lng double precision
);
create index places_parent_idx on places (parent_id);
create index places_type_idx on places (type);

-- A trigger, not a CHECK constraint, because validating parent type requires
-- looking at another row: countries have no parent; regions' parent must be
-- a country; cities' parent must be a country or a region.
create or replace function enforce_place_hierarchy() returns trigger as $$
declare
  parent_type place_type;
begin
  if new.type = 'country' then
    if new.parent_id is not null then
      raise exception 'a country cannot have a parent';
    end if;
    return new;
  end if;

  select type into parent_type from places where id = new.parent_id;
  if parent_type is null then
    raise exception 'non-country places must have a parent';
  end if;

  if new.type = 'region' and parent_type != 'country' then
    raise exception 'a region''s parent must be a country';
  end if;

  if new.type = 'city' and parent_type not in ('country', 'region') then
    raise exception 'a city''s parent must be a country or a region';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger places_hierarchy_check
  before insert or update on places
  for each row execute function enforce_place_hierarchy();

create table languages (
  id bigint generated always as identity primary key,
  name text not null unique
);

-- Users (auth.users is managed by Supabase Auth; this is the public profile)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  first_name text,
  last_name text,
  about_me text,
  img_path text, -- Supabase Storage object path, not a filesystem path
  created_at timestamptz not null default now()
);

-- Networks: origin is EITHER a language OR a place at any tier (never both);
-- location is ALWAYS a place at any tier, and is never a language.
create table networks (
  id bigint generated always as identity primary key,
  language_id bigint references languages(id),
  origin_place_id bigint references places(id),
  location_place_id bigint not null references places(id),
  title text not null,
  member_count int not null default 0,
  post_count int not null default 0,
  launched_at timestamptz not null default now(),
  launched_by uuid references profiles(id),
  constraint exactly_one_origin check (
    (language_id is not null and origin_place_id is null) or
    (language_id is null and origin_place_id is not null)
  )
);
create unique index networks_unique_triple on networks (
  coalesce(language_id, -1),
  coalesce(origin_place_id, -1),
  location_place_id
);

create table network_members (
  network_id bigint not null references networks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (network_id, user_id)
);

create table posts (
  id bigint generated always as identity primary key,
  network_id bigint not null references networks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  img_path text,
  video_url text,
  created_at timestamptz not null default now()
);

create table post_replies (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table events (
  id bigint generated always as identity primary key,
  network_id bigint not null references networks(id) on delete cascade,
  host_id uuid not null references profiles(id),
  title text not null,
  description text,
  event_date timestamptz not null,
  location text,
  created_at timestamptz not null default now()
);

create table event_rsvps (
  event_id bigint not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'going' check (status in ('going','interested','declined')),
  primary key (event_id, user_id)
);

-- Private messaging (new: legacy had the backend but never shipped the UI)
create table conversations (
  id bigint generated always as identity primary key,
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ordered_pair check (user_a < user_b),
  unique (user_a, user_b)
);
-- user_a < user_b enforces one canonical row per pair. The legacy schema had
-- no such constraint on (id_user1, id_user2), so nothing stopped a duplicate
-- conversation being created in reversed order.

create table messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at);

-- Notification preferences (confirmed live in legacy as four toggles)
create table notification_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  events_upcoming boolean not null default true,
  events_interested_in boolean not null default true,
  network_activity boolean not null default true,
  product_updates boolean not null default true
);

-- Suggested networks (confirmed live: user submits, staff reviews/launches)
create table suggested_networks (
  id bigint generated always as identity primary key,
  suggested_by uuid references profiles(id),
  origin_text text not null,
  location_text text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- Embassy/partner white-label embeds (new capability — see §6)
create table embed_partners (
  id bigint generated always as identity primary key,
  name text not null,                                    -- e.g. "Embassy of Indonesia"
  slug text not null unique,                              -- used in the embed URL
  locked_language_id bigint references languages(id),
  locked_origin_place_id bigint references places(id),
  hide_origin_label boolean not null default true,
  created_at timestamptz not null default now(),
  constraint at_most_one_locked_origin check (
    locked_language_id is null or locked_origin_place_id is null
  )
);

-- A partner's jurisdiction can be more than one root (an embassy may also
-- cover a nearby smaller country's diaspora within the same location UI).
-- Each row is a root; the recursive descendants of each root are in-scope.
create table embed_partner_jurisdictions (
  partner_id bigint not null references embed_partners(id) on delete cascade,
  place_id bigint not null references places(id),
  primary key (partner_id, place_id)
);
```

**Member/post counts**: replaced by a Postgres trigger keeping `networks.member_count`/`post_count` in sync, instead of the legacy pattern of every controller having to remember to call `getMemberCount()`/`getPostCount()` — the root cause of two of the bugs fixed prior to this rebuild (null counts on search results).

**"Possible" and "related" networks**: with a self-referencing `places` hierarchy, broader/narrower matching becomes a walk up or down `parent_id` — one recursive CTE, replacing the three-table `nearby_cities`/`nearby_regions`/`nearby_countries` split confirmed in the legacy code.

---

## 4. Auth & email

- **Signup/login**: Supabase Auth email/password. No MD5 (confirmed legacy used bare `md5()` for passwords, activation codes, and reset codes — Supabase Auth hashes correctly by default).
- **Email confirmation**: Supabase Auth's built-in confirmation flow replaces `act_code` + the mailed-code flow (`r.php`, `confirmation.php`).
- **Forgot password**: Supabase Auth's built-in reset-password flow replaces `fp_code` (`forgotpass-email.php`, `forgotpass-change.php`).
- **Custom SMTP**: Supabase Auth's outbound email routed through Resend (verified domain, SPF/DKIM/DMARC from day one).
- **Product email** (event reminders, weekly digest, new-message notifications, embassy admin notifications) via Resend + React Email, triggered from Vercel Cron / Supabase Edge Functions, respecting `notification_prefs`.
- **Row Level Security** replaces the legacy's per-page `if (isset($_SESSION['uid']))` checks — auth enforced at the database layer.

---

## 5. Repo, CI/CD, environments

```
culturemesh/
├── apps/
│   └── web/                     # Next.js app
│       ├── app/
│       │   ├── (auth)/sign-in, sign-up, confirm, reset-password
│       │   ├── (marketing)/about, careers, press, contact
│       │   ├── networks/[id]/
│       │   ├── profile/[id]/
│       │   ├── messages/[conversationId]/
│       │   ├── search/
│       │   ├── embed/[partnerSlug]/   # iframe-safe partner embed route
│       │   └── api/
│       ├── components/
│       ├── lib/
│       │   ├── supabase/ (client.ts, server.ts, middleware.ts)
│       │   └── email/ (React Email templates)
│       └── middleware.ts        # session refresh + RLS-aware auth
├── supabase/
│   ├── migrations/              # versioned schema, checked into git
│   ├── functions/                # Edge Functions (digest emails, count reconciliation)
│   └── seed.sql
├── packages/
│   └── embed-widget/            # standalone JS snippet for non-iframe embeds
└── .github/workflows/ci.yml
```

- **GitHub**: single repo, trunk-based, PRs required, branch protection on `main`.
- **Vercel**: connected to GitHub; every PR gets a preview deployment against a Supabase branch/preview database; `main` auto-deploys to production.
- **GitHub Actions**: typecheck, lint, unit tests, `supabase db lint` on every PR.
- **Environments**: `local` (Supabase CLI local stack), `preview` (per-PR), `production`. Secrets in Vercel env vars, never committed, enforced by a `zod`-validated `env.ts` that fails the build (not a random request) when something's missing — this directly targets the legacy's undefined-constant class of fatal errors (`DB_USER`, `HOME_PATH`, `META_AUTHOR`, `DOMAIN_URL`, confirmed in `environment.php`).

---

## 6. Embassy/partner white-label embed (new capability, honestly scoped)

**This is not a legacy feature being restored.** The real history: Indonesia's embassy linked to CultureMesh's per-state network pages with ordinary URLs. Nothing about jurisdiction-locking or embedding ever existed in code. What follows is new v2 scope, per the site owner's direction, and it's staff-managed rather than self-serve:

- CultureMesh staff create an `embed_partners` row in the admin panel for a given embassy/consulate: a locked origin (a language or a place — e.g. "Indonesia," hiding the origin selector and label entirely so the partner's page reads as their own), and one or more jurisdiction roots in `embed_partner_jurisdictions` (e.g. the embassy's home country, plus a smaller neighboring country it also serves — resolved via the same recursive `places` query used for "related networks").
- Staff hand the partner a URL (`/embed/[partnerSlug]`) — a clean, iframe-safe page with no CultureMesh nav chrome, showing only a location picker scoped to the partner's jurisdiction. No embassy-side login or dashboard in v1 — this directly resolves the draft's open question about multi-tenant embassy accounts: not needed, since CultureMesh staff configure it on the partner's behalf.
- A lightweight `<script>` embed (`packages/embed-widget`) is offered as a fallback for embassies whose sites don't allow iframes — same pattern as a YouTube/Calendly embed.
- **This phase comes after the core rebuild**, not alongside it — see the roadmap in §9.

---

## 7. Data migration from the legacy MySQL database

1. **Export**: dump `users`, `networks`, `network_registration`, `posts`, `events`, `event_registration`, `user_notifications`, `suggested_networks` from the live database. `conversations`/`messages` have zero rows — nothing to migrate, but the schema ships in v2 (§3).
2. **Transform**:
   - `users` → Supabase Auth users (admin API, pre-confirmed) + `profiles` row + `notification_prefs` row (mapped from the four legacy toggle columns, `company_news` → `product_updates`). Passwords cannot be migrated (MD5 isn't reversible) — every legacy account is flagged and sent a "we upgraded our security, please reset your password" email with a Supabase reset link on first login attempt.
   - Build the `places` tree first: every distinct legacy city/region gets a row, nested under a synthesized "United States" country row (legacy data is US-only even though the new schema isn't). Then `networks.origin_class`/`origin_id` and `location_class`/`location_id` resolve into `language_id`/`origin_place_id` and `location_place_id` against that tree.
   - `img_link` → download from the legacy server's `user_images` directory, re-upload into Supabase Storage, rewrite `profiles.img_path`.
   - `suggested_networks` (legacy free-text `city`/`region`/`language` columns) → migrate as-is into the new `suggested_networks.origin_text`/`location_text`, left `pending` for staff to re-review post-migration since the resolution logic changed.
   - `post_tweets`, `post_tweet_replies`, `network_tweet_query_data`, `tweet_query_adjustments` are **not migrated** — feature dropped.
3. **Verify**: row counts match; spot-check member/post counts against the trigger's recomputed values; confirm no orphaned `network_members` rows; confirm every migrated city/region resolves up to the synthesized US country row; confirm every user has exactly one `notification_prefs` row.
4. **Cutover**: point DNS at Vercel, keep the old Bluehost site up read-only for a short rollback window, then decommission.

---

## 8. Legacy bugs → why they can't recur

- **Undefined PHP constants causing fatal 500s** (`DB_USER`, `HOME_PATH`, `META_AUTHOR`, `DOMAIN_URL`, hardcoded `/home3/...` paths) → TypeScript + a validated env schema fails the *build*, not a user's request.
- **The `Do2Db` parameter-binding bug** (values silently mis-bound across candidate rows sharing a column name) → normalized schema, real foreign keys, Supabase's PostgREST client or Drizzle — no hand-built SQL string concatenation.
- **`get_class(null)` fatal under PHP 8** → TypeScript's null checking catches this at compile time.
- **Mail silently not sending** (no SPF/DKIM, malformed `xhr.open()` calls, broken image paths) → Resend + verified domain from day one, typed API calls instead of hand-rolled `XMLHttpRequest`.
- **A feature shipped as dead code** (private messaging: real backend, commented-out include, a broken `<php` opening tag that would have silently printed source instead of executing — this survived in the live codebase with nobody noticing) → PR review and CI (typecheck/lint/build) catch exactly this class of error before merge, not after it's been live for years.
- **Stale UI after back-navigation (bfcache)** → Next.js's cache/revalidation model and Supabase Realtime subscriptions replace manual `pageshow` listeners.
- **No version control on the live site at all** → GitHub from day one.

---

## 9. Phased roadmap

| Phase | Scope | Rough effort |
|---|---|---|
| 0 | Repo scaffolding, Vercel + Supabase + Resend wired together, domain/DNS/SPF/DKIM configured up front | 2–3 days |
| 1 | Schema + RLS policies + auth flows (signup, confirm, login, reset) | 1 week |
| 2 | `places` hierarchy + languages seed data, search, launch flow, member counts | 1.5–2 weeks |
| 3 | Profiles (incl. image upload), posts feed, replies, notification preferences, suggested-network form + admin review | 1.5 weeks |
| 4 | Events + RSVPs | 3–4 days |
| 5 | Private messaging (conversations, realtime delivery, unread state) | 1 week |
| 6 | Embassy/partner white-label embed + jurisdiction locking + admin partner management + public search API | 4–5 days |
| 7 | Data migration tooling + dry run against a copy of the legacy DB | 1 week |
| 8 | QA pass, accessibility/mobile pass, cutover | 3–5 days |

Total: roughly 8–10 weeks for one engineer working with Claude Code, assuming no major scope additions beyond what's listed above. Net effort vs. the earlier draft is close to a wash: dropping tweet aggregation removes real scope, finishing messaging properly adds real scope.

---

## 10. Extension points (not in scope for the core rebuild)

Rotating-savings/mutual-aid groups per network, embassy/ministry-facing analytics dashboards (Phase 6's public search API is the natural foundation), event-vendor marketplace, participatory-budgeting-style community funds. None require changes to the core schema — they're additive tables referencing `networks` and `profiles`.

---

## 11. Open decisions — resolved

1. ~~Drop the legacy Twitter/tweet aggregation feature, or rebuild it against a different platform's API?~~ **Resolved: drop it, no replacement.**
2. ~~Multi-tenant embassy admin accounts — in scope for v1?~~ **Resolved: no. CultureMesh staff configure each partner in the admin panel and hand them a URL; embassies get no login of their own in v1.**
3. ~~Should private messaging be part of v2?~~ **Resolved: yes — finish and ship it properly (§1, §3, Phase 5).**

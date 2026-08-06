# CultureMesh 2.0 — Rebuild Plan (Claude Code + GitHub + Vercel + Supabase + Resend)

This is a from-scratch reproduction plan for CultureMesh, built from direct inspection of the live legacy PHP codebase and database over the course of ~30 bug-fix tasks on the existing culturemesh.com website. It preserves the actual feature set and data model that exists today (not the brainstormed monetization ideas — those are noted as extension points at the end, not built into the core plan) and replaces every fragile part of the legacy stack with a modern equivalent. The design itself should be modernized as well, and unnecessary items like the team page can be dropped.

---

## 1. What CultureMesh actually is (feature inventory)

Confirmed by reading the live code, not assumed:

- **Diaspora networks** are defined by an (origin, location) pair — e.g. "Indonesian speakers in Michigan," or "Indonesians in Michigan." Origin can be either linguistic or geographic — the "speak" dropdown loads `Language`, the "from" dropdown loads geography at any tier. Location is always geography — a `City`, a `Region` (state/province), or a `Country` — and is never a language. This origin/location pairing is the core unit of the whole product.
- **Search** takes an origin + location, matches against networks that already exist, and separately computes "possible" networks (a valid combination nobody has created yet) and "related" networks (broader/narrower matches — e.g. no city-level network, but a state-level one exists).
- **Launch flow**: a "possible" network becomes real the moment someone joins it.
- **Membership**: users join networks; each network shows member count and post count.
- **Posts**: a lightweight feed per network (text posts, optional image/video link), plus legacy Twitter aggregation (post counts included `tweet_count` — a hashtag/keyword aggregation feature, likely worth dropping or replacing given the current state of the X API).
- **Events**: hosted per network, with RSVP/attendee tracking.
- **Auth**: email + password, MD5-hashed(!), email confirmation via a mailed activation code, forgot-password via a mailed reset code, session-based login.
- **Profile**: name, bio, uploaded profile picture, dashboard showing hosted events / network events / own posts.
- **Embassy/partner embed**: the actual distribution mechanism that gave this site its real-world traction — embassies (Indonesia's, for its 50-state diaspora networks) embedded CultureMesh search/network widgets directly on their own sites, with the origin locked to "Indonesia" and every US state hyperlinked as a location (Indonesians in Alabama, Indonesians in Alaska, and so on). Not US-specific in principle — any embassy or consulate should be able to lock origin to their own country and location to their own jurisdiction, at whatever geography tier makes sense for them. This is a first-class requirement, not an afterthought.

---

## 2. Target stack

| Layer | Legacy | New |
|---|---|---|
| App framework | Raw PHP, custom router (AltoRouter), Mustache templates | Next.js 15 (App Router), TypeScript, React Server Components |
| Hosting | Bluehost shared hosting (Apache/mod_php) | Vercel |
| Database | MySQL via hand-rolled `Do2Db` query builder | Supabase (Postgres) |
| Auth | Custom session + MD5 passwords + mailed codes | Supabase Auth (email/password + magic link), RLS-backed |
| Email | PHP `mail()` via `cm_email.php`, no SPF/DKIM | Resend, with Supabase Auth's SMTP hook pointed at Resend |
| File storage | Filesystem + broken hardcoded paths | Supabase Storage (public bucket + signed uploads) |
| Search | Manual polymorphic-class query building (the root cause of several of the bugs fixed this engagement) | Normalized Postgres tables + `pg_trgm` fuzzy matching |
| Realtime | None (full page reloads / manual AJAX polling) | Supabase Realtime (live post feed, RSVP counts) |
| Background jobs | None (counts computed inline per request) | Supabase Edge Functions + `pg_cron`, Vercel Cron for email digests |
| CI/CD | Manual FTP/cPanel file edits | GitHub Actions + Vercel preview deployments per PR |
| Repo/migrations | None — no version control on the live site at all | GitHub, Supabase CLI migrations checked into the repo |

---

## 3. Data model (Supabase/Postgres)

The legacy schema used a polymorphic pattern (`origin_class` / `origin_id`, `location_class` / `location_id` as loosely-typed string+id pairs) to let a network's origin or location point at different tables. This is precisely the pattern that caused the worst bug fixed this engagement — a query-parameter-binding bug where multiple candidate rows sharing a column name got their values silently swapped.

Rather than replace one polymorphic pattern with three separate geography tables (countries/regions/cities) glued together by nullable foreign keys, geography is modeled as a single self-referencing hierarchy: a `places` table where every row is a country, a region, or a city, and points at its own parent. A city's parent can be a region *or* a country directly — some countries don't have provinces, and a city shouldn't be forced to nest under a region that doesn't exist. A region's parent must always be a country. A country has no parent. Languages stay a separate, flat table — not nested under each other, even though sprawling families like the Chinese languages made that tempting; it adds real complexity for a case the product doesn't need yet.

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

-- Embassy/partner embeds (see section 6)
create table embed_partners (
  id bigint generated always as identity primary key,
  name text not null,                                  -- e.g. "Embassy of Indonesia"
  slug text not null unique,                            -- used in the embed URL
  locked_language_id bigint references languages(id),
  locked_origin_place_id bigint references places(id),
  jurisdiction_place_id bigint references places(id),   -- null = no location restriction
  created_at timestamptz not null default now(),
  constraint at_most_one_locked_origin check (
    locked_language_id is null or locked_origin_place_id is null
  )
);
```

**Member/post counts**: the legacy code required every controller to remember to manually call `getMemberCount()` / `getPostCount()` after loading a network — forgetting this was the exact cause of two separate bugs fixed this engagement (null counts on search results, both server-rendered and AJAX). Replace this with a Postgres trigger that keeps `networks.member_count` / `networks.post_count` in sync on insert/delete, so it is structurally impossible for a network object to have a stale or missing count.

**"Possible" and "related" networks**: with a self-referencing `places` hierarchy, broader/narrower matching stops being bespoke code and becomes a walk up or down `parent_id`. No city-level network for (origin, this city)? Walk the city's `parent_id` chain to its region and country and check those. Want every network in a country regardless of tier? A single recursive CTE from that country downward returns them all. This is also what makes the embed jurisdiction-locking below cheap to implement correctly.

---

## 4. Auth & email

Replace the entire home-grown auth system:

- **Signup/login**: Supabase Auth email/password. No more MD5 — Supabase handles hashing correctly by default.
- **Email confirmation**: Supabase Auth's built-in confirmation flow replaces the legacy `act_code` + `cm_email.php` `sendConfirmationEmail()` path entirely.
- **Forgot password**: Supabase Auth's built-in reset-password flow replaces `fp_code` + `sendChangePasswordEmail()` — this alone eliminates the exact bug class spent fixing this engagement (undefined constants breaking the page, SPF/DKIM never configured so mail silently vanished).
- **Custom SMTP**: point Supabase Auth's outbound email at Resend (Supabase supports a custom SMTP provider) so confirmation/reset emails are sent through a domain with SPF/DKIM/DMARC configured correctly from day one — do this as part of initial setup, not as a bug fix six months later.
- **Product email** (event reminders, weekly digest of new networks/posts, embassy admin notifications) goes through Resend directly via React Email templates, triggered from Vercel Cron / Supabase Edge Functions.
- **Row Level Security** replaces every manual `if (isset($_SESSION['uid']))` check scattered through the old `control/*.php` files — auth becomes enforced at the database layer, not re-implemented per page.

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
│       │   ├── search/
│       │   ├── embed/[partnerSlug]/   # iframe-safe embassy/partner embed route
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
│   └── embed-widget/            # standalone JS snippet embassies drop into their site
└── .github/workflows/ci.yml
```

- **GitHub**: single repo, trunk-based, PRs required, branch protection on `main`.
- **Vercel**: connected to the GitHub repo; every PR gets a preview deployment against a Supabase branch/preview database (Supabase supports preview branching); `main` auto-deploys to production.
- **GitHub Actions**: typecheck, lint, unit tests, and `supabase db lint` on every PR before Vercel preview is trusted.
- **Environments**: `local` (Supabase CLI local stack), `preview` (per-PR), `production`. Secrets (Supabase service role key, Resend API key) stored in Vercel project env vars, never committed — enforced by a `zod`-validated `env.ts` that fails the build if anything's missing, which structurally prevents the entire "undefined constant" class of runtime 500 this engagement kept finding in the legacy code.

---

## 6. Embassy/partner embed widget

This is the feature that actually got CultureMesh used by embassies, so it should be treated as core, not a stretch goal.

- A dedicated route (`/embed/[partnerSlug]`), rendered with no external nav chrome, safe to `<iframe>`.
- A lightweight `<script>` embed (`packages/embed-widget`) that a non-technical embassy webmaster can paste in, similar to a YouTube or Calendly embed — this avoids depending on the embassy's site allowing iframes at all.
- A public, rate-limited API route (`/api/public/networks/search`) so partners can build their own front end against CultureMesh data if they want to (this is also the natural foundation for the "data as a product" B2G angle from the earlier brainstorm, without committing to it now).
- **Jurisdiction locking**, backed by `embed_partners` above: an embassy's embed can have its origin locked (language or place — "Indonesia," not just any location can be picked), and its location restricted to a single place or to everything nested under a given country or region via the recursive `places` query. A consulate covering just one state gets a narrower `jurisdiction_place_id` than the national embassy.

---

## 7. Data migration from the legacy MySQL database

1. **Export**: dump `users`, `networks`, `network_registration`, `posts`, `events`, `event_registration` from the live MySQL database.
2. **Transform**:
   - `users` → Supabase Auth users (via the admin API, which allows setting a user as pre-confirmed) + `profiles` row. Passwords cannot be migrated (MD5 isn't reversible) — every legacy account gets flagged `must_reset_password` and is sent a Resend "we upgraded our security, please reset your password" email with a Supabase reset link on first login attempt.
   - Build the `places` tree first: every distinct legacy city/region gets a row, nested under a synthesized "United States" country row (the legacy data is US-only even though the new schema isn't). Then `networks.origin_class`/`origin_id` and `location_class`/`location_id` resolve into `language_id` or `origin_place_id` for origin, and `location_place_id` for location, against that tree.
   - `img_link` (relative filesystem paths, several of which pointed at the broken `/home3/...` directory found and fixed this engagement) → download the actual files from the legacy server's `user_images` directory and re-upload into Supabase Storage, rewriting `profiles.img_path` to the new object key.
3. **Verify**: row counts match, spot-check that member/post counts on migrated networks match what the trigger recomputes, confirm no orphaned `network_members` rows point at a network that failed to migrate, confirm every migrated city/region correctly resolves up to the synthesized US country row.
4. **Cutover**: point DNS at Vercel, keep the old Bluehost site up read-only for a short window in case of a rollback need, then decommission.

---

## 8. Legacy bugs → why they can't recur

Worth stating explicitly, since these were all found and fixed by hand this engagement:

- **Undefined PHP constants causing fatal 500s** (`DB_USER`, `HOME_PATH`, `META_AUTHOR`, `DOMAIN_URL`, the hardcoded `/home3/...` image path) → TypeScript + a validated env schema fails the *build*, not a random user's request, when something's missing.
- **The `Do2Db` parameter-binding bug** (values silently mis-bound across multiple candidate rows sharing a column name) → normalized schema with real foreign keys and a real query builder (Supabase's PostgREST client or Drizzle), no hand-built parenthetical SQL string concatenation.
- **`get_class(null)` fatal under PHP 8** (the registration-flow 500 fixed this engagement) → TypeScript's null checking catches this class of error at compile time.
- **Mail silently not sending** (no SPF/DKIM ever configured, `cm.Ajax`'s malformed `xhr.open()` call, hardcoded broken image paths) → Resend + verified domain from day one, and a stack where "the request never actually fires" isn't a silent multi-week bug because the entire client is TypeScript with proper typed API calls instead of hand-rolled `XMLHttpRequest`.
- **Stale UI after back-navigation (bfcache)** → Next.js's built-in cache/revalidation model and Supabase Realtime subscriptions replace manual `pageshow` listeners.
- **No version control on the live site at all** → GitHub from day one; every change reviewable and revertible, instead of hand-editing files over cPanel File Manager with `.bak` files as the only safety net.

---

## 9. Phased roadmap

| Phase | Scope | Rough effort |
|---|---|---|
| 0 | Repo scaffolding, Vercel + Supabase + Resend projects wired together, domain/DNS/SPF/DKIM configured up front | 2–3 days |
| 1 | Schema + RLS policies + auth flows (signup, confirm, login, reset) | 1 week |
| 2 | `places` hierarchy + languages seed data, search, launch flow, member counts | 1.5–2 weeks |
| 3 | Profiles (incl. Supabase Storage image upload), posts feed, replies | 1 week |
| 4 | Events + RSVPs | 3–4 days |
| 5 | Embassy embed widget + jurisdiction locking + public search API | 4–5 days |
| 6 | Data migration tooling + dry run against a copy of the legacy DB | 1 week |
| 7 | QA pass, accessibility/mobile pass, cutover | 3–5 days |

Total: roughly 7–9 weeks for one engineer working with Claude Code, assuming no major scope additions beyond feature parity. (The `places` hierarchy adds a few days over the earlier flat-table draft, but pays for itself in phase 5 and in every future non-US network.)

---

## 10. Extension points (not in scope for the core rebuild)

Flagged from the earlier brainstorm as things the new architecture makes easy to *add later* without redesigning anything above: rotating-savings/mutual-aid groups per network, embassy/ministry-facing analytics dashboards (the public API from Phase 5 is the natural foundation), event-vendor marketplace, and participatory-budgeting-style community funds. None of these require changes to the core schema above — they're additive tables that reference `networks` and `profiles`.

---

## 11. Open decisions before starting

1. Drop the legacy Twitter/tweet aggregation feature, or rebuild it against a different social platform's API?
2. Multi-tenant embassy admin accounts (embassies get a dashboard over "their" networks, beyond just the read-only embed) — in scope for v1 or a fast-follow?

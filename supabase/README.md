# Rebuilding this database from scratch

Everything needed to reconstruct the schema and reference data lives in
this repo. **User-generated content (profiles, networks, posts, replies,
messages, events) is not included here** — only the structure and the
lookup/reference tables (languages, places, religions) that the app
depends on to function.

- `migrations/` — every schema change in order: tables, RLS policies,
  grants, and SQL functions. This is the full DDL history.
- `seed.sql` — the places (27,494 rows) and languages (162 rows)
  reference data. Wired into `config.toml` to auto-apply on
  `supabase db reset`.
- `migrations/00000000000033_seed_religions.sql` — the 13 seeded
  religions (religions are few enough to live in a migration rather
  than `seed.sql`).

## If the Supabase project is ever deleted (e.g. free-tier auto-pause)

1. Create a new Supabase project.
2. `npx supabase link --project-ref <new-project-ref>`
3. `npx supabase db push --linked` — applies every migration in order,
   recreating the full schema, RLS, grants, functions, and the
   religions seed.
4. Apply the places/languages reference data (not run automatically
   against a remote project, only on a local `db reset`):
   `npx supabase db query --linked --file seed.sql`
5. Re-set every env var Vercel needs (`SUPABASE_SECRET_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   plus `RESEND_API_KEY`/`AZURE_TRANSLATOR_*`) — these are secrets and
   deliberately aren't in git, so they need to come from wherever
   they're otherwise recorded (password manager, Supabase/Resend/
   Azure dashboards) and be re-added via `vercel env add` for all
   three environments (Development/Preview/Production).
6. Sign in on the live site once (this creates your `profiles` row via
   the `on_auth_user_created` trigger), then reclaim admin access with
   one query, since there's deliberately no self-serve way to do this
   from the UI:
   `npx supabase db query --linked "update profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');"`

Steps 2–3 are exactly what `npx supabase db push --linked` already does
for a normal deploy in this project — rebuilding from zero isn't a
special case, it's the same command against an empty project.

## What doesn't come back

Auth users, profiles, networks, posts, messages, and events are all
data, not structure, so a rebuild starts with none of them - everyone
(including you) re-signs-up through the normal sign-in flow. Same for
anything configured through the admin panel (embed partners, product
updates). None of that is a concern while this is still test data;
it would matter once real users are on the platform, at which point
the fix is avoiding data loss in the first place (e.g. moving off the
free tier) rather than anything this repo can help rebuild.

## What `service_role` may actually do

This project has no default role grants (see `00000000000027`), so every
table's permitted operations are granted explicitly, one migration at a
time. The result is a deliberately narrow surface that is easy to forget:
a script written on the assumption that the service role is a superuser
fails at runtime with `permission denied for table …`, and a Supabase
client reports that as an error on the response rather than throwing, so
it is easy to mistake for an empty result.

Current state, compiled from the grants in `migrations/`:

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `places` | ✓ | ✓ | ✓ | ✓ |
| `languages` | ✓ | | ✓ | |
| `profiles` | ✓ | | ✓ | |
| `networks` | ✓ | ✓ | **`title` only** | ✓ |
| `network_members` | ✓ | ✓ | | ✓ |
| `posts` | ✓ | ✓ | — | — |
| `post_replies` | ✓ | ✓ | — | — |
| `post_translations` | ✓ | | | ✓ |
| `notification_prefs` | ✓ | | | |
| `geo_translations` | ✓ | ✓ | ✓ | |
| `organizations` | ✓ | ✓ | | ✓ |
| `organization_languages` | ✓ | ✓ | | ✓ |
| `organization_admins` | ✓ | ✓ | ✓ | |
| `organization_admin_invites` | ✓ | | ✓ | |
| `organization_whitelist` | ✓ | ✓ | ✓ | ✓ |
| `otp_attempts` | ✓ | ✓ | | |
| `verified_school_emails` | ✓ | ✓ | | |
| `pending_email_verifications` | ✓ | ✓ | | ✓ |
| `principals`, `outposts`, `outpost_officers` | ✓ | ✓ | ✓ | ✓ |
| `elections`, `election_candidates`, `election_votes` | ✓ | ✓ | ✓ | ✓ |

The two that surprise people most:

- **`posts` and `post_replies` cannot be updated or deleted by the service
  role.** Deleting a post goes through `delete_post()`
  (`00000000000081`), which is `security definer` and checks authorship.
  There is deliberately no admin purge path; adding one is a decision, not
  an oversight.
- **`networks` is updatable on `title` only.** Changing
  `location_place_id` fails, so moving a network means delete and
  recreate.

Always check `error` on a service-role query. A denied read returns
`{ data: null, error }`, which looks exactly like "no rows" if you only
destructure `data`.

## Developing against a local database instead of production

`npm run dev` reads `apps/web/.env.local`, which holds production
credentials. Until this was addressed, every dev server read and wrote the
live database: that is how 27 real users received email from a dev run,
and how test posts reached real networks.

One command moves development off production:

```
npm run db:start     # boots the local Supabase stack, points dev at it
npm run dev          # now reads and writes the local database
npm run db:reset     # rebuild it from migrations + seed.sql
npm run db:stop      # stop it, and point dev back at production
npm run db:status    # which database is `npm run dev` writing to?
```

`db:start` needs Docker Desktop. Without it the command says so and
changes nothing.

### How the switch works

`db:start` writes `apps/web/.env.development.local` containing only the
three Supabase variables. Next.js checks that file before `.env.local` and
stops at the first file that defines a given variable, so the database is
redirected while the Azure, Groq and Resend keys still come from
`.env.local` — nothing is copied and no secret is duplicated. `db:stop`
deletes the file, so `dev` can never point at a stack that isn't running.

### Scripts refuse to write to production unless asked

Every script in `apps/web/scripts` builds its client through
`scripts/lib/admin.ts`, which resolves env in the same order as the dev
server and then checks what it is pointed at. Against production it stops:

```
Refusing to write to <project>.supabase.co - that is production.
```

Pass `--prod` (or set `ALLOW_PRODUCTION_WRITES=1` in CI) when production
really is the target — backfills usually are. Read-only scripts opt out
with `adminClient({ readOnly: true })`; inspecting production is not the
danger, and making every inspection script take a flag only trains the
habit of passing `--prod` without reading it.

### End-to-end tests

```
npm run test:e2e     # starts (or reuses) a dev server and runs the suite
```

`e2e/public.spec.ts` is read-only and safe against either database.
`e2e/member.spec.ts` creates accounts and posts, so it skips itself unless
`db:start` has run — the test suite gets no exemption from the rule above.

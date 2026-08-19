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

Steps 2–3 are exactly what `npx supabase db push --linked` already does
for a normal deploy in this project — rebuilding from zero isn't a
special case, it's the same command against an empty project.

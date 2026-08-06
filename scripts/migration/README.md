# Legacy data migration tooling

Transforms the legacy MySQL dump (`5Aug2026_culturp7_ktc.sql`, repo root)
into the new schema's shape. **Read-only against the legacy dump, and
performs no writes to Supabase and sends no emails** — everything here
stops at producing local JSON + a validation report in `output/`
(gitignored: this is real user PII and must never enter git history).

An "apply" step that actually calls the Supabase Auth admin API to create
real accounts and inserts the transformed rows does not exist yet. That's
a real, hard-to-reverse production action — building and running it needs
its own explicit go-ahead, not something to bundle into the dry run.

## Usage

Run from the repo root, in order:

```bash
# 1. Parse the tables this migration needs out of the legacy dump into
#    scripts/migration/output/parsed/*.json
mkdir -p scripts/migration/output/parsed
for t in countries regions cities languages users networks \
         network_registration posts events event_registration; do
  python3 scripts/migration/parse_mysql.py \
    5Aug2026_culturp7_ktc.sql "$t" \
    scripts/migration/output/parsed/"$t".json
done

# 2. Rebuild the full legacy-id -> new-id map (places + languages).
#    Verify this against supabase/seed-data/legacy-place-id-map.json
#    (the country/region halves should match exactly - that file is the
#    source of truth from Phase 2's actual seed run).
python3 scripts/migration/reconstruct_full_map.py

# 3. Transform users/networks/network_registration/posts/events/
#    event_registration and write the validation report.
python3 scripts/migration/migrate_transform.py
cat scripts/migration/output/report.json
```

## What the transform does

- **users**: skips rows with no email or a duplicate email (case-folded).
  Passwords are never carried over (legacy MD5 hashes aren't reversible) -
  every real migration run must flag migrated accounts for a forced
  password reset rather than attempt to preserve credentials.
- **networks**: resolves `network_class` (`cc`/`rc`/`co`/`_l` = city/
  region/country/language-origin) against the legacy-id map. Skips rows
  with no valid class or an origin that doesn't resolve (confirmed via the
  2026-08 dry run: 142 of 4316 legacy networks are genuinely broken in the
  source data — a `network_class` set with no matching origin columns
  populated at all, not a mapping bug).
- **network_members / posts / events / event_rsvps**: dropped if either
  side of the reference (user, network, or event) failed to migrate.
- **images**: `img_link` values are checked against `htdocs/user_images/`
  for a real Phase 7 run to actually upload; the dry run only reports how
  many resolve locally.

## Last dry-run results (2026-08-06)

| | legacy rows | migrated | skipped |
|---|---|---|---|
| users | 5,883 | 5,882 | 1 (no email) |
| networks | 4,316 | 4,174 | 142 (broken origin data) |
| network_members | 2,539 | 2,539 | 0 |
| posts | 794 | 794 | 0 |
| events | 57 | 57 | 0 |
| event_rsvps | 6 | 6 | 0 |

214 of 5,882 users and 0 of 794 posts had a locally-resolvable
`img_link` (legacy `posts.img_link` is empty string across all real
posts — not a bug, the feature just was never populated on posts).

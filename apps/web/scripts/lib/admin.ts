// One admin client for every script, with a production-write guard.
//
// Each script used to call process.loadEnvFile(".env.local") and build its
// own service-role client, which meant every seed and backfill ran against
// production by default - including the ones that exist purely to create
// test data. Seeding "Acme University" into the live database is a mistake
// a script should make hard, not easy.
//
// Resolution order matches the dev server (.env.development.local first,
// then .env.local), so once `npm run db:start` has run, scripts follow the
// dev server to the local stack without being told to.
//
// Production writes still happen - backfills have to - but now only when
// asked for by name: `--prod` on the command line, or
// ALLOW_PRODUCTION_WRITES=1 in the environment for CI.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const WEB_ROOT = path.resolve(import.meta.dirname ?? __dirname, "../..");

function isLocal(url: string) {
  const { hostname } = new URL(url);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function loadEnv() {
  // Same precedence as next dev: the first file to define a variable wins,
  // so .env.development.local overrides only what it names.
  for (const file of [".env.development.local", ".env.local"]) {
    const full = path.join(WEB_ROOT, file);
    if (fs.existsSync(full)) process.loadEnvFile(full);
  }
}

/**
 * A service-role client, after confirming the caller meant to write to
 * whatever it is pointed at.
 *
 * `readOnly` scripts skip the guard: reading production is not the danger,
 * and making every inspection script take a flag would train the habit of
 * passing --prod without reading it.
 */
export function adminClient({ readOnly = false }: { readOnly?: boolean } = {}): SupabaseClient {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in\n" +
        "apps/web/.env.local (or .env.development.local).",
    );
    process.exit(1);
  }

  const local = isLocal(url);
  const allowed =
    local || readOnly || process.argv.includes("--prod") || process.env.ALLOW_PRODUCTION_WRITES === "1";

  if (!allowed) {
    console.error(
      [
        "",
        `Refusing to write to ${new URL(url).hostname} - that is production.`,
        "",
        "Either develop against a local database:",
        "",
        "  npm run db:start      (needs Docker Desktop)",
        "",
        "or, if you really do mean production, say so:",
        "",
        `  npx tsx ${path.relative(WEB_ROOT, process.argv[1] ?? "scripts/...")} --prod`,
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(`→ ${local ? "local database" : `PRODUCTION (${new URL(url).hostname})`}`);
  return createClient(url, key, { auth: { persistSession: false } });
}

// Point local development at a local database instead of production.
//
// Why this exists: `npm run dev` reads .env.local, which holds production
// credentials, so until now every dev server wrote to the live database.
// That is how 27 real users were emailed by a dev run, and how test posts
// reached real networks.
//
// The switch is .env.development.local. Next.js checks it before
// .env.local and stops at the first file that defines a given variable
// (node_modules/next/dist/docs/01-app/02-guides/environment-variables.md),
// so writing only the three Supabase variables there redirects the
// database while Azure, Groq and Resend keys still fall through from
// .env.local. Nothing has to be copied, and no secret is duplicated.
//
// The file is written by `start` and deleted by `stop`, so dev never
// points at a stack that isn't running.
//
// Run: npm run db:start | db:stop | db:reset | db:status
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname ?? __dirname, "../../..");
const ENV_FILE = path.resolve(import.meta.dirname ?? __dirname, "../.env.development.local");

const HEADER = `# Written by npm run db:start - do not edit, do not commit.
#
# Next.js reads this before .env.local, so these three values redirect the
# dev server to the local Supabase stack. Every other variable still comes
# from .env.local. Removed by npm run db:stop.
`;

function haveDocker() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

function dockerMissing(): never {
  console.error(
    [
      "",
      "The local database needs Docker, which isn't running.",
      "",
      "  1. Install Docker Desktop:  https://docs.docker.com/desktop/install/mac-install/",
      "  2. Start it and wait for the whale icon to settle",
      "  3. Run this command again",
      "",
      "Until then `npm run dev` talks to the production database. Nothing is",
      "broken - but anything you post, delete or email in dev is real.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

function supabase(args: string[], opts: { capture?: boolean } = {}) {
  if (opts.capture) {
    return execFileSync("supabase", args, { cwd: REPO_ROOT, encoding: "utf8" });
  }
  const result = spawnSync("supabase", args, { cwd: REPO_ROOT, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return "";
}

/** The local stack mints fixed keys, but reads them rather than hardcoding
 *  them: the CLI has changed key formats more than once. */
function writeEnvFile() {
  const status = JSON.parse(supabase(["status", "-o", "json"], { capture: true })) as Record<
    string,
    string
  >;
  const url = status.API_URL;
  const publishable = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const secret = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
  if (!url || !publishable || !secret) {
    console.error("`supabase status -o json` did not report the keys this app needs:");
    console.error(Object.keys(status).join(", "));
    process.exit(1);
  }
  fs.writeFileSync(
    ENV_FILE,
    `${HEADER}NEXT_PUBLIC_SUPABASE_URL=${url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}
SUPABASE_SECRET_KEY=${secret}
`,
  );
  return url;
}

const command = process.argv[2] ?? "status";

switch (command) {
  case "start": {
    if (!haveDocker()) dockerMissing();
    supabase(["start"]);
    const url = writeEnvFile();
    console.log(
      [
        "",
        `Local database running at ${url}`,
        `Dev server redirected via ${path.relative(REPO_ROOT, ENV_FILE)}`,
        "",
        "  npm run dev         - now writes to the local database",
        "  npm run db:reset    - rebuild from migrations + seed.sql",
        "  npm run db:stop     - stop it and point dev back at production",
        "",
        "Restart `npm run dev` if it was already running: env files are read",
        "once at startup.",
        "",
      ].join("\n"),
    );
    break;
  }

  case "stop": {
    if (haveDocker()) supabase(["stop"]);
    if (fs.existsSync(ENV_FILE)) fs.rmSync(ENV_FILE);
    console.log("\nLocal database stopped. `npm run dev` is back on production.\n");
    break;
  }

  case "reset": {
    if (!haveDocker()) dockerMissing();
    // Guarded by the local stack being the target: `supabase db reset`
    // without --linked only ever touches the container.
    supabase(["db", "reset"]);
    break;
  }

  case "status": {
    const pointing = fs.existsSync(ENV_FILE) ? "local" : "production";
    console.log(`\nnpm run dev currently writes to: ${pointing}\n`);
    if (!haveDocker()) {
      console.log("Docker is not running, so the local stack is unavailable.\n");
      break;
    }
    supabase(["status"]);
    break;
  }

  default:
    console.error(`Unknown command "${command}". Expected start, stop, reset or status.`);
    process.exit(1);
}

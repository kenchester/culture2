import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Playwright loads this file as CommonJS (the package is not type:module),
// so __dirname rather than import.meta.dirname.
const HERE = __dirname;

/**
 * End-to-end tests for the things unit tests can't see: that a page
 * actually renders, that language detection survives the proxy, that a
 * permalink resolves, and that a missing page is friendly rather than a
 * stack trace.
 *
 * Two bands, because the database situation forces it:
 *
 *   e2e/public.spec.ts  - read-only, safe against any database, runs now.
 *   e2e/member.spec.ts  - needs accounts and writes, so it skips itself
 *                         unless `npm run db:start` has pointed dev at a
 *                         local stack. Writing test members into the live
 *                         database to prove a test passes is the mistake
 *                         scripts/lib/admin.ts exists to prevent, and the
 *                         test suite does not get an exemption.
 *
 * `npm run db:status` says which database you're on.
 */
export const USING_LOCAL_DB = fs.existsSync(
  path.join(HERE, ".env.development.local"),
);

export default defineConfig({
  testDir: "./e2e",
  // Pages hit a hosted database, so a cold request is slower than a local
  // one; generous enough not to flake, short enough to notice a hang.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Reuses a dev server you already have open, which is the common case
  // locally and keeps the suite quick to re-run.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});

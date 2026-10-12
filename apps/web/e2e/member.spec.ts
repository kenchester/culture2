import { execFileSync } from "node:child_process";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { USING_LOCAL_DB } from "../playwright.config";

/**
 * Flows that need an account and write to the database: posting, replying,
 * and paging a feed longer than production has.
 *
 * Skipped entirely unless `npm run db:start` has pointed the dev server at
 * a local stack. The suite creates users and inserts posts, and doing that
 * against the live database to prove a test passes is exactly the mistake
 * scripts/lib/admin.ts exists to prevent.
 *
 * Signing in goes through generateLink + /sign-in/confirm rather than
 * forging a session cookie, because that route already exists for the
 * signup-nudge email and establishes the session the same way the typed
 * 6-digit code does. Forged cookies would test @supabase/ssr's cookie
 * format instead of this app's auth.
 */

const WEB_ROOT = path.join(__dirname, "..");

test.describe("member flows", () => {
  test.skip(
    !USING_LOCAL_DB,
    "needs a local database: run `npm run db:start` (requires Docker Desktop)",
  );

  let admin: SupabaseClient;
  let networkId: number;
  const email = `e2e-${Date.now()}@example.test`;

  test.beforeAll(async () => {
    process.loadEnvFile(path.join(WEB_ROOT, ".env.development.local"));
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false } },
    );

    // Idempotent, so running the suite twice doesn't double the fixture.
    execFileSync("npx", ["tsx", "scripts/seed-scroll-test-network.ts"], {
      cwd: WEB_ROOT,
      stdio: "inherit",
    });

    const { data: network } = await admin
      .from("networks")
      .select("id")
      .eq("title", "Scroll test")
      .single();
    networkId = network!.id as number;

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name: "E2E", last_name: "Member" },
    });
    if (error) throw error;
    await admin
      .from("network_members")
      .upsert(
        { network_id: networkId, user_id: created.user.id },
        { onConflict: "network_id,user_id", ignoreDuplicates: true },
      );
  });

  test.afterAll(async () => {
    const { data } = await admin.auth.admin.listUsers();
    const user = data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  });

  async function signIn(context: BrowserContext): Promise<Page> {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    const page = await context.newPage();
    await page.goto(`/sign-in/confirm?token_hash=${data.properties.hashed_token}`);
    await expect(page).toHaveURL(/\/$|\/\?/);
    return page;
  }

  test("the composer empties itself after a post lands", async ({ context }) => {
    const page = await signIn(context);
    await page.goto(`/networks/${networkId}`);

    const body = page.locator('textarea[name="body"]');
    const text = `e2e composer ${Date.now()}`;
    await body.fill(text);
    await page.getByRole("button", { name: /post/i }).first().click();

    // Both halves of the bug that was reported: the post has to appear
    // without a reload, and the box has to be empty afterwards.
    await expect(page.getByText(text)).toBeVisible();
    await expect(body).toHaveValue("");
  });

  test("a rejected post keeps the text that was typed", async ({ context }) => {
    const page = await signIn(context);
    await page.goto(`/networks/${networkId}`);
    const body = page.locator('textarea[name="body"]');
    // Empty submission is refused, and refusing must not eat the field:
    // React only resets an uncontrolled form on success.
    await body.fill("   ");
    await page.getByRole("button", { name: /post/i }).first().click();
    await expect(body).toHaveValue("   ");
  });

  test("the feed pages in 30 at a time", async ({ context }) => {
    const page = await signIn(context);
    await page.goto(`/networks/${networkId}`);

    const posts = page.locator('a[href*="/posts/"]');
    await expect
      .poll(async () => (await posts.count()) > 0, { timeout: 15_000 })
      .toBeTruthy();
    const first = await posts.count();
    expect(first).toBeLessThanOrEqual(30);

    // The keyboard-reachable button, not the scroll sentinel: an
    // IntersectionObserver never fires in a tab that produces no frames,
    // which is every automated tab.
    await page.getByRole("button", { name: /load more posts/i }).click();
    await expect.poll(async () => posts.count(), { timeout: 15_000 }).toBeGreaterThan(first);
  });

  test("newer replies sit above older ones", async ({ context }) => {
    const page = await signIn(context);
    await page.goto(`/networks/${networkId}`);
    const permalink = page.locator('a[href*="/posts/"]').first();
    await permalink.click();
    await expect(page).toHaveURL(/\/posts\/\d+/);

    const stamp = Date.now();
    for (const n of [1, 2]) {
      await page.getByRole("button", { name: /^reply$/i }).first().click();
      const field = page.locator("textarea").first();
      await field.fill(`reply ${n} ${stamp}`);
      await page.getByRole("button", { name: /^reply$/i }).last().click();
      await expect(page.getByText(`reply ${n} ${stamp}`)).toBeVisible();
    }

    const order = await page.evaluate(() => document.body.innerText);
    expect(order.indexOf(`reply 2 ${stamp}`)).toBeLessThan(order.indexOf(`reply 1 ${stamp}`));
  });
});

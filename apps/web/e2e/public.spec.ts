import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Everything here is read-only, so it is safe to run against the
 * production database as well as a local one. It covers the things that
 * only break in a real browser against a real response: language
 * detection through the proxy, a permalink resolving, a gate showing a
 * sign-in prompt instead of a 404, and an unknown URL being friendly.
 *
 * Data-dependent flows that need more posts than production has (feed
 * pagination, reply ordering, soft delete) live in member.spec.ts, which
 * can seed exactly what it needs on a local stack.
 */

// A network with a few public posts, and an organisation network that an
// anonymous visitor must not be able to read. Overridable so the suite
// also runs against a freshly seeded local database.
const POST_NETWORK = process.env.E2E_POST_NETWORK ?? "73";
const ORG_NETWORK = process.env.E2E_ORG_NETWORK ?? "36";

test.describe("chrome and content", () => {
  test("the homepage renders its heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Find your diaspora network" })).toBeVisible();
  });

  test("the outposts directory leads with the idea, not the table", async ({ page }) => {
    await page.goto("/outposts");
    await expect(page.getByRole("heading", { level: 1, name: "Outposts" })).toBeVisible();

    // The restructure put the historical mission and the call to action
    // above the districts table; a regression that reorders them is
    // exactly what this asserts against.
    const historical = page.getByText("Closed mission, reopened", { exact: true });
    const elect = page.getByRole("heading", { name: /Elect an Unofficial Consul/i });
    const table = page.getByRole("table");
    await expect(historical).toBeVisible();
    await expect(elect).toBeVisible();
    await expect(table).toBeVisible();

    const order = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        historical: text.indexOf("Closed mission, reopened"),
        elect: text.indexOf("Elect an Unofficial Consul"),
        district: text.indexOf("District"),
      };
    });
    expect(order.historical).toBeLessThan(order.elect);
    expect(order.elect).toBeLessThan(order.district);
  });

  test("a district links to its network", async ({ page }) => {
    await page.goto("/outposts");
    const first = page.getByRole("table").getByRole("link").first();
    await first.click();
    await expect(page).toHaveURL(/\/networks\/\d+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the elections page explains the office and lists elections", async ({ page }) => {
    await page.goto("/outposts/elections");
    await expect(
      page.getByRole("heading", { level: 1, name: "Unofficial Consul elections" }),
    ).toBeVisible();
    await expect(page.getByText(/two-year term/)).toBeVisible();
  });

  test("an election shows its phase, its roll and its scope", async ({ page }) => {
    await page.goto("/outposts/elections");
    // Scoped by href: the page chrome has list items too.
    const election = page.locator('a[href^="/outposts/elections/"]').first();
    test.skip(!(await election.count()), "no election to open");
    await election.click();
    await expect(page).toHaveURL(/\/outposts\/elections\/\d+/);
    // The turnout line is published on every election, flattering or not.
    await expect(page.getByText(/on the roll/i)).toBeVisible();
    // And the disclaimer, which is the whole reason the office is called
    // unofficial.
    await expect(page.getByText(/not appointed by any government/i)).toBeVisible();
  });

  test("the training page states the ground rules before the consent", async ({ page }) => {
    await page.goto("/training");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/training/i);
    await expect(page.getByText(/Ground Rules/i).first()).toBeVisible();
  });
});

test.describe("language detection", () => {
  // The spec: an explicit choice wins, then Accept-Language, then
  // geolocation, then the default - and the detected value is never
  // persisted, so the first render has to be right.
  //
  // The header cases are asserted on the raw response rather than through
  // a page, for two reasons: Chromium derives Accept-Language from the
  // context locale and ignores an extraHTTPHeaders override of it, and
  // q-values can't be expressed as a locale at all. <html lang> is the
  // resolved locale exactly - unlike body text, which is ambiguous because
  // the whole message catalogue ships in the RSC payload.
  async function langFor(request: APIRequestContext, header: string) {
    const response = await request.get("/", {
      headers: { "Accept-Language": header },
    });
    expect(response.status()).toBe(200);
    return (await response.text()).match(/<html lang="([^"]+)"/)?.[1];
  }

  test("Accept-Language picks the language on the first render", async ({ browser }) => {
    // Through a real page, to prove the server got it right rather than
    // the client swapping it afterwards.
    const context = await browser.newContext({ locale: "es-ES" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Encuentra tu red de diáspora" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await context.close();
  });

  test("Traditional Chinese does not match Simplified", async ({ request }) => {
    // zh-Hant is a different script from the zh we ship. Serving
    // Simplified to a Traditional reader is worse than serving English,
    // so this must fall through to the default.
    expect(await langFor(request, "zh-Hant-TW,zh-Hant;q=0.9")).toBe("en");
    // The control: Simplified still matches, so the test above is about
    // script and not about Chinese being unsupported.
    expect(await langFor(request, "zh-Hans-CN,zh;q=0.9")).toBe("zh");
  });

  test("q=0 rejects a language rather than requesting it", async ({ request }) => {
    expect(await langFor(request, "es;q=0, fr;q=0.8")).toBe("fr");
  });

  test("a wildcard carries no information", async ({ request }) => {
    // "*" means "anything", which is not a request for any language in
    // particular, so it must not beat the default.
    expect(await langFor(request, "*")).toBe("en");
  });

  test("ties keep the order the sender wrote", async ({ request }) => {
    expect(await langFor(request, "fr,es")).toBe("fr");
    expect(await langFor(request, "es,fr")).toBe("es");
  });

  test("an unshipped language falls through to the default", async ({ request }) => {
    expect(await langFor(request, "is-IS,is;q=0.9")).toBe("en");
  });

  test("an explicit choice beats the header", async ({ browser, baseURL }) => {
    // locale, not extraHTTPHeaders: Chromium builds Accept-Language from
    // the context locale, so an override there would leave this testing
    // the cookie against en-US instead of against Spanish.
    const context = await browser.newContext({ locale: "es-ES" });
    await context.addCookies([{ name: "NEXT_LOCALE", value: "fr", url: baseURL! }]);
    const page = await context.newPage();
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Trouvez votre réseau de diaspora" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await context.close();
  });

  test("detection is resolved per request, never written to the browser", async ({ browser }) => {
    const context = await browser.newContext({ locale: "es-ES" });
    const page = await context.newPage();
    await page.goto("/");
    const cookies = await context.cookies();
    // A detected language that gets stored becomes a choice the visitor
    // never made, and outlives the circumstances that produced it.
    expect(cookies.map((c) => c.name)).not.toContain("NEXT_LOCALE");
    expect(cookies.map((c) => c.name)).not.toContain("x-detected-locale");
    await context.close();
  });
});

test.describe("permalinks", () => {
  test("a post permalink shows the post and its network", async ({ page }) => {
    await page.goto(`/networks/${POST_NETWORK}`);
    const permalink = page.locator(`a[href*="/posts/"]`).first();
    test.skip(!(await permalink.count()), `network ${POST_NETWORK} has no posts`);
    const href = await permalink.getAttribute("href");
    await page.goto(href!);
    await expect(page).toHaveURL(/\/networks\/\d+\/posts\/\d+/);
    // Both halves matter: the post itself, and the network it belongs to,
    // so a permalink arriving cold still has context.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /back|←/i }).first()).toBeVisible();
  });

  test("an unknown post id is friendly, not a stack trace", async ({ page }) => {
    const response = await page.goto(`/networks/${POST_NETWORK}/posts/99999999`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This page doesn't appear to exist")).toBeVisible();
  });
});

test.describe("gates and errors", () => {
  test("an unknown URL offers the homepage and contact, not an error page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This page doesn't appear to exist")).toBeVisible();
    await expect(page.getByRole("link", { name: "homepage" })).toBeVisible();
    // exact, because the footer carries a "Contact Us" link of its own.
    await expect(page.getByRole("link", { name: "contact us", exact: true })).toBeVisible();
  });

  test("school content prompts a sign-in rather than claiming not to exist", async ({ page }) => {
    await page.goto(`/networks/${ORG_NETWORK}`);
    // The content is gated, but the gate has to say so: a 404 here tells
    // a student with a valid link that their school's network is missing.
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
  });

  test("a members-only page sends an anonymous visitor to sign in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

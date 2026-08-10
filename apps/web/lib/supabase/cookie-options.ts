import type { CookieOptions } from "@supabase/ssr";

// Embeds load CultureMesh in a cross-site iframe (another domain's page).
// The default SameSite=Lax cookie a browser would otherwise use is not sent
// back on requests made from inside that iframe, since - from the browser's
// perspective - the top-level document is a different site. SameSite=None
// (paired with Secure, which browsers require alongside it) marks these
// cookies safe to send in that cross-site context; Partitioned (CHIPS) keeps
// them scoped per top-level site so this doesn't weaken privacy elsewhere.
// This has no effect on ordinary top-level visits to culturemesh.com itself.
export const authCookieOptions: CookieOptions = {
  sameSite: "none",
  secure: true,
  partitioned: true,
};

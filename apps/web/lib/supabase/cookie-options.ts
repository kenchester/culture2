import type { CookieOptions } from "@supabase/ssr";

// Embeds load CultureMesh in a cross-site iframe (another domain's page).
// The default SameSite=Lax cookie a browser would otherwise use is not sent
// back on requests made from inside that iframe, since - from the browser's
// perspective - the top-level document is a different site. SameSite=None
// (paired with Secure, which browsers require alongside it) marks these
// cookies safe to send in that cross-site context; Partitioned (CHIPS) keeps
// them scoped per top-level site so this doesn't weaken privacy elsewhere.
// This has no effect on ordinary top-level visits to culturemesh.com itself.
function isCultureMeshHost(host: string | undefined | null) {
  return Boolean(host && (host === "culturemesh.com" || host.endsWith(".culturemesh.com")));
}

// faith.culturemesh.com needs to share the session with culturemesh.com,
// which requires a root-domain cookie instead of the default host-only
// one. Deciding this from the actual request host (rather than an env var
// like NODE_ENV/VERCEL_ENV) means it's correct on its own terms: a Domain
// attribute that isn't a suffix of the current host gets silently rejected
// by the browser, so localhost and *.vercel.app preview deployments must
// never get it, and checking the real host guarantees that without relying
// on whichever env vars happen to be exposed to a given runtime. Partitioning
// is orthogonal to this: it only keys on the top-level site in the embed
// iframe case above, so adding a root-domain Domain here doesn't change
// that behavior.
export function getAuthCookieOptions(host?: string | null): CookieOptions {
  return {
    sameSite: "none",
    secure: true,
    partitioned: true,
    ...(isCultureMeshHost(host) ? { domain: ".culturemesh.com" } : {}),
  };
}

import "server-only";
import { headers } from "next/headers";
import { LEARN_HOST_PREFIX } from "@/lib/supabase/proxy";

// Same host-detection used ad hoc in the embed pages (localhost -> http,
// everything else -> https) - centralized here since notification emails
// now need it in several server actions too.
export async function getSiteUrl() {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

// The canonical public origin, used when the request's own host is not
// something a recipient could ever visit.
const CANONICAL_SITE_URL = "https://www.culturemesh.com";

function isUnreachableHost(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    host.endsWith(".local")
  );
}

/**
 * The site URL to put in an EMAIL, which is not the same problem as the
 * site URL to render on a page.
 *
 * getSiteUrl() reflects whatever host the request arrived on, which is
 * right for a link inside the page and wrong for a link inside an email.
 * A notification triggered from a developer's machine was sending real
 * recipients "http://localhost:3000/networks/60" - a link that resolves,
 * for them, to nothing at all.
 *
 * A subdomain is preserved when there is one, since a learn. post belongs
 * on learn.; only an unreachable host is swapped for the canonical origin.
 */
export async function getEmailSiteUrl() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";

  if (!host || isUnreachableHost(host)) {
    return CANONICAL_SITE_URL;
  }
  return `https://${host}`;
}

export async function isLearnHost() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  return host.startsWith(LEARN_HOST_PREFIX);
}

// The sign-in page's "you can still use the main CultureMesh network"
// fallback link needs the plain culturemesh.com URL even when the visitor
// is on learn.culturemesh.com - stripping the prefix off the current host
// (rather than hardcoding culturemesh.com) keeps this correct on preview
// deployments too.
export async function getMainSiteUrl() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const bareHost = host.startsWith(LEARN_HOST_PREFIX) ? host.slice(LEARN_HOST_PREFIX.length) : host;
  const protocol = bareHost.startsWith("localhost") || bareHost.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${bareHost}`;
}

// Swaps in a different subdomain than whatever host the current request
// came in on (e.g. building a learn.culturemesh.com link from a server
// action running on the bare culturemesh.com admin pages) - subdomain
// links can't be expressed from localhost without a hosts-file/wildcard-DNS
// trick, so locally this falls back to the plain siteUrl path instead.
export function buildSubdomainUrl(siteUrl: string, subdomain: string, path: string): string {
  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    return `${siteUrl}${path}`;
  }
  return `https://${subdomain}.culturemesh.com${path}`;
}

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

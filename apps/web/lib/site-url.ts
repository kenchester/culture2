import "server-only";
import { headers } from "next/headers";

// Same host-detection used ad hoc in the embed pages (localhost -> http,
// everything else -> https) - centralized here since notification emails
// now need it in several server actions too.
export async function getSiteUrl() {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

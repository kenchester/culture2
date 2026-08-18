import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// faith.culturemesh.com and redeemed.culturemesh.com stay out of search
// results until their markets are properly tested - reading headers()
// makes this a request-time (uncached) route, so it can branch on host
// without affecting culturemesh.com/www.culturemesh.com's own robots.txt.
const SEQUESTERED_HOST_PREFIXES = ["faith.", "redeemed."];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  const isSequestered = SEQUESTERED_HOST_PREFIXES.some((prefix) => host.startsWith(prefix));

  if (isSequestered) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}

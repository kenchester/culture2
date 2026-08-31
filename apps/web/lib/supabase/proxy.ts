import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env.public";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { detectLocaleFromCountry } from "@/lib/locale";

// Each sequestered subdomain gets its home/search path rewritten to its
// own page - faith.culturemesh.com to a full religion picker,
// redeemed.culturemesh.com to a Christian-only variant with the religion
// choice hidden. Neither needs its own results page or launch action -
// both stay host-agnostic, driven purely by originKind.
const SUBDOMAIN_ROUTES: Record<string, string> = {
  "faith.": "/faith",
  "redeemed.": "/redeemed",
};

// learn.culturemesh.com is different from the two subdomains above: it's a
// small multi-tenant page tree (each school lives at /learn/{slug} - see
// app/learn/[slug]/) layered on the same host-agnostic app everything else
// uses, not a single fixed page. Bare "/" and "/invite*" (token-scoped, not
// tied to any one school) are special-cased; every other first path segment
// is treated as a school's slug and rewritten under /learn, UNLESS it's one
// of this app's real top-level routes - a learn. page linking to
// /networks/123 or /sign-in must keep resolving to the normal shared pages,
// not get swept into a school's slug rewrite. Also enforced at org-creation
// time (app/admin/organizations/actions.ts) so a new school's slug can't
// collide with one of these and end up unreachable.
export const LEARN_HOST_PREFIX = "learn.";
export const RESERVED_LEARN_SLUGS = [
  "sign-in",
  "about",
  "contact",
  "privacy",
  "terms",
  "admin",
  "api",
  "embed",
  "embed-partners",
  "faith",
  "messages",
  "my-networks",
  "networks",
  "profile",
  "redeemed",
  "schools",
  "search",
  "settings",
  "start",
  "suggest-network",
  "learn",
];

// These subdomains stay out of search results until their markets are
// properly tested - applied as a response header rather than relying on
// robots.txt alone, since it covers every route under the host (not just
// the ones robots.ts enumerates) and is respected by major crawlers just
// like a meta robots tag.
function isSequesteredHost(host: string): boolean {
  return (
    Object.keys(SUBDOMAIN_ROUTES).some((prefix) => host.startsWith(prefix)) ||
    host.startsWith(LEARN_HOST_PREFIX)
  );
}

function rewriteForHost(request: NextRequest): NextRequest["nextUrl"] | null {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  if (host.startsWith(LEARN_HOST_PREFIX)) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/learn";
      return url;
    }
    if (pathname === "/invite" || pathname.startsWith("/invite/")) {
      const url = request.nextUrl.clone();
      url.pathname = `/learn${pathname}`;
      return url;
    }
    const firstSegment = pathname.split("/")[1];
    if (!firstSegment || RESERVED_LEARN_SLUGS.includes(firstSegment)) {
      return null;
    }
    const url = request.nextUrl.clone();
    url.pathname = `/learn${pathname}`;
    return url;
  }

  if (pathname !== "/" && pathname !== "/search") {
    return null;
  }
  const prefix = Object.keys(SUBDOMAIN_ROUTES).find((p) => host.startsWith(p));
  if (!prefix) {
    return null;
  }
  const url = request.nextUrl.clone();
  url.pathname = SUBDOMAIN_ROUTES[prefix];
  return url;
}

export async function updateSession(request: NextRequest) {
  const rewriteUrl = rewriteForHost(request);
  const buildResponse = () =>
    rewriteUrl ? NextResponse.rewrite(rewriteUrl, { request }) : NextResponse.next({ request });

  let response = buildResponse();

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: getAuthCookieOptions(request.headers.get("host")),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = buildResponse();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Revalidates the session against Supabase Auth on every request (not just
  // reading the cookie) so a revoked/expired session can't slip through.
  await supabase.auth.getUser();

  // One-time locale bootstrap: only fires while no NEXT_LOCALE cookie exists
  // yet, so a visitor's own choice (set via the language switcher) always
  // wins on every later request. x-vercel-ip-country is only populated on
  // Vercel's network, so local dev always falls back to "en" here.
  if (!request.cookies.get("NEXT_LOCALE")) {
    const country = request.headers.get("x-vercel-ip-country");
    response.cookies.set("NEXT_LOCALE", detectLocaleFromCountry(country), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (isSequesteredHost(request.headers.get("host") ?? "")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

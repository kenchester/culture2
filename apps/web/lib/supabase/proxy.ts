import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env.public";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { detectLocale } from "@/lib/locale";

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

  // One-time locale bootstrap: only runs while no NEXT_LOCALE cookie exists,
  // so a visitor's own choice (via the language switcher) always wins on
  // every later request.
  //
  // This has to happen BEFORE the first buildResponse(), for two reasons.
  // buildResponse() forwards the request headers downstream, so setting the
  // cookie on the *request* is what lets the very first page render in the
  // detected language instead of English - previously the cookie was only
  // set on the response, so a new visitor's first page was always English
  // and only the second one was translated. And it can't be done later
  // either: Supabase's setAll() rebuilds `response` from scratch, so a
  // rebuild after that point would silently drop refreshed auth cookies.
  const bootstrapLocale = request.cookies.get("NEXT_LOCALE")
    ? null
    : detectLocale(
        request.headers.get("accept-language"),
        // Only populated on Vercel's network, so local dev always falls
        // through to the Accept-Language result (or "en").
        request.headers.get("x-vercel-ip-country"),
      );
  if (bootstrapLocale) {
    request.cookies.set("NEXT_LOCALE", bootstrapLocale);
  }

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

  // Persist the bootstrapped locale for the browser. Done on the final
  // response object (after any setAll rebuilds) so it can't be discarded.
  if (bootstrapLocale) {
    response.cookies.set("NEXT_LOCALE", bootstrapLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  // No "Vary: Accept-Language" here, deliberately. Appending it from the
  // proxy doesn't survive - Next.js writes its own Vary (rsc,
  // next-router-state-tree, ..., Accept-Encoding) over the top, verified by
  // inspecting the response headers. It isn't needed anyway: Accept-Language
  // is only ever read on the bootstrap path, and every response that takes
  // that path carries a Set-Cookie, which keeps it out of shared caches.
  // Once the cookie exists the header is never consulted again.

  if (isSequesteredHost(request.headers.get("host") ?? "")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

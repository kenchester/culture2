import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env.public";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { DETECTED_LOCALE_COOKIE, isLocale, resolveLocale } from "@/lib/locale";

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

  // Language detection, resolved fresh on every request and never written
  // back to the browser.
  //
  // NEXT_LOCALE is reserved for one meaning only: a choice this person made
  // in the switcher. Detection deliberately does not write it. Persisting a
  // guess would pin a visitor to wherever they happened to be on their first
  // visit - a traveller would stay wrong for a year - and would blur "they
  // chose this" into "we guessed this", after which nothing downstream can
  // tell the two apart and no later improvement to detection would ever
  // reach anyone already guessed at. Re-deriving costs two header reads.
  //
  // The result travels to the renderer on the request via a scoped cookie
  // (read in i18n/request.ts). It is always cleared first, so a value a
  // client sends us is discarded rather than trusted. The write has to land
  // BEFORE the first buildResponse(), which forwards request headers
  // downstream - that is what makes the FIRST render come out in the right
  // language instead of rendering English and correcting on the next
  // navigation. It also cannot be moved later: Supabase's setAll() rebuilds
  // `response` from scratch, so anything done after that point would be
  // dropped.
  request.cookies.delete(DETECTED_LOCALE_COOKIE);
  if (!isLocale(request.cookies.get("NEXT_LOCALE")?.value)) {
    const detected = resolveLocale(
      request.headers.get("accept-language"),
      // Vercel-only headers; absent in local dev, which correctly reads as
      // "no geographic signal" rather than as a country.
      request.headers.get("x-vercel-ip-country"),
      request.headers.get("x-vercel-ip-country-region"),
    );
    request.cookies.set(DETECTED_LOCALE_COOKIE, detected);
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

  // Nothing is written to the browser here - see the note above. The only
  // cookie this app ever sets for language is NEXT_LOCALE, and only
  // app/actions.ts setLocale() (the switcher) sets it.
  //
  // No "Vary: Accept-Language" either: appending it from the proxy does not
  // survive, because Next.js writes its own Vary (rsc,
  // next-router-state-tree, ..., Accept-Encoding) over the top - verified by
  // inspecting the response headers.

  if (isSequesteredHost(request.headers.get("host") ?? "")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

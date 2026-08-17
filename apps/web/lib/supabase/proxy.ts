import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env.public";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

// Each sequestered subdomain gets its home/search path rewritten to its
// own page - faith.culturemesh.com to a full religion picker,
// redeemed.culturemesh.com to a Christian-only variant with the religion
// choice hidden. Neither needs its own results page or launch action -
// both stay host-agnostic, driven purely by originKind - and this table
// is the only thing a future subdomain needs to add to.
const SUBDOMAIN_ROUTES: Record<string, string> = {
  "faith.": "/faith",
  "redeemed.": "/redeemed",
};

function rewriteForHost(request: NextRequest): NextRequest["nextUrl"] | null {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
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

  return response;
}

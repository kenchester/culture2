import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env.public";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

// faith.culturemesh.com gets the search/home path rewritten to the
// faith-specific page (religion-based origin instead of language/place),
// so it's sequestered from the main site's search without needing its own
// results page or launch action - both stay host-agnostic, driven purely
// by originKind.
function rewriteForHost(request: NextRequest): NextRequest["nextUrl"] | null {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
  if (host.startsWith("faith.") && (pathname === "/" || pathname === "/search")) {
    const url = request.nextUrl.clone();
    url.pathname = "/faith";
    return url;
  }
  return null;
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

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

export async function createClient() {
  const [cookieStore, headersList] = await Promise.all([cookies(), headers()]);

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: getAuthCookieOptions(headersList.get("host")),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll is called from a Server Component; ignore when
            // proxy.ts is also refreshing the session on this request.
          }
        },
      },
    },
  );
}

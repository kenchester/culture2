import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env.public";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: getAuthCookieOptions(window.location.hostname) },
  );
}

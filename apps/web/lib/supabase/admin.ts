import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client for the one thing the cookie-scoped client can never
// do: look up another user's email (auth.users, not profiles) or read
// their notification_prefs row (RLS restricts that to auth.uid() = user_id).
// Never used to bypass RLS on the actual mutations - those stay on the
// normal per-request client.
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

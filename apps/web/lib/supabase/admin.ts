import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client for two things the cookie-scoped client can never do:
// look up another user's email (auth.users, not profiles) or read their
// notification_prefs row (RLS restricts that to auth.uid() = user_id); and
// server-internal bookkeeping with no owning user at all, like otp_attempts
// (lib/rate-limit.ts) - a table with no anon/authenticated grants, since
// nobody should be able to read or tamper with their own rate-limit count.
// Never used to bypass RLS on a real user's own data - those mutations stay
// on the normal per-request client.
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The one-click link in the unconfirmed-signup nudge email
// (app/api/cron/signup-reminders) - built on the exact same verifyOtp
// primitive the in-app code-entry form already uses
// (app/(auth)/actions.ts's verifyOtp), just triggered by a token_hash in
// the URL instead of a 6-digit code typed by hand. Deliberately NOT a
// Supabase-generated magic link visited directly: this project's
// @supabase/ssr clients default to the PKCE flow, which needs a
// code-exchange callback route this app has never had, so a raw magic
// link would silently fail to establish a session. token_hash (a long,
// effectively unguessable value) is used here rather than the short
// 6-digit email_otp specifically because this route has no attempt-rate-
// limiting of its own beyond whatever Supabase enforces server-side, and
// a 6-digit code is guessable in a way a hash isn't.
//
// Must be a Route Handler, not a Server Component page - only Route
// Handlers, Server Actions, and Middleware can actually persist the
// session cookie verifyOtp needs to set (see lib/supabase/server.ts's own
// comment on this exact restriction).
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const origin = request.nextUrl.origin;

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  return NextResponse.redirect(
    new URL(
      `/sign-in?error=${encodeURIComponent("This link has expired. Enter your email below for a new one.")}`,
      origin,
    ),
  );
}

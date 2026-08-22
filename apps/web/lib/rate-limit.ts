import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Generous enough that nobody doing a normal 1-2-code sign-in ever trips
// this, but tight enough to blunt a bot hammering sendOtp/checkEmailStatus.
const MAX_ATTEMPTS_PER_EMAIL_PER_HOUR = 5;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 8;
const WINDOW_MS = 60 * 60 * 1000;

// Vercel sets x-forwarded-for reliably in production; nothing sets it
// locally, so dev falls back to a fixed bucket rather than crashing.
export async function getClientIp(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function isRateLimited({
  email,
  ip,
}: {
  email: string;
  ip: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
    admin
      .from("otp_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since),
    admin
      .from("otp_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since),
  ]);

  return (
    (emailCount ?? 0) >= MAX_ATTEMPTS_PER_EMAIL_PER_HOUR ||
    (ipCount ?? 0) >= MAX_ATTEMPTS_PER_IP_PER_HOUR
  );
}

export async function recordAttempt({ email, ip }: { email: string; ip: string }) {
  const admin = createAdminClient();
  // Best-effort - a failed insert must not block the OTP flow for a real
  // user just because the rate-limit bookkeeping hiccuped.
  try {
    await admin.from("otp_attempts").insert({ email, ip });
  } catch {
    // non-fatal
  }
}

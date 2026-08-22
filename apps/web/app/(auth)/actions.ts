"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isValid as isNotDisposableEmail } from "mailchecker";
import { createClient } from "@/lib/supabase/server";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

type ActionResult = { ok: true } | { error: string };

// A human filling the email/name form on otp-form.tsx's first step can't
// do it this fast - almost every bot submits within milliseconds of the
// page loading, so this alone catches most of what the honeypot below
// misses (e.g. a bot that only fills fields it recognizes by name and
// never touches "website"). Shared by both sendOtp and checkEmailStatus
// since a bot could hit either one directly.
const MIN_FILL_TIME_MS = 3000;

function isBotSubmission(formData: FormData): boolean {
  const honeypot = formData.get("website") as string;
  const renderedAt = Number(formData.get("renderedAt"));
  const fillTimeMs = Date.now() - renderedAt;
  return Boolean(honeypot) || !renderedAt || fillTimeMs < MIN_FILL_TIME_MS;
}

// Emails a one-time code (Supabase's magic-link endpoint, configured to
// include the code rather than only a clickable link). Works for both new
// and returning users - shouldCreateUser means there's no separate sign-up
// step, the same "enter your email" form handles both, and Supabase decides
// which it is behind the scenes.
export async function sendOtp(formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;

  // Bot signals fail silently (return as if it worked, no email/account
  // ever created) so a bot gets no signal to adjust and retry. A real
  // rate-limit hit, by contrast, tells the truth - a genuine user who
  // mistypes their email a few times deserves to know why nothing arrived.
  if (isBotSubmission(formData)) {
    return { ok: true };
  }

  const t = await getTranslations("auth");
  const ip = await getClientIp();
  if (await isRateLimited({ email, ip })) {
    return { error: t("rateLimited") };
  }

  const supabase = await createClient();

  // Only reject disposable/throwaway domains for brand-new accounts - an
  // existing user who signed up years ago with one must keep working
  // exactly as before. Cheap enough to call the same RPC checkEmailStatus
  // already uses.
  const { data: statusData } = await supabase.rpc("email_account_status", {
    p_email: email,
  });
  const status = statusData as { exists?: boolean } | null;
  if (!status?.exists && !isNotDisposableEmail(email)) {
    return { error: t("disposableEmail") };
  }

  await recordAttempt({ email, ip });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

export async function verifyOtp(formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const token = formData.get("token") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

// Lets the sign-in form choose between the password field, the name step
// (brand-new registrations only), and the code flow for a given email -
// without ever exposing anything about the account beyond these two
// booleans. Also the first stop for every bot targeting this flow (it's
// unauthenticated and would otherwise make a decent email-enumeration
// oracle), so it gets the same bot-signal check as sendOtp - on a hit it
// returns the same generic response a real never-registered email would
// get, and the flow continues on to sendCode/sendOtp, which independently
// re-checks and is where the actual silent no-op/rate-limit happens (this
// function doesn't create anything or send anything itself, so there's
// nothing here for a bot signal to actually block yet).
export async function checkEmailStatus(
  formData: FormData,
): Promise<{ exists: boolean; hasPassword: boolean }> {
  const email = formData.get("email") as string;

  if (isBotSubmission(formData)) {
    return { exists: false, hasPassword: false };
  }

  const ip = await getClientIp();
  if (await isRateLimited({ email, ip })) {
    return { exists: false, hasPassword: false };
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("email_account_status", { p_email: email });
  const status = data as { exists?: boolean; hasPassword?: boolean } | null;

  return { exists: Boolean(status?.exists), hasPassword: Boolean(status?.hasPassword) };
}

// Called once a session actually exists (after a successful verify), to
// attach the name collected during the registration flow - profiles start
// out blank (just an id) from the auth.users trigger, so without this a
// brand-new user shows up everywhere as "CultureMesh member" until they
// separately find their way to the profile editor. Stored as a single
// string in first_name (last_name left null) rather than split into
// first/last - a "First name"/"Last name" split assumes an ordering
// convention that doesn't hold for everyone (e.g. East Asian family-name-
// first naming), and getDisplayName already just joins whatever's present.
export async function setDisplayName(formData: FormData): Promise<ActionResult> {
  const name = formData.get("name") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ first_name: name || null, last_name: null })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

export async function signInWithPassword(formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

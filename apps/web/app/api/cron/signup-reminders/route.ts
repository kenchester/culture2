import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { renderSignupReminderEmail } from "@/lib/branded-email";
import { getSiteUrl } from "@/lib/site-url";
import { env } from "@/lib/env";

// Vercel Cron hits this once a day (vercel.json) - Hobby-plan projects
// can't schedule anything more often, which is fine here since both
// reminders are day-granularity anyway. Nudges anyone who started signing
// up (a real, unconfirmed auth.users row - signInWithOtp creates one
// immediately, before the code is ever verified) but never came back to
// confirm: once ~24h after they started, and a final one ~72h after, each
// exactly once - see profiles.signup_reminder_24h_sent_at /
// signup_reminder_final_sent_at (00000000000071). Re-querying
// email_confirmed_at fresh on every run is what keeps this from ever
// emailing someone who *did* finish signing in the meantime - there's no
// separate "cancel the reminder" step needed, confirmed users simply stop
// matching the filter.
const HOUR_MS = 60 * 60 * 1000;
const FIRST_REMINDER_AFTER_MS = 24 * HOUR_MS;
const FINAL_REMINDER_AFTER_MS = 72 * HOUR_MS;

// Two deliberate blast-radius limits, both added after an early version of
// this job was run by hand with the thresholds temporarily shortened for
// testing and immediately emailed the entire standing backlog of
// unconfirmed accounts. The sent-at flags alone were never enough: they
// stop a *repeat*, but nothing stopped one bad run from reaching everyone
// at once.
//
// STALE_AFTER_MS: someone who signed up and walked away three months ago
// doesn't want a "finish signing up" nudge - that's cold email, not a
// reminder. Anything older than this is skipped permanently, which also
// means a future accidental run can't reach into the historical backlog.
const STALE_AFTER_MS = 30 * 24 * HOUR_MS;
// MAX_SENDS_PER_RUN: a normal day sends a handful. If a run ever wants to
// send far more than that, something is wrong (flags not persisting,
// thresholds misconfigured), and the right failure is to stop early and
// be visible in the response rather than to mail everyone.
const MAX_SENDS_PER_RUN = 25;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const siteUrl = await getSiteUrl();

  // perPage caps at 1000 - fine at this app's current scale (under 100
  // total accounts as of this writing), but whoever revisits this once
  // the userbase is bigger will need to page through listUsers rather
  // than assuming one call covers everyone.
  const { data: authUsers, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const unconfirmed = authUsers.users.filter((u) => u.email && !u.email_confirmed_at && !u.confirmed_at);
  if (unconfirmed.length === 0) {
    return NextResponse.json({ checked: 0, sent24h: 0, sentFinal: 0 });
  }

  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, signup_reminder_24h_sent_at, signup_reminder_final_sent_at")
    .in(
      "id",
      unconfirmed.map((u) => u.id),
    );
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const now = Date.now();
  let sent24h = 0;
  let sentFinal = 0;

  let skippedStale = 0;
  let cappedOut = 0;

  for (const user of unconfirmed) {
    const profile = profileById.get(user.id);
    const elapsedMs = now - new Date(user.created_at).getTime();

    if (elapsedMs >= STALE_AFTER_MS) {
      skippedStale += 1;
      continue;
    }

    // Someone who's already past the 72h mark and never got a first
    // reminder (a backlog catch-up, or a run that was late/missed) gets
    // only the final one, not both back to back - one gentle nudge reads
    // very differently from two emails in the same minute.
    const needsFinal = elapsedMs >= FINAL_REMINDER_AFTER_MS && !profile?.signup_reminder_final_sent_at;
    const needsFirst =
      !needsFinal && elapsedMs >= FIRST_REMINDER_AFTER_MS && !profile?.signup_reminder_24h_sent_at;

    if (!needsFirst && !needsFinal) {
      continue;
    }

    if (sent24h + sentFinal >= MAX_SENDS_PER_RUN) {
      cappedOut += 1;
      continue;
    }

    // A fresh token every time, not the one from signInWithOtp back at
    // creation - that one's long since expired, and this doubles as
    // invalidating anything stale still floating in an old email.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });
    if (linkError || !linkData) {
      continue; // best-effort - picked up again on tomorrow's run
    }

    const confirmUrl = `${siteUrl}/sign-in/confirm?token_hash=${linkData.properties.hashed_token}`;
    const body = needsFinal
      ? "Just one last nudge - you started creating a CultureMesh account, but never finished confirming it. This is the last reminder you'll get about it, so if you'd rather not join, there's nothing else you need to do."
      : "You started creating a CultureMesh account a little while ago but never finished confirming it. If that was you, one click below picks up right where you left off - no need to re-enter anything.";

    // One send per recipient rather than sendBulkEmails - every message
    // needs a different confirmUrl, and per-recipient try/catch means a
    // single failure just gets retried on tomorrow's run instead of
    // risking an entire batch.
    try {
      const { text, html } = renderSignupReminderEmail(body, { label: "Finish signing in", url: confirmUrl });
      await sendEmail({
        to: user.email!,
        subject: needsFinal
          ? "Last chance to finish setting up your CultureMesh account"
          : "Finish setting up your CultureMesh account",
        text,
        html,
      });
    } catch {
      continue;
    }

    const nowIso = new Date().toISOString();
    await admin
      .from("profiles")
      .update(
        needsFinal
          ? { signup_reminder_24h_sent_at: profile?.signup_reminder_24h_sent_at ?? nowIso, signup_reminder_final_sent_at: nowIso }
          : { signup_reminder_24h_sent_at: nowIso },
      )
      .eq("id", user.id);

    if (needsFinal) sentFinal += 1;
    else sent24h += 1;
  }

  // cappedOut > 0 in a normal run means something is wrong and deserves a
  // look at the cron logs, not a silent success.
  return NextResponse.json({ checked: unconfirmed.length, sent24h, sentFinal, skippedStale, cappedOut });
}

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_SEND_ENABLED, sendEmail } from "@/lib/email";
import { renderNetworkRescueEmail } from "@/lib/branded-email";
import { getEmailSiteUrl } from "@/lib/site-url";
import { corridorSlug, slugWithId } from "@/lib/slug";
import { env } from "@/lib/env";

/**
 * The email nobody has ever sent: "people came back, and you're still
 * alone here."
 *
 * 24 networks have no members at all; 51 - the ones this job is about -
 * have exactly one, and most of those have been stuck there for over a
 * month. The only existing cron (signup-reminders) nudges someone who
 * never finished confirming an account. Nobody has ever gone back to the
 * person who DID finish - who launched a network, told nobody came, and
 * heard nothing back since.
 *
 * This is deliberately NOT a generic "come back!" drip. It only fires
 * when page_views shows real traffic on this person's own network page or
 * its corridor/language reference page in the last 30 days, and it quotes
 * that real number. An email claiming interest that doesn't exist would
 * be worse than silence - the whole point is that the loneliness is about
 * to end, provably, not just asserted.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const STUCK_AFTER_MS = 30 * DAY_MS;
const VIEW_WINDOW_DAYS = 30;
// Resend at most once a month to any one founder - this is a far more
// sensitive nudge than "finish confirming your email," and repeating it
// weekly would read as the site nagging someone about their own loneliness.
const RESEND_COOLDOWN_MS = 30 * DAY_MS;
// Smaller than signup-reminders' 25: this list is currently under 50
// people in total, and a cap this low is itself a canary - hitting it
// would mean the gating logic broke, not that organic growth exploded.
const MAX_SENDS_PER_RUN = 10;

type NetworkRow = {
  id: number;
  title: string;
  language_id: number | null;
  origin_place_id: number | null;
  location_place_id: number;
  launched_at: string;
  rescue_email_sent_at: string | null;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const siteUrl = await getEmailSiteUrl();
  const now = Date.now();

  const { data: stuck, error: networksError } = await admin
    .from("networks")
    .select("id, title, language_id, origin_place_id, location_place_id, launched_at, rescue_email_sent_at")
    .eq("member_count", 1)
    .lte("launched_at", new Date(now - STUCK_AFTER_MS).toISOString());
  if (networksError) {
    return NextResponse.json({ error: networksError.message }, { status: 500 });
  }

  const candidates = ((stuck ?? []) as NetworkRow[]).filter(
    (n) =>
      !n.rescue_email_sent_at || now - new Date(n.rescue_email_sent_at).getTime() >= RESEND_COOLDOWN_MS,
  );

  let sent = 0;
  let skippedNoDemand = 0;
  let skippedNoFounder = 0;
  let cappedOut = 0;

  for (const network of candidates) {
    if (sent >= MAX_SENDS_PER_RUN) {
      cappedOut += 1;
      continue;
    }

    // Every network has a location, so this is fetched unconditionally -
    // and checked before anything else, regardless of origin kind.
    // hidden_from_search covers organisation anchors and test geographies
    // (00000000000044); a network anchored on one is never surfaced on any
    // reference page elsewhere on the site, and rescuing its "founder"
    // would mean emailing a real person about a leftover test fixture,
    // not a real community.
    const { data: location } = await admin
      .from("places")
      .select("id, name, hidden_from_search")
      .eq("id", network.location_place_id)
      .single();
    if (!location || location.hidden_from_search) {
      skippedNoDemand += 1;
      continue;
    }

    // The reference page this network maps to, if any - a language
    // network has no corridor, and a place-origin network has no language
    // page, so at most one of these applies.
    const referencePaths = [`/networks:${network.id}`];
    if (network.origin_place_id) {
      const { data: origin } = await admin
        .from("places")
        .select("id, name, hidden_from_search")
        .eq("id", network.origin_place_id)
        .single();
      if (!origin || origin.hidden_from_search) {
        skippedNoDemand += 1;
        continue;
      }
      referencePaths.push(
        `/corridors:${corridorSlug({ id: origin.id, name: origin.name }, { id: location.id, name: location.name })}`,
      );
    } else if (network.language_id) {
      const { data: language } = await admin
        .from("languages")
        .select("id, name")
        .eq("id", network.language_id)
        .single();
      if (language) {
        referencePaths.push(`/languages:${slugWithId(language.name, language.id)}`);
      }
    }

    const { data: viewRows } = await admin
      .from("page_views")
      .select("views")
      .in("path", referencePaths)
      .gte("day", new Date(now - VIEW_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10));
    const totalViews = (viewRows ?? []).reduce((sum, row) => sum + (row.views as number), 0);

    // No proof, no email. This is the gate that makes the whole feature
    // honest rather than a generic nag - it's also why this job will
    // quietly do nothing on a quiet month, which is correct.
    if (totalViews === 0) {
      skippedNoDemand += 1;
      continue;
    }

    const { data: membership } = await admin
      .from("network_members")
      .select("user_id")
      .eq("network_id", network.id)
      .limit(1)
      .maybeSingle();
    if (!membership) {
      // member_count said 1 but the row is gone (left, or the counter is
      // stale) - nobody to rescue.
      skippedNoFounder += 1;
      continue;
    }

    const { data: founder, error: founderError } = await admin.auth.admin.getUserById(
      membership.user_id,
    );
    if (founderError || !founder.user.email) {
      skippedNoFounder += 1;
      continue;
    }

    const inviteUrl = `${siteUrl}/networks/${network.id}`;
    const body =
      totalViews === 1
        ? `1 person looked at pages about "${network.title}" in the last 30 days. You're still the only member - want to send your invite link to a few more people?`
        : `${totalViews} people looked at pages about "${network.title}" in the last 30 days. You're still the only member - want to send your invite link to a few more people?`;

    try {
      const { text, html } = renderNetworkRescueEmail(body, { label: "Open your network", url: inviteUrl });
      await sendEmail({
        to: founder.user.email,
        subject: `People are looking for "${network.title}"`,
        text,
        html,
      });
    } catch {
      continue; // best-effort - picked up again next run
    }

    // Only stamped when mail genuinely went out - see EMAIL_SEND_ENABLED.
    // Outside production this run is a dry run by construction: `sent`
    // below still counts it (so the response reflects what WOULD happen),
    // but the cooldown is left untouched for the real send later.
    if (EMAIL_SEND_ENABLED) {
      await admin
        .from("networks")
        .update({ rescue_email_sent_at: new Date().toISOString() })
        .eq("id", network.id);
    }
    sent += 1;
  }

  return NextResponse.json({
    checked: candidates.length,
    sent,
    skippedNoDemand,
    skippedNoFounder,
    cappedOut,
  });
}

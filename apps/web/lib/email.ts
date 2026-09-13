import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

const FROM = "CultureMesh <noreply@culturemesh.com>";

/**
 * Real mail goes out from the production deployment and nowhere else.
 *
 * Every notification path here is triggered by ordinary activity - posting,
 * replying - so simply *using* the app against the production database
 * emails whoever is subscribed. Running the app locally to test a feature
 * therefore mails real people, which has now happened twice: once from a
 * cron endpoint, and once from a dev server, where recipients got working
 * notifications pointing at http://localhost:3000.
 *
 * VERCEL_ENV is set by Vercel to "production" only on the production
 * deployment; it is "preview" on branch deploys and absent locally. So
 * previews and local runs log instead of sending, and the failure mode if
 * it is somehow unset in production is loud (no mail, with a reason in the
 * logs) rather than silent.
 */
const EMAIL_ENABLED = process.env.VERCEL_ENV === "production";

function logSuppressed(recipients: string[], subject: string) {
  console.info(
    `[email] suppressed (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}): ` +
      `would have sent "${subject}" to ${recipients.length} recipient(s): ${recipients.join(", ")}`,
  );
}

// Resend's SDK returns { data, error } rather than throwing on API
// failures (e.g. an invalid recipient domain) - callers that treat sending
// as best-effort (wrapped in their own try/catch) rely on this throwing so
// their catch block still fires; callers where sending IS the point (like
// network invites) need this to fail loudly instead of silently reporting
// success.
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!EMAIL_ENABLED) {
    logSuppressed([to], subject);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, text, ...(html ? { html } : {}) });
  if (error) {
    throw new Error(error.message);
  }
}

// Resend's batch API caps at 100 emails per call, so callers with larger
// recipient lists (network activity, product updates) get chunked here
// rather than needing to know that limit themselves.
const BATCH_SIZE = 100;

export async function sendBulkEmails(
  recipients: { to: string; subject: string; text: string; html?: string }[],
) {
  if (!EMAIL_ENABLED) {
    logSuppressed(recipients.map((r) => r.to), recipients[0]?.subject ?? "(batch)");
    return;
  }
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const { error } = await resend.batch.send(
      chunk.map((r) => ({
        from: FROM,
        to: r.to,
        subject: r.subject,
        text: r.text,
        ...(r.html ? { html: r.html } : {}),
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}

import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

const FROM = "CultureMesh <noreply@culturemesh.com>";

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
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const { error } = await resend.emails.send({ from: FROM, to, subject, text });
  if (error) {
    throw new Error(error.message);
  }
}

// Resend's batch API caps at 100 emails per call, so callers with larger
// recipient lists (network activity, product updates) get chunked here
// rather than needing to know that limit themselves.
const BATCH_SIZE = 100;

export async function sendBulkEmails(
  recipients: { to: string; subject: string; text: string }[],
) {
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const { error } = await resend.batch.send(
      chunk.map((r) => ({ from: FROM, to: r.to, subject: r.subject, text: r.text })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}

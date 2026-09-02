"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendBulkEmails } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site-url";

export async function postProductUpdate(formData: FormData) {
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!title.trim() || !body.trim()) {
    redirect(
      `/admin/product-updates?error=${encodeURIComponent("Title and body are required.")}`,
    );
  }

  // DB-level RLS (admins-only insert) is the real enforcement boundary
  // here, same as places/languages and embed-partners - this is just the
  // path a signed-out or non-admin request would already be blocked by
  // the admin layout gate before reaching.
  const { error } = await supabase
    .from("product_updates")
    .insert({ title, body, posted_by: user.id });

  if (error) {
    redirect(`/admin/product-updates?error=${encodeURIComponent(error.message)}`);
  }

  // Best-effort - the update is already published above, so an email
  // hiccup here shouldn't turn a successful publish into an error.
  try {
    const { data: allUsers } = await supabase.from("profiles").select("id");
    const candidateIds = (allUsers ?? []).map((u) => u.id as string);
    const recipients = await getOptedInRecipients(candidateIds, "product_updates");

    if (recipients.length > 0) {
      const siteUrl = await getSiteUrl();
      await sendBulkEmails(
        recipients.map((r) => ({
          to: r.email,
          subject: `CultureMesh update: ${title}`,
          text: `${body}\n\n${siteUrl}`,
        })),
      );
    }
  } catch {
    // notification failure is non-fatal
  }

  revalidatePath("/admin/product-updates");
  redirect("/admin/product-updates?posted=1");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Deliberately plain "[label](url)" markdown, not a full markdown parser -
// the Body field is a bare textarea (no rich-text editor anywhere in this
// app), so this is the smallest syntax that still lets an admin see and
// edit link placement inline instead of juggling raw <a> tags.
const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// text: markdown links reduced to "label (url)" for plain-text clients.
// html: same links turned into real <a href> - escapeHtml runs first, which
// is safe for the URL too (a literal "&" in a query string, like the
// contact link's "subject=...&message=...", is exactly what HTML expects
// escaped to "&amp;" inside an href attribute).
function renderEmailBody(body: string): { text: string; html: string } {
  const text = body.replace(MARKDOWN_LINK, (_match, label: string, url: string) => `${label} (${url})`);
  const html = escapeHtml(body)
    .replace(MARKDOWN_LINK, (_match, label: string, url: string) => `<a href="${url}">${label}</a>`)
    .replace(/\n/g, "<br>");
  return { text, html };
}

// The Onboarded School / Yet-to-be-onboarded School audiences
// (app/admin/product-updates/update-form.tsx) - unlike postProductUpdate
// above, this is never a site-wide announcement: it's a handful to dozens
// of pasted, admin-curated addresses (often not CultureMesh users at all
// yet), so nothing here touches product_updates or getOptedInRecipients.
export async function sendOutreachEmail(formData: FormData) {
  const title = ((formData.get("title") as string) ?? "").trim();
  const greeting = ((formData.get("greeting") as string) ?? "").trim();
  const body = ((formData.get("body") as string) ?? "").trim();
  const emailsRaw = (formData.get("emails") as string) ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!title || !body) {
    redirect(`/admin/product-updates?error=${encodeURIComponent("Title and body are required.")}`);
  }

  // The <select> is required and starts unselected client-side (a picked
  // default was too easy to send past without noticing it was wrong for
  // the recipient's time zone) - this is the server-side backstop for that
  // same rule, not a client-only nicety.
  if (!greeting) {
    redirect(`/admin/product-updates?error=${encodeURIComponent("Select a greeting.")}`);
  }

  // Tolerates "a@b.com, c@d.com" and "a@b.com,c@d.com" alike - trimming
  // each piece after the split handles both without needing a fancier
  // regex, same approach sendNetworkInvites (app/networks/actions.ts)
  // already uses for its own comma-separated email box.
  const emails = Array.from(
    new Set(
      emailsRaw
        .split(",")
        .map((e) => e.trim())
        .filter((e) => EMAIL_PATTERN.test(e)),
    ),
  );

  if (emails.length === 0) {
    redirect(`/admin/product-updates?error=${encodeURIComponent("Enter at least one valid email address.")}`);
  }

  const fullBody = greeting ? `${greeting}\n\n${body}` : body;
  const { text, html } = renderEmailBody(fullBody);

  // Sending IS the point of this action (unlike postProductUpdate's
  // notification email, there's no other successful side effect to fall
  // back on), so a failure here has to surface as a real error.
  try {
    await sendBulkEmails(
      emails.map((to) => ({
        to,
        subject: title,
        text,
        html: `<div style="font-family:sans-serif;line-height:1.6">${html}</div>`,
      })),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong sending the emails.";
    redirect(`/admin/product-updates?error=${encodeURIComponent(message)}`);
  }

  redirect(`/admin/product-updates?posted=1&sentCount=${emails.length}`);
}

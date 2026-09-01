"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

// A human can't fill four fields faster than this - almost every bot
// submits within milliseconds of loading the page, so this alone filters
// out the ones that skip the honeypot below (e.g. because it only fills
// fields it recognizes by name, and never touches "website").
const MIN_FILL_TIME_MS = 3000;

export async function sendContactMessage(formData: FormData) {
  // Bot signals are checked before touching any real field - a submission
  // that trips either one is silently treated as successful (no email
  // sent) rather than surfaced as an error, so a bot gets no signal to
  // adjust its behavior and try again.
  const honeypot = formData.get("website") as string;
  const renderedAt = Number(formData.get("renderedAt"));
  const fillTimeMs = Date.now() - renderedAt;
  if (honeypot || !renderedAt || fillTimeMs < MIN_FILL_TIME_MS) {
    redirect("/contact?sent=1");
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const message = formData.get("message") as string;
  // Only present when subject is "CultureMesh Learn Interest" - see
  // app/(marketing)/contact/subject-field.tsx.
  const institution = formData.get("institution") as string | null;

  const { error } = await resend.emails.send({
    from: "CultureMesh Contact Form <noreply@culturemesh.com>",
    to: "kenchester2@gmail.com",
    replyTo: email,
    subject: `[Contact form] ${subject}: ${name}`,
    text: `From: ${name} <${email}>\nSubject: ${subject}${institution ? `\nInstitution: ${institution}` : ""}\n\n${message}`,
  });

  if (error) {
    redirect(`/contact?error=${encodeURIComponent("Something went wrong sending your message. Please try again.")}`);
  }

  redirect("/contact?sent=1");
}

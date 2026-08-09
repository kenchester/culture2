"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendContactMessage(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const message = formData.get("message") as string;

  const { error } = await resend.emails.send({
    from: "CultureMesh Contact Form <noreply@culturemesh.com>",
    to: "hello@culturemesh.com",
    replyTo: email,
    subject: `[Contact form] ${subject}: ${name}`,
    text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
  });

  if (error) {
    redirect(`/contact?error=${encodeURIComponent("Something went wrong sending your message. Please try again.")}`);
  }

  redirect("/contact?sent=1");
}

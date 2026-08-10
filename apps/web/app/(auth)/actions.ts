"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { error: string };

// Emails a one-time code (Supabase's magic-link endpoint, configured to
// include the code rather than only a clickable link). Works for both new
// and returning users - shouldCreateUser means there's no separate sign-up
// step, the same "enter your email" form handles both, and Supabase decides
// which it is behind the scenes.
export async function sendOtp(formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;

  const supabase = await createClient();
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

// Lets the sign-in form choose between the password field and the code
// flow for a given email, without ever exposing anything about the account
// beyond that one boolean.
export async function checkHasPassword(formData: FormData): Promise<{ hasPassword: boolean }> {
  const email = formData.get("email") as string;

  const supabase = await createClient();
  const { data } = await supabase.rpc("email_has_password", { p_email: email });

  return { hasPassword: Boolean(data) };
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

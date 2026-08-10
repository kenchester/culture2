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

// Lets the sign-in form choose between the password field, the name step
// (brand-new registrations only), and the code flow for a given email -
// without ever exposing anything about the account beyond these two
// booleans.
export async function checkEmailStatus(
  formData: FormData,
): Promise<{ exists: boolean; hasPassword: boolean }> {
  const email = formData.get("email") as string;

  const supabase = await createClient();
  const { data } = await supabase.rpc("email_account_status", { p_email: email });
  const status = data as { exists?: boolean; hasPassword?: boolean } | null;

  return { exists: Boolean(status?.exists), hasPassword: Boolean(status?.hasPassword) };
}

// Called once a session actually exists (after a successful verify), to
// attach the name collected during the registration flow - profiles start
// out blank (just an id) from the auth.users trigger, so without this a
// brand-new user shows up everywhere as "CultureMesh member" until they
// separately find their way to the profile editor.
export async function setDisplayName(formData: FormData): Promise<ActionResult> {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ first_name: firstName || null, last_name: lastName || null })
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

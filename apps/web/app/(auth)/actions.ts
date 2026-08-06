"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/confirm");
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Verification only happens on this explicit user-initiated action (a real
// form submit), never on the bare GET of the email link itself — mail
// providers' link-scanners (e.g. Gmail Safe Browsing prefetch) fetch links
// automatically, which would silently burn a single-use token before the
// person ever clicks it.
export async function confirmEmail(formData: FormData) {
  const tokenHash = formData.get("token_hash") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });

  if (error) {
    redirect(`/confirm?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/reset-password?sent=1");
}

// For a user who already has a session (e.g. changing their password from
// within the app, not via an emailed recovery link).
export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/sign-in?reset=1");
}

// Same single-click-consumes-the-token reasoning as confirmEmail: verifying
// and setting the new password happen together in one explicit submit.
export async function resetPasswordWithToken(formData: FormData) {
  const tokenHash = formData.get("token_hash") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (verifyError) {
    redirect(`/reset-password?error=${encodeURIComponent(verifyError.message)}`);
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    redirect(`/reset-password?error=${encodeURIComponent(updateError.message)}`);
  }

  redirect("/sign-in?reset=1");
}

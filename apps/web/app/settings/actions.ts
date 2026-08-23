"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "@/app/(auth)/actions";

export async function updateNotificationPrefs(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { error } = await supabase
    .from("notification_prefs")
    .update({
      events_upcoming: formData.get("events_upcoming") === "on",
      network_activity: formData.get("network_activity") === "on",
      replies_to_your_posts: formData.get("replies_to_your_posts") === "on",
      likes_on_your_posts: formData.get("likes_on_your_posts") === "on",
      product_updates: formData.get("product_updates") === "on",
    })
    .eq("user_id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

// Reuses the same setPassword action the OTP flow calls right after
// verification (app/(auth)/actions.ts) - it only ever touches a
// "password" field and the current session, nothing OTP-specific, so
// it works identically here for someone who skipped setting one during
// sign-up (or just wants to change it) from a normal authenticated
// settings visit.
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const result = await setPassword(formData);
  if ("error" in result) {
    redirect(`/settings?passwordError=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/settings");
  // Its own query param (not the notification form's ?saved=1) so the
  // confirmation can be scoped to the Password card specifically - a
  // generic "Saved." at the top of the page doesn't reassure anyone
  // that the password itself actually changed, which matters more here
  // than for a notification checkbox.
  redirect("/settings?passwordSaved=1");
}

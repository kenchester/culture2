"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

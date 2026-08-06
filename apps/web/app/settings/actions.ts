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
      events_interested_in: formData.get("events_interested_in") === "on",
      network_activity: formData.get("network_activity") === "on",
      product_updates: formData.get("product_updates") === "on",
    })
    .eq("user_id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

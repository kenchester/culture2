"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function suggestNetwork(formData: FormData) {
  const originText = formData.get("originText") as string;
  const locationText = formData.get("locationText") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to suggest a network.")}`);
  }

  const { error } = await supabase.from("suggested_networks").insert({
    suggested_by: user.id,
    origin_text: originText,
    location_text: locationText,
  });

  if (error) {
    redirect(`/suggest-network?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/suggest-network?sent=1");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function rsvp(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const networkId = formData.get("networkId") as string;
  const status = formData.get("status") as string;
  const embedSuffix = formData.get("embed") === "1" ? "&embed=1" : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to RSVP.")}`);
  }

  const { error } = await supabase
    .from("event_rsvps")
    .upsert(
      { event_id: Number(eventId), user_id: user.id, status },
      { onConflict: "event_id,user_id" },
    );

  if (error) {
    redirect(
      `/networks/${networkId}/events/${eventId}?error=${encodeURIComponent(error.message)}${embedSuffix}`,
    );
  }

  revalidatePath(`/networks/${networkId}/events/${eventId}`);
}

export async function cancelRsvp(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const networkId = formData.get("networkId") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  await supabase
    .from("event_rsvps")
    .delete()
    .eq("event_id", Number(eventId))
    .eq("user_id", user.id);

  revalidatePath(`/networks/${networkId}/events/${eventId}`);
}

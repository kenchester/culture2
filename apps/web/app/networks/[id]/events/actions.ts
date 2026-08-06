"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createEvent(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const eventDate = formData.get("eventDate") as string;
  const location = formData.get("location") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to host an event.")}`);
  }

  const { error } = await supabase.from("events").insert({
    network_id: Number(networkId),
    host_id: user.id,
    title,
    description: description || null,
    event_date: eventDate,
    location: location || null,
  });

  if (error) {
    redirect(`/networks/${networkId}/events?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/networks/${networkId}/events`);
}

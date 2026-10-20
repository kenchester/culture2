"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Add a note to a city or corridor.
 *
 * The one write here, and it needs an account but not membership of
 * anything - the person best placed to correct a city's figures may
 * belong to no network yet, and gating the correction behind joining
 * would block exactly the contribution worth having.
 */
export async function postNote(formData: FormData) {
  const placeA = Number(formData.get("placeA"));
  const placeBRaw = formData.get("placeB");
  const placeB = placeBRaw ? Number(placeBRaw) : null;
  const topic = formData.get("topic") as string;
  const body = ((formData.get("body") as string) ?? "").trim();
  const returnTo = (formData.get("returnTo") as string) ?? "/";

  if (!body) redirect(`${returnTo}?error=${encodeURIComponent("Write a sentence or two first.")}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);

  const { error } = await supabase.from("community_notes").insert({
    place_a: placeA,
    place_b: placeB,
    topic,
    body,
    user_id: user.id,
  });

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(returnTo);
  redirect(returnTo);
}

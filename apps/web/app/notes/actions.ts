"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Add a note to a city, a corridor, or a language.
 *
 * The one write here, and it needs an account but not membership of
 * anything - the person best placed to correct a city's figures may
 * belong to no network yet, and gating the correction behind joining
 * would block exactly the contribution worth having.
 *
 * Exactly one subject, which the community_notes_subject constraint
 * (00000000000100) enforces in the database. This function does not
 * re-check it: a second copy of the rule here could only drift from the
 * first, and the constraint rejects a malformed insert either way.
 */
export async function postNote(formData: FormData) {
  const placeARaw = formData.get("placeA");
  const placeA = placeARaw ? Number(placeARaw) : null;
  const placeBRaw = formData.get("placeB");
  const placeB = placeBRaw ? Number(placeBRaw) : null;
  const languageIdRaw = formData.get("languageId");
  const languageId = languageIdRaw ? Number(languageIdRaw) : null;
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
    language_id: languageId,
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

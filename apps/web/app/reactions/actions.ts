"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * One tap, recorded or flipped.
 *
 * The write behind StatReaction (components/stat-reaction.tsx). Needs an
 * account for the same reason the aggregate means anything at all - a
 * count of anonymous taps could be one person refreshing the page - but
 * never network membership, matching postNote's own reasoning: the
 * person best placed to confirm a figure may belong to nothing here yet.
 *
 * Select-then-write, not .upsert(). stat_reactions_one_each_idx
 * (00000000000106) is an EXPRESSION index (coalesce(place_a, -1), ...),
 * needed because place_b/language_id are nullable and a plain unique
 * index treats every NULL as distinct from every other NULL - but
 * Postgres's ON CONFLICT can only target a literal column list or a
 * constraint name, never an expression index, so .upsert() would fail
 * against this table the same way it already did once this session
 * against a similar index on corridor_answers - fixed there, and here,
 * by looking the row up first instead.
 */
export async function reactToStat(formData: FormData) {
  const placeARaw = formData.get("placeA") as string;
  const placeBRaw = formData.get("placeB") as string;
  const languageIdRaw = formData.get("languageId") as string;
  const placeA = placeARaw ? Number(placeARaw) : null;
  const placeB = placeBRaw ? Number(placeBRaw) : null;
  const languageId = languageIdRaw ? Number(languageIdRaw) : null;
  const topic = formData.get("topic") as string;
  const isAccurate = formData.get("isAccurate") === "true";
  const returnTo = (formData.get("returnTo") as string) ?? "/";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);

  let existing = supabase
    .from("stat_reactions")
    .select("id")
    .eq("topic", topic)
    .eq("user_id", user.id);
  existing = languageId
    ? existing.eq("language_id", languageId)
    : placeB
      ? existing.eq("place_a", placeA!).eq("place_b", placeB)
      : existing.eq("place_a", placeA!).is("place_b", null);
  const { data: existingRow } = await existing.maybeSingle();

  const { error } = existingRow
    ? await supabase
        .from("stat_reactions")
        .update({ is_accurate: isAccurate, updated_at: new Date().toISOString() })
        .eq("id", existingRow.id)
    : await supabase.from("stat_reactions").insert({
        place_a: placeA,
        place_b: placeB,
        language_id: languageId,
        topic,
        is_accurate: isAccurate,
        user_id: user.id,
      });

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(returnTo);
  redirect(returnTo);
}

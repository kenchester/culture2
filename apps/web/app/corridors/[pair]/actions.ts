"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Who may do any of this lives in the RLS policies on trips and
 * corridor_answers (00000000000096), which gate everything on
 * is_corridor_member. These actions carry the write and surface the
 * message; they do not restate the rule, so there is no second copy to
 * drift from the first.
 */
function back(pair: string, message?: string): never {
  redirect(message ? `/corridors/${pair}?error=${encodeURIComponent(message)}` : `/corridors/${pair}`);
}

export async function postTrip(formData: FormData) {
  const pair = formData.get("pair") as string;
  const [fromId, toId] = ((formData.get("direction") as string) ?? "")
    .split(":")
    .map(Number);
  const travelDate = formData.get("travelDate") as string;
  const offering = formData.get("offering") as string;
  const note = ((formData.get("note") as string) ?? "").trim();

  if (!fromId || !toId || !travelDate) back(pair, "Choose a direction and a date.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?returnTo=/corridors/${pair}`);

  const { error } = await supabase.from("trips").insert({
    user_id: user.id,
    from_place_id: fromId,
    to_place_id: toId,
    travel_date: travelDate,
    offering,
    note: note || null,
  });
  // A policy rejection reads as an empty result rather than a sentence,
  // so say the actual reason.
  if (error) {
    back(
      pair,
      error.message.includes("row-level security")
        ? "Only members of a community on this route can post a trip."
        : error.message,
    );
  }
  revalidatePath(`/corridors/${pair}`);
  back(pair);
}

export async function cancelTrip(formData: FormData) {
  const pair = formData.get("pair") as string;
  const tripId = Number(formData.get("tripId"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("trips")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", tripId);
  if (error) back(pair, error.message);
  revalidatePath(`/corridors/${pair}`);
  back(pair);
}

export async function postCorridorAnswer(formData: FormData) {
  const pair = formData.get("pair") as string;
  const questionId = Number(formData.get("questionId"));
  const [fromId, toId] = ((formData.get("direction") as string) ?? "")
    .split(":")
    .map(Number);
  const body = ((formData.get("body") as string) ?? "").trim();

  if (!body) back(pair, "Write a sentence or two first.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?returnTo=/corridors/${pair}`);

  // One answer per person per question per direction - editing rather
  // than stacking, which the unique index enforces.
  const { data: existing } = await supabase
    .from("corridor_answers")
    .select("id")
    .eq("question_id", questionId)
    .eq("from_place_id", fromId)
    .eq("to_place_id", toId)
    .eq("user_id", user.id)
    .is("hidden_at", null)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("corridor_answers")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase.from("corridor_answers").insert({
        question_id: questionId,
        from_place_id: fromId,
        to_place_id: toId,
        user_id: user.id,
        body,
      });

  if (error) {
    back(
      pair,
      error.message.includes("row-level security")
        ? "Join a community on this route to answer."
        : error.message,
    );
  }
  revalidatePath(`/corridors/${pair}`);
  back(pair);
}

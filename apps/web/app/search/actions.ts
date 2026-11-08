"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeYourself } from "@/lib/describe-yourself";

// Launching no longer requires an account - only joining/posting does, via
// the "Sign in to join" prompt on the resulting network page.
export async function launchNetwork(formData: FormData) {
  const originKind = formData.get("originKind") as string;
  const originId = Number(formData.get("originId"));
  const locationId = Number(formData.get("locationId"));
  const title = formData.get("title") as string;
  const isLanguage = originKind === "language";
  const isReligion = originKind === "religion";

  const resultsUrl = `/search/results?originKind=${originKind}&originId=${originId}&locationId=${locationId}`;

  const supabase = await createClient();

  const { data: networkId, error } = await supabase.rpc("launch_network", {
    p_language_id: isLanguage ? originId : null,
    p_origin_place_id: !isLanguage && !isReligion ? originId : null,
    p_religion_id: isReligion ? originId : null,
    p_location_place_id: locationId,
    p_title: title,
  });

  if (error) {
    redirect(`${resultsUrl}&error=${encodeURIComponent(error.message)}`);
  }

  // Same reason as launchLanguageNetwork: the results page still has a
  // cached copy offering to launch a network that now exists, so going
  // Back after launching would show the old "no network yet" state.
  // revalidatePath matches on pathname only, which is what we want here -
  // every origin/location combination that could list this network is
  // invalidated, not just the one query string we came from.
  revalidatePath("/search/results");

  redirect(`/networks/${networkId}`);
}

/**
 * The free-text alternative to filling in the two autocomplete fields by
 * hand - "I just moved to Houston from Fuzhou" instead of picking Fuzhou,
 * then Houston, from two separate dropdowns.
 *
 * Does no matching of its own. describeYourself only pulls out the same
 * two short queries the manual form collects (lib/describe-yourself.ts
 * explains why that keeps this safe against arbitrary input); everything
 * after that - guessing candidates, offering a choice when ambiguous,
 * launching a network - is the EXISTING /search/results page, unmodified.
 * This function's only job is to land there with the blanks already
 * filled in.
 */
export async function searchFromDescription(formData: FormData) {
  const text = (formData.get("description") as string) ?? "";

  const extracted = await describeYourself(text);
  if (process.env.NODE_ENV !== "production") {
    console.warn("[searchFromDescription] text=", JSON.stringify(text), "extracted=", JSON.stringify(extracted));
  }

  if (!extracted || !extracted.originQuery || !extracted.locationQuery) {
    // Never a dead end - send them to the form this was always standing
    // in for, with a reason rather than silence.
    redirect(
      `/search?error=${encodeURIComponent(
        "Couldn't find both an origin and a location in that - try the form below instead.",
      )}`,
    );
  }

  const params = new URLSearchParams({
    originKind: extracted.originKind as string,
    originQuery: extracted.originQuery,
    locationQuery: extracted.locationQuery,
  });
  redirect(`/search/results?${params.toString()}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

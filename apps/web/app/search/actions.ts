"use server";

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

  redirect(`/networks/${networkId}`);
}

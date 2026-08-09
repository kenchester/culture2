"use server";

import { createClient } from "@/lib/supabase/server";

// Everything here stays inside the partner's iframe - no window.top
// breakout. Launching no longer requires an account (only joining/posting
// does, via the "Sign in to join" prompt on the resulting network page),
// so an anonymous embed visitor lands straight on the new network.
export async function launchNetworkForEmbed(formData: FormData) {
  const originKind = formData.get("originKind") as string;
  const originId = Number(formData.get("originId"));
  const locationId = Number(formData.get("locationId"));
  const title = formData.get("title") as string;
  const isLanguage = originKind === "language";

  const supabase = await createClient();

  const { data: networkId, error } = await supabase.rpc("launch_network", {
    p_language_id: isLanguage ? originId : null,
    p_origin_place_id: isLanguage ? null : originId,
    p_location_place_id: locationId,
    p_title: title,
  });

  if (error) {
    return { error: error.message, redirectPath: null };
  }

  return { error: null, redirectPath: `/networks/${networkId}?embed=1` };
}

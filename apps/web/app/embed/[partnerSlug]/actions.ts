"use server";

import { createClient } from "@/lib/supabase/server";

// Server Actions submit via fetch() inside the iframe's own script context,
// so a plain <form target="_top"> can never break out to the parent page -
// the target attribute only affects real (non-JS) browser navigation.
// Returning the destination and navigating window.top from the client is
// the only way to actually land the user on the real site instead of
// trapping them inside the embed.
export async function launchNetworkForEmbed(formData: FormData) {
  const originKind = formData.get("originKind") as string;
  const originId = Number(formData.get("originId"));
  const locationId = Number(formData.get("locationId"));
  const title = formData.get("title") as string;
  const isLanguage = originKind === "language";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: null, redirectPath: "/sign-in" };
  }

  const { data: networkId, error } = await supabase.rpc("launch_network", {
    p_language_id: isLanguage ? originId : null,
    p_origin_place_id: isLanguage ? null : originId,
    p_location_place_id: locationId,
    p_title: title,
  });

  if (error) {
    return { error: error.message, redirectPath: null };
  }

  return { error: null, redirectPath: `/networks/${networkId}` };
}

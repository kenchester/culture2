"use server";

import { createClient } from "@/lib/supabase/server";

// Everything here stays inside the partner's iframe - no window.top
// breakout. Sign-in/sign-up (and, for existing networks, the resulting
// network page) render with ?embed=1, which tells Nav/Footer to render no
// CultureMesh chrome, so the visitor never appears to leave the partner's
// site even though the iframe's own content changes.
export async function launchNetworkForEmbed(formData: FormData) {
  const partnerSlug = formData.get("partnerSlug") as string;
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
    const returnTo = `/embed/${partnerSlug}?locationId=${locationId}`;
    return {
      error: null,
      redirectPath: `/sign-in?embed=1&returnTo=${encodeURIComponent(returnTo)}`,
    };
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

  return { error: null, redirectPath: `/networks/${networkId}?embed=1` };
}

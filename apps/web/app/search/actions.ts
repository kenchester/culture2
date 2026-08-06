"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function launchNetwork(formData: FormData) {
  const originKind = formData.get("originKind") as string;
  const originId = Number(formData.get("originId"));
  const locationId = Number(formData.get("locationId"));
  const title = formData.get("title") as string;
  const isLanguage = originKind === "language";

  const resultsUrl = `/search/results?originKind=${originKind}&originId=${originId}&locationId=${locationId}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to launch a network.")}`);
  }

  const { data: networkId, error } = await supabase.rpc("launch_network", {
    p_language_id: isLanguage ? originId : null,
    p_origin_place_id: isLanguage ? null : originId,
    p_location_place_id: locationId,
    p_title: title,
  });

  if (error) {
    redirect(`${resultsUrl}&error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/networks/${networkId}`);
}

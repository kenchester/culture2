"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function insertPartnerFromForm(formData: FormData) {
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const originKind = formData.get("originKind") as string;
  const originId = formData.get("originId") as string;
  const hideOriginLabel = formData.get("hideOriginLabel") === "on";
  const originIsGlobal = formData.get("originIsGlobal") === "on";
  const useHomePlace = formData.get("useHomePlace") === "on";
  const homePlaceIdRaw = formData.get("homePlaceId") as string | null;
  // 'outbound' when unused, matching the column default, so an existing
  // locked-origin partner is created exactly as before.
  const direction = useHomePlace ? ((formData.get("direction") as string) || "both") : "outbound";
  const jurisdictionIsGlobal = formData.get("jurisdictionIsGlobal") === "on";
  const jurisdictionRegionsOnly = formData.get("jurisdictionRegionsOnly") === "on";
  const joinHeadingStyle = (formData.get("joinHeadingStyle") as string) || "partner_name";
  const joinHeadingGroupName = formData.get("joinHeadingGroupName") as string | null;
  const jurisdictionPlaceIds = jurisdictionIsGlobal
    ? []
    : (JSON.parse((formData.get("jurisdictionPlaceIds") as string) || "[]") as number[]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Backstop for the demo buttons, which build FormData directly and skip
  // the browser's native required-field validation (only a real form
  // submit triggers that) - without this, a blank name/slug silently
  // becomes an empty string instead of failing anywhere.
  if (!name.trim() || !slug.trim()) {
    redirect(
      `/admin/embed-partners?error=${encodeURIComponent("Partner name and URL slug are required.")}`,
    );
  }

  if (joinHeadingStyle === "custom_group" && !joinHeadingGroupName?.trim()) {
    redirect(
      `/admin/embed-partners?error=${encodeURIComponent("The 'Join a local ___ network' heading needs a group name filled in.")}`,
    );
  }

  // Caught here rather than left to the constraint, because
  // embed_partners_direction_needs_home would surface as a raw Postgres
  // message about a check constraint nobody reading the form has heard
  // of. The autocomplete can also be typed into without a selection
  // being made, which leaves the hidden field empty.
  if (useHomePlace && !homePlaceIdRaw) {
    redirect(
      `/admin/embed-partners?error=${encodeURIComponent("Pick the home place from the dropdown — typing the name is not enough.")}`,
    );
  }

  const isLanguage = originKind === "language";

  const { data: partner, error } = await supabase
    .from("embed_partners")
    .insert({
      name,
      slug,
      // A home place takes the locked origin's slot, and the schema
      // forbids setting both, so these all go null when one is in use.
      locked_language_id:
        !useHomePlace && !originIsGlobal && isLanguage ? Number(originId) : null,
      locked_origin_place_id:
        !useHomePlace && !originIsGlobal && !isLanguage ? Number(originId) : null,
      home_place_id: useHomePlace ? Number(homePlaceIdRaw) : null,
      direction,
      hide_origin_label: hideOriginLabel,
      origin_is_global: !useHomePlace && originIsGlobal,
      is_global: jurisdictionIsGlobal,
      jurisdiction_regions_only: jurisdictionRegionsOnly,
      join_heading_style: joinHeadingStyle,
      join_heading_group_name:
        joinHeadingStyle === "custom_group" ? joinHeadingGroupName!.trim() : null,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/admin/embed-partners?error=${encodeURIComponent(error.message)}`);
  }

  if (jurisdictionPlaceIds.length > 0) {
    const rows = jurisdictionPlaceIds.map((placeId) => ({
      partner_id: partner.id,
      place_id: placeId,
    }));
    const { error: jurisdictionError } = await supabase
      .from("embed_partner_jurisdictions")
      .insert(rows);

    if (jurisdictionError) {
      redirect(`/admin/embed-partners?error=${encodeURIComponent(jurisdictionError.message)}`);
    }
  }

  return slug;
}

export async function createPartner(formData: FormData) {
  await insertPartnerFromForm(formData);
  revalidatePath("/admin/embed-partners");
}

// Same as createPartner, but for previewing a pitch to a prospective partner:
// creates the same real, working embed and returns its slug so the caller
// can open the demo page in a new tab, keeping the admin page intact.
export async function createPartnerDemoData(formData: FormData) {
  const slug = await insertPartnerFromForm(formData);
  revalidatePath("/admin/embed-partners");
  return { slug };
}

export async function deletePartner(formData: FormData) {
  const partnerId = formData.get("partnerId") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  await supabase.from("embed_partners").delete().eq("id", Number(partnerId));
  revalidatePath("/admin/embed-partners");
}

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
  const jurisdictionIsGlobal = formData.get("jurisdictionIsGlobal") === "on";
  const joinHeadingStyle = (formData.get("joinHeadingStyle") as string) || "partner_name";
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

  const isLanguage = originKind === "language";

  const { data: partner, error } = await supabase
    .from("embed_partners")
    .insert({
      name,
      slug,
      locked_language_id: !originIsGlobal && isLanguage ? Number(originId) : null,
      locked_origin_place_id: !originIsGlobal && !isLanguage ? Number(originId) : null,
      hide_origin_label: hideOriginLabel,
      origin_is_global: originIsGlobal,
      is_global: jurisdictionIsGlobal,
      join_heading_style: joinHeadingStyle,
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

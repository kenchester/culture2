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
  const isGlobal = formData.get("isGlobal") === "on";
  const jurisdictionPlaceIds = isGlobal
    ? []
    : (JSON.parse((formData.get("jurisdictionPlaceIds") as string) || "[]") as number[]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const isLanguage = originKind === "language";

  const { data: partner, error } = await supabase
    .from("embed_partners")
    .insert({
      name,
      slug,
      locked_language_id: isLanguage ? Number(originId) : null,
      locked_origin_place_id: isLanguage ? null : Number(originId),
      hide_origin_label: hideOriginLabel,
      is_global: isGlobal,
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
// creates the same real, working embed and jumps straight to a mocked-up
// "diplomatic sector" showcase page instead of back to the admin list.
export async function createPartnerDemo(formData: FormData) {
  const slug = await insertPartnerFromForm(formData);
  redirect(`/embed-partners/demo/${slug}`);
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

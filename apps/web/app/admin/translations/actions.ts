"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGeoName } from "@/lib/geo-translation";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/locale";

const EDITABLE_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== "en");

export type TranslationRow = {
  locale: Locale;
  value: string;
  source: "cldr" | "azure" | "manual" | null;
};

export type EntityTranslations = {
  name: string;
  placeType?: "country" | "region" | "city";
  isoCode: string | null;
  translations: TranslationRow[];
};

// Called directly from the client (not form-bound) when an admin picks a
// search result - same pattern as checkEmailStatus in
// app/(auth)/actions.ts. Resolves every locale via the exact same
// getGeoName resolver every other page uses (so what the admin sees here
// is exactly what's live right now), which also warms the cache for any
// locale that wasn't already cached.
export async function getTranslationsForEntity(
  kind: "place" | "language",
  id: number,
): Promise<EntityTranslations> {
  const supabase = await createClient();

  const { data: entity } =
    kind === "language"
      ? await supabase.from("languages").select("name, iso_code").eq("id", id).single()
      : await supabase.from("places").select("name, type, iso_code").eq("id", id).single();

  if (!entity) {
    throw new Error("Not found.");
  }

  const placeType = ("type" in entity ? entity.type : undefined) as
    | "country"
    | "region"
    | "city"
    | undefined;

  await Promise.all(
    EDITABLE_LOCALES.map((locale) =>
      getGeoName(kind, id, entity.name, locale, { isoCode: entity.iso_code, placeType }),
    ),
  );

  const { data: cached } = await supabase
    .from("geo_translations")
    .select("locale, translated_name, source")
    .eq("entity_type", kind)
    .eq("entity_id", id);

  const byLocale = new Map((cached ?? []).map((row) => [row.locale, row]));
  const translations: TranslationRow[] = EDITABLE_LOCALES.map((locale) => {
    const row = byLocale.get(locale);
    return {
      locale,
      value: row?.translated_name ?? entity.name,
      source: (row?.source as TranslationRow["source"]) ?? null,
    };
  });

  return { name: entity.name, placeType, isoCode: entity.iso_code, translations };
}

export async function saveTranslations(formData: FormData) {
  const kind = formData.get("kind") as "place" | "language";
  const id = Number(formData.get("id"));
  const isoCode = ((formData.get("isoCode") as string) || "").trim() || null;

  const supabase = await createClient();

  const { error: isoError } =
    kind === "language"
      ? await supabase.from("languages").update({ iso_code: isoCode }).eq("id", id)
      : await supabase.from("places").update({ iso_code: isoCode }).eq("id", id);

  if (isoError) {
    redirect(`/admin/translations?error=${encodeURIComponent(isoError.message)}`);
  }

  for (const locale of EDITABLE_LOCALES) {
    const value = ((formData.get(`value_${locale}`) as string) || "").trim();
    const original = ((formData.get(`original_${locale}`) as string) || "").trim();

    // Unchanged from what was loaded into the form - leave this row
    // exactly as-is (source and all). Reaching this form at all
    // shouldn't turn every already-correct standard/auto-translated
    // value into a "manual" override; only a value the admin actually
    // edited should become one.
    if (value === original) continue;

    if (value) {
      const { error } = await supabase.from("geo_translations").upsert(
        {
          entity_type: kind,
          entity_id: id,
          locale,
          translated_name: value,
          source: "manual",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entity_type,entity_id,locale" },
      );
      if (error) {
        redirect(`/admin/translations?error=${encodeURIComponent(error.message)}`);
      }
    } else {
      // Emptied - revert to live auto-resolution on the next render
      // instead of caching a blank override.
      await supabase
        .from("geo_translations")
        .delete()
        .eq("entity_type", kind)
        .eq("entity_id", id)
        .eq("locale", locale);
    }
  }

  revalidatePath("/admin/translations");
  redirect(`/admin/translations?success=${encodeURIComponent("Translations saved.")}`);
}

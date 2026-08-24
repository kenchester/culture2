import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateText } from "@/lib/azure-translator";
import { toAzureCode, type Locale } from "@/lib/locale";

export type GeoKind = "place" | "language";
export type GeoSource = "cldr" | "azure" | "manual";

// Three-tier localized name lookup for language/geography names, which
// only exist as raw English text with no locale awareness in the schema.
// Mirrors translateEntry() (app/networks/actions.ts) - cache first, then
// resolve, then best-effort cache the result:
//   1. geo_translations cache (any source) - return if present.
//   2. A known iso_code + kind is "language", or placeType is "country" -
//      Intl.DisplayNames (Node's own CLDR data) gives a genuine standard
//      localized name, not a machine-translation guess. Cache as "cldr".
//   3. Azure Translator on the raw English name. Cache as "azure".
//   4. Azure throws - return the English name as-is, uncached, so a
//      later render retries instead of getting permanently stuck.
export async function getGeoName(
  kind: GeoKind,
  id: number,
  name: string,
  locale: Locale,
  options?: { isoCode?: string | null; placeType?: "country" | "region" | "city" },
): Promise<string> {
  if (locale === "en") {
    return name;
  }

  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("geo_translations")
    .select("translated_name")
    .eq("entity_type", kind)
    .eq("entity_id", id)
    .eq("locale", locale)
    .maybeSingle();

  if (cached) {
    return cached.translated_name;
  }

  const isoCode = options?.isoCode;
  const canUseCldr = isoCode && (kind === "language" || options?.placeType === "country");

  if (canUseCldr) {
    try {
      const displayNames = new Intl.DisplayNames([locale], {
        type: kind === "language" ? "language" : "region",
      });
      const resolved = displayNames.of(isoCode!);
      if (resolved && resolved !== isoCode) {
        await cacheGeoTranslation(kind, id, locale, resolved, "cldr");
        return resolved;
      }
    } catch {
      // Unsupported locale/type combination for Intl.DisplayNames - fall
      // through to Azure below.
    }
  }

  try {
    const { text } = await translateText(name, toAzureCode(locale));
    await cacheGeoTranslation(kind, id, locale, text, "azure");
    return text;
  } catch {
    return name;
  }
}

async function cacheGeoTranslation(
  kind: GeoKind,
  id: number,
  locale: Locale,
  translatedName: string,
  source: GeoSource,
) {
  // Best-effort, and deliberately via the service-role client rather than
  // the request-scoped one - this fires during anonymous page renders
  // (nobody signed in, let alone an admin), and RLS has no "anon can
  // insert" policy on purpose (see 00000000000039_geo_translations.sql).
  try {
    const admin = createAdminClient();
    await admin.from("geo_translations").upsert(
      {
        entity_type: kind,
        entity_id: id,
        locale,
        translated_name: translatedName,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,entity_id,locale" },
    );
  } catch {
    // A failed cache write must never turn a successful resolution into
    // an error for the viewer who triggered it.
  }
}

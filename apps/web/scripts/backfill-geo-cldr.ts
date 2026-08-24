// Eagerly resolves and caches all 10 non-English locale names for every
// country/language row that has an iso_code (see backfill-iso-codes.ts),
// via Intl.DisplayNames - zero Azure Translator calls, since these are
// genuine standard localized names, not machine translations. Ships this
// so browsing in any locale shows correct country/language names
// immediately rather than waiting on a first-view Azure call the way
// lib/geo-translation.ts handles the long tail of regions/cities.
//
// Safe to re-run: by default only fills locales that don't already have a
// cached geo_translations row for a given entity. Pass --force to
// re-resolve and overwrite every cldr/azure-sourced row (never touches
// source: "manual" rows, which are always an intentional admin override).
//
// Run via: npm run backfill-geo-cldr [-- --force]

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present (e.g. CI) - fall through to whatever's already
  // in the environment.
}

const SUPPORTED_LOCALES = ["es", "fr", "ja", "de", "zh", "it", "ar", "ko", "ru", "pt"] as const;
const FORCE = process.argv.includes("--force");

type Row = { id: number; name: string; iso_code: string };

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: countries, error: countryError } = await admin
    .from("places")
    .select("id, name, iso_code")
    .eq("type", "country")
    .not("iso_code", "is", null);
  if (countryError) throw countryError;

  const { data: languages, error: languageError } = await admin
    .from("languages")
    .select("id, name, iso_code")
    .not("iso_code", "is", null);
  if (languageError) throw languageError;

  const countryCount = await backfillEntity(admin, "place", "region", countries ?? []);
  const languageCount = await backfillEntity(admin, "language", "language", languages ?? []);

  console.log(`places (country): ${countryCount} translations written`);
  console.log(`languages: ${languageCount} translations written`);
}

async function backfillEntity(
  admin: SupabaseClient,
  entityType: "place" | "language",
  displayType: "region" | "language",
  rows: Row[],
): Promise<number> {
  // Always fetched (not just when !FORCE) - source:"manual" rows must
  // never be overwritten by this script even with --force, since a
  // manual admin edit is always an intentional, standing override.
  const { data: existing, error: existingError } = await admin
    .from("geo_translations")
    .select("entity_id, locale, source")
    .eq("entity_type", entityType);
  if (existingError) throw existingError;

  const existingLocales = new Map<number, Map<string, string>>();
  for (const row of existing ?? []) {
    const localeMap = existingLocales.get(row.entity_id) ?? new Map<string, string>();
    localeMap.set(row.locale, row.source);
    existingLocales.set(row.entity_id, localeMap);
  }

  let written = 0;
  for (const row of rows) {
    const upserts: {
      entity_type: string;
      entity_id: number;
      locale: string;
      translated_name: string;
      source: string;
      updated_at: string;
    }[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      const existingSource = existingLocales.get(row.id)?.get(locale);
      if (existingSource === "manual") continue;
      if (!FORCE && existingSource) continue;

      let resolved: string | undefined;
      try {
        resolved = new Intl.DisplayNames([locale], { type: displayType }).of(row.iso_code);
      } catch {
        // Unsupported locale/type combination - skip, falls through to
        // Azure at render time instead.
      }
      if (!resolved || resolved === row.iso_code) continue;

      upserts.push({
        entity_type: entityType,
        entity_id: row.id,
        locale,
        translated_name: resolved,
        source: "cldr",
        updated_at: new Date().toISOString(),
      });
    }

    if (upserts.length === 0) continue;

    const { error } = await admin
      .from("geo_translations")
      .upsert(upserts, { onConflict: "entity_type,entity_id,locale" });
    if (error) throw error;
    written += upserts.length;
  }

  return written;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

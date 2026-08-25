// Fills places.iso_code (country rows only) and languages.iso_code by
// matching each row's stored English name against the real ISO 3166-1
// alpha-2 / ISO 639-1 code lists - zero translation API calls. A matched
// iso_code is what lets lib/geo-translation.ts use Intl.DisplayNames
// (genuine standard localized names) instead of falling back to Azure.
//
// Matching is deliberately conservative: normalized exact match only, no
// fuzzy/edit-distance matching, to avoid mismatching e.g. two
// similarly-named countries. Rows that don't match (many of our language
// rows are sign languages, regional/indigenous languages, or compound
// names like "American Sign Language (ASL)" that have no ISO 639-1 code
// at all) are left null and simply fall through to Azure at render time -
// or can be set by hand later via the admin Translations tab.
//
// Safe to re-run: only touches rows where iso_code is still null.
// Run via: npm run backfill-iso-codes

import { createClient } from "@supabase/supabase-js";
import countries from "i18n-iso-countries";
import enCountryNames from "i18n-iso-countries/langs/en.json";
import ISO6391 from "iso-639-1";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present (e.g. CI) - fall through to whatever's already
  // in the environment.
}

countries.registerLocale(enCountryNames);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[([].*?[)\]]/g, " ") // drop parenthetical/bracketed annotations
    .replace(/\/.*/g, " ") // drop slash-alternatives, keep the first name
    .replace(/\bsar china\b/g, " ") // "Hong Kong SAR China" -> "Hong Kong"
    .replace(/\bst\.?\b/g, "saint") // "St." / "St" -> "saint"
    .replace(/&/g, "and")
    .replace(/\blanguage\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A handful of well-known former/alternate official country names that
// don't share enough text with Intl.DisplayNames' current name to match
// via normalization alone (a real rename, not a spelling variant) - e.g.
// Intl.DisplayNames now says "Czechia" where our data has "Czech
// Republic". Deliberately small and limited to genuinely well-documented
// ISO 3166 renames, not guesses.
const COUNTRY_ALIASES: Record<string, string> = {
  "czech republic": "CZ",
  macedonia: "MK",
  swaziland: "SZ",
  "ivory coast": "CI",
  "east timor": "TL",
  turkey: "TR",
  burma: "MM",
  "republic of the congo": "CG",
  "democratic republic of the congo": "CD",
  "hong kong": "HK",
  macao: "MO",
  palestine: "PS",
  bonaire: "BQ",
  aland: "AX",
};

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Countries: use the package purely for the authoritative code list,
  // but Intl.DisplayNames for the actual name comparison - that's the
  // same source lib/geo-translation.ts uses at render time, so a match
  // here is guaranteed consistent with what ships live.
  const countryDisplay = new Intl.DisplayNames(["en"], { type: "region" });
  const countryByName = new Map<string, string>();
  for (const code of Object.keys(countries.getNames("en"))) {
    const name = countryDisplay.of(code);
    if (name) countryByName.set(normalize(name), code);
  }

  const { data: countryRows, error: countryError } = await admin
    .from("places")
    .select("id, name")
    .eq("type", "country")
    .is("iso_code", null);
  if (countryError) throw countryError;

  let countryMatched = 0;
  for (const row of countryRows ?? []) {
    const normalized = normalize(row.name);
    const code = countryByName.get(normalized) ?? COUNTRY_ALIASES[normalized];
    if (!code) continue;
    const { error } = await admin.from("places").update({ iso_code: code }).eq("id", row.id);
    if (error) throw error;
    countryMatched++;
  }
  console.log(`countries: ${countryMatched}/${countryRows?.length ?? 0} matched`);

  // Languages: same approach against ISO 639-1.
  const langDisplay = new Intl.DisplayNames(["en"], { type: "language" });
  const langByName = new Map<string, string>();
  for (const code of ISO6391.getAllCodes()) {
    const name = langDisplay.of(code);
    if (name) langByName.set(normalize(name), code);
  }

  const { data: langRows, error: langError } = await admin
    .from("languages")
    .select("id, name")
    .is("iso_code", null);
  if (langError) throw langError;

  let langMatched = 0;
  for (const row of langRows ?? []) {
    const code = langByName.get(normalize(row.name));
    if (!code) continue;
    const { error } = await admin.from("languages").update({ iso_code: code }).eq("id", row.id);
    if (error) throw error;
    langMatched++;
  }
  console.log(`languages: ${langMatched}/${langRows?.length ?? 0} matched`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

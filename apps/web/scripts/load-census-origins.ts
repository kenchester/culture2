// Loads foreign-born residents by country of birth, per city, from the
// US Census Bureau's American Community Survey (table B05006).
//
// This is block 1 of a city page, and block 3 - the sister-city gap -
// cannot be computed without it.
//
// NEEDS A FREE API KEY. api.census.gov used to answer unauthenticated
// requests and now redirects them to a "Missing Key" page, so this cannot
// run until CENSUS_API_KEY is set:
//
//   1. Request one (takes a minute): https://api.census.gov/data/key_signup.html
//   2. Add CENSUS_API_KEY=... to apps/web/.env.local
//   3. npx tsx scripts/load-census-origins.ts --dry-run
//   4. npx tsx scripts/load-census-origins.ts --prod
//
// --dry-run prints what it would write and touches no database, so the
// numbers can be eyeballed against data.census.gov before anything lands.
//
// NOTE: this script has never been executed - no key was available when it
// was written. Run --dry-run first and read the output.
import countries from "i18n-iso-countries";
import enCountryNames from "i18n-iso-countries/langs/en.json";
import { adminClient } from "./lib/admin";

countries.registerLocale(enCountryNames);

const DATASET = "2023/acs/acs5";
const PERIOD = "ACS 2019-2023 5-year estimates";
const SOURCE = "US Census Bureau, ACS table B05006";

// Census FIPS: state code and "place" code. A place is the incorporated
// city, which is the right granularity here - a metro area would fold in
// suburbs the city does not govern.
const CITIES: { placeId: number; name: string; state: string; place: string }[] = [
  { placeId: 25760, name: "New York City", state: "36", place: "51000" },
  { placeId: 24835, name: "Houston", state: "48", place: "35000" },
];

// ACS country labels that i18n-iso-countries will not resolve on its own.
// Anything still unmatched after this is reported and skipped rather than
// guessed at.
const ALIASES: Record<string, string> = {
  "Viet Nam": "VN",
  "Korea": "KR",
  "South Korea": "KR",
  "North Korea": "KP",
  "Burma": "MM",
  "Myanmar": "MM",
  "Cape Verde": "CV",
  "Ivory Coast": "CI",
  "Côte d'Ivoire": "CI",
  "Laos": "LA",
  "Macedonia": "MK",
  "North Macedonia": "MK",
  "Czechoslovakia": "CZ",
  "Czechia": "CZ",
  "Czech Republic": "CZ",
  "Russia": "RU",
  "Syria": "SY",
  "Taiwan": "TW",
  "Hong Kong": "HK",
  "Macau": "MO",
  "Bolivia": "BO",
  "Tanzania": "TZ",
  "Moldova": "MD",
  "Brunei": "BN",
  "Cabo Verde": "CV",
  "Congo": "CG",
  "Democratic Republic of Congo": "CD",
  "Zaire": "CD",
  "St. Lucia": "LC",
  "St. Vincent and the Grenadines": "VC",
  "St. Kitts-Nevis": "KN",
  "Trinidad and Tobago": "TT",
  "Antigua and Barbuda": "AG",
  "Bosnia and Herzegovina": "BA",
};

function isoFor(label: string): string | null {
  if (ALIASES[label]) return ALIASES[label];
  const code = countries.getAlpha2Code(label, "en");
  return code ?? null;
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok || text.trimStart().startsWith("<")) {
    throw new Error(
      `Census API returned ${response.status}. ${
        text.includes("Missing Key")
          ? "CENSUS_API_KEY is missing or rejected - see the header of this file."
          : text.slice(0, 200)
      }`,
    );
  }
  return JSON.parse(text);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const key = process.env.CENSUS_API_KEY;
  if (!key) {
    console.error(
      [
        "",
        "CENSUS_API_KEY is not set, and api.census.gov now refuses",
        "unauthenticated requests.",
        "",
        "  1. Request a free key: https://api.census.gov/data/key_signup.html",
        "  2. Add CENSUS_API_KEY=... to apps/web/.env.local",
        "  3. Re-run with --dry-run first",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  // Labels look like "Estimate!!Total:!!Europe:!!Northern Europe:!!Denmark".
  // A leaf - an actual country - is a segment with no trailing colon.
  const groups = await fetchJson(
    `https://api.census.gov/data/${DATASET}/groups/B05006.json?key=${key}`,
  );
  const labels: Record<string, string> = Object.fromEntries(
    Object.entries(groups.variables as Record<string, { label: string }>).map(([k, v]) => [
      k,
      v.label,
    ]),
  );

  const admin = dryRun ? null : adminClient();
  const unmatched = new Set<string>();

  for (const city of CITIES) {
    const raw = await fetchJson(
      `https://api.census.gov/data/${DATASET}?get=group(B05006)&for=place:${city.place}&in=state:${city.state}&key=${key}`,
    );
    const values: Record<string, string> = Object.fromEntries(
      (raw[0] as string[]).map((header, i) => [header, (raw[1] as string[])[i]]),
    );

    const rows: {
      city_place_id: number;
      origin_country_iso: string;
      origin_label: string;
      people: number;
      is_total: boolean;
      source: string;
      period: string;
    }[] = [];

    const total = Number(values["B05006_001E"] ?? 0);
    if (total > 0) {
      rows.push({
        city_place_id: city.placeId,
        origin_country_iso: "TOTAL",
        origin_label: "Total foreign-born",
        people: total,
        is_total: true,
        source: SOURCE,
        period: PERIOD,
      });
    }

    for (const [variable, value] of Object.entries(values)) {
      if (!variable.endsWith("E") || variable === "B05006_001E") continue;
      const label = labels[variable];
      if (!label || value == null || value === "" || value.startsWith("-")) continue;
      const parts = label.split("!!");
      const leaf = parts[parts.length - 1];
      // Skip the continent and sub-region roll-ups.
      if (parts.length < 3 || leaf.endsWith(":")) continue;

      const iso = isoFor(leaf);
      if (!iso) {
        unmatched.add(leaf);
        continue;
      }
      const people = Number(value);
      if (!Number.isFinite(people) || people <= 0) continue;

      rows.push({
        city_place_id: city.placeId,
        origin_country_iso: iso,
        origin_label: leaf,
        people,
        is_total: false,
        source: SOURCE,
        period: PERIOD,
      });
    }

    rows.sort((a, b) => b.people - a.people);
    console.log(`\n=== ${city.name}: ${rows.length} rows ===`);
    for (const row of rows.slice(0, 12)) {
      console.log(`  ${row.origin_label.padEnd(30)} ${row.people.toLocaleString()}`);
    }

    if (dryRun || !admin) continue;

    // Replace this city's rows for this release rather than accumulating
    // them, so a re-run after a correction leaves one set of figures.
    await admin
      .from("city_origin_stats")
      .delete()
      .eq("city_place_id", city.placeId)
      .eq("period", PERIOD);
    const { error } = await admin.from("city_origin_stats").insert(rows);
    if (error) {
      console.log(`FAIL ${city.name}: ${error.message}`);
      continue;
    }
    console.log(`  written`);
  }

  if (unmatched.size > 0) {
    console.log(
      `\nSkipped ${unmatched.size} label(s) with no ISO match (add to ALIASES if any matter):`,
    );
    console.log(`  ${[...unmatched].sort().join(", ")}`);
  }
  if (dryRun) console.log("\n--dry-run: nothing was written.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

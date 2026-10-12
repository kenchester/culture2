// Loads foreign-born residents by country of birth, per city, from the
// US Census Bureau's American Community Survey (table B05006). This is
// block 1 of a city page, and block 3 - the sister-city gap - cannot be
// computed without it.
//
// Reads through Census Reporter rather than api.census.gov. The Census
// Bureau's own API now redirects unauthenticated requests to a "missing
// key" page; Census Reporter is a long-running nonprofit mirror of the
// same tables, needs no key, and reports which ACS release each figure
// came from - which matters, because the release differs by city (1-year
// estimates are only published for places above 65,000 people, so smaller
// cities fall back to 5-year). The release is stored per row rather than
// hardcoded for exactly that reason.
//
// Run: npm run load-census-origins -- --dry-run     (prints, writes nothing)
//      npm run load-census-origins -- --prod
import countries from "i18n-iso-countries";
import enCountryNames from "i18n-iso-countries/langs/en.json";
import { adminClient } from "./lib/admin";

countries.registerLocale(enCountryNames);

const SOURCE = "US Census Bureau, ACS table B05006 (via Census Reporter)";

// Census geo ids: 16000US + state FIPS + place FIPS. A "place" is the
// incorporated city, which is the right granularity - a metro area folds
// in suburbs the city does not govern.
const CITIES: { placeId: number; name: string; geoId: string }[] = [
  { placeId: 25760, name: "New York City", geoId: "16000US3651000" },
  { placeId: 24835, name: "Houston", geoId: "16000US4835000" },
];

// Residual categories, not countries. "Other Eastern Asia" and
// "Asia, n.e.c." are what the Bureau puts people in when the specific
// country is suppressed or unlisted; treating them as origins would
// invent places.
function isResidual(label: string): boolean {
  return (
    label.startsWith("Other ") ||
    label.includes("n.e.c.") ||
    label === "West Indies"
  );
}

// ACS labels that i18n-iso-countries will not resolve. Several map to the
// same ISO code on purpose - England, Scotland and the remainder of the
// UK are three ACS rows for one country - which is why the loader sums by
// code rather than mapping one row to one row.
const ALIASES: Record<string, string> = {
  "Burma (Myanmar)": "MM",
  "Cabo Verde": "CV",
  "China, excluding Hong Kong and Taiwan": "CN",
  // A real ACS category for people born in the former state. Folded into
  // Czechia, which is where most of that population originated; imperfect,
  // and small enough not to move any ranking.
  "Czechoslovakia (includes Czech Republic and Slovakia)": "CZ",
  "Democratic Republic of Congo (Zaire)": "CD",
  England: "GB",
  Scotland: "GB",
  "United Kingdom, excluding England and Scotland": "GB",
  // An autonomous region of Portugal, reported separately by the Bureau.
  "Azores Islands": "PT",
  Korea: "KR",
  Laos: "LA",
  Micronesia: "FM",
  Moldova: "MD",
  "North Macedonia (Macedonia)": "MK",
  "St. Lucia": "LC",
  "St. Vincent and the Grenadines": "VC",
  Syria: "SY",
};

// i18n-iso-countries returns the formal ISO name, which for several codes
// is a label this project deliberately avoids - components/autocomplete-
// field.tsx already suppresses the "country" badge for exactly these
// places because displaying the ISO framing reads as taking a political
// position CultureMesh has no reason to take. Same reasoning, applied to
// the name itself.
const DISPLAY_NAMES: Record<string, string> = {
  CN: "China",
  TW: "Taiwan",
  HK: "Hong Kong",
  MO: "Macao",
  KR: "South Korea",
  KP: "North Korea",
  PS: "Palestine",
  VN: "Vietnam",
  LA: "Laos",
  MD: "Moldova",
  SY: "Syria",
  RU: "Russia",
  BO: "Bolivia",
  TZ: "Tanzania",
  VE: "Venezuela",
  IR: "Iran",
  GB: "United Kingdom",
  CD: "Democratic Republic of the Congo",
  CZ: "Czechia",
};

function displayName(iso: string): string {
  return DISPLAY_NAMES[iso] ?? countries.getName(iso, "en") ?? iso;
}

function isoFor(label: string): string | null {
  return ALIASES[label] ?? countries.getAlpha2Code(label, "en") ?? null;
}

type Reporter = {
  release: { id: string; name: string; years: string };
  tables: { B05006: { columns: Record<string, { indent: number; name: string }> } };
  data: Record<string, { B05006: { estimate: Record<string, number> } }>;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const admin = dryRun ? null : adminClient();
  const unmatched = new Set<string>();

  for (const city of CITIES) {
    // Census Reporter rejects requests with no User-Agent (403), and
    // identifying the caller is the polite thing to do against a free
    // nonprofit API regardless.
    const response = await fetch(
      `https://api.censusreporter.org/1.0/data/show/latest?table_ids=B05006&geo_ids=${city.geoId}`,
      { headers: { "User-Agent": "CultureMesh/1.0 (city pages; https://www.culturemesh.com)" } },
    );
    if (!response.ok) {
      console.log(`FAIL ${city.name}: Census Reporter returned ${response.status}`);
      continue;
    }
    const body = (await response.json()) as Reporter;
    const columns = body.tables.B05006.columns;
    const estimates = body.data[city.geoId]?.B05006?.estimate;
    if (!estimates) {
      console.log(`FAIL ${city.name}: no estimates for ${city.geoId}`);
      continue;
    }
    const period = body.release.name;

    // Sum by ISO code, because several ACS rows can be one country.
    const byIso = new Map<string, number>();
    for (const [column, value] of Object.entries(estimates)) {
      const label = columns[column]?.name;
      if (!label || column === "B05006001") continue;
      // A roll-up ("Europe:", "Northern Europe:") ends in a colon.
      if (label.endsWith(":") || isResidual(label)) continue;
      if (!value || value <= 0) continue;

      const iso = isoFor(label);
      if (!iso) {
        unmatched.add(label);
        continue;
      }
      byIso.set(iso, (byIso.get(iso) ?? 0) + value);
    }

    const rows = [
      ...(estimates["B05006001"]
        ? [
            {
              city_place_id: city.placeId,
              origin_country_iso: "TOTAL",
              origin_label: "Total foreign-born",
              people: Math.round(estimates["B05006001"]),
              is_total: true,
              source: SOURCE,
              period,
            },
          ]
        : []),
      ...[...byIso.entries()].map(([iso, people]) => ({
        city_place_id: city.placeId,
        origin_country_iso: iso,
        // One name per country, so three UK rows read as one United
        // Kingdom - and not the formal ISO rendering where that carries a
        // political claim.
        origin_label: displayName(iso),
        people: Math.round(people),
        is_total: false,
        source: SOURCE,
        period,
      })),
    ];

    const top = rows.filter((r) => !r.is_total).sort((a, b) => b.people - a.people);
    console.log(`\n=== ${city.name} — ${period} — ${rows.length} rows ===`);
    for (const row of top.slice(0, 10)) {
      console.log(`  ${row.origin_label.padEnd(30)} ${row.people.toLocaleString()}`);
    }

    if (dryRun || !admin) continue;

    // Replace this release's rows rather than accumulating, so a re-run
    // after a correction leaves exactly one set of figures.
    await admin
      .from("city_origin_stats")
      .delete()
      .eq("city_place_id", city.placeId)
      .eq("period", period);
    const { error } = await admin.from("city_origin_stats").insert(rows);
    if (error) {
      console.log(`FAIL ${city.name}: ${error.message}`);
      continue;
    }
    console.log(`  written`);
  }

  if (unmatched.size > 0) {
    console.log(`\nSkipped ${unmatched.size} label(s) with no ISO match:`);
    console.log(`  ${[...unmatched].sort().join(", ")}`);
  }
  if (dryRun) console.log("\n--dry-run: nothing was written.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

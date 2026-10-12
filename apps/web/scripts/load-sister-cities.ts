// Sister-city relationships for the cities that have a city page.
//
// Compiled by hand from Wikipedia's per-country twin-town lists, which is
// the only comprehensive public source - Sister Cities International
// publishes a member directory but not a machine-readable pairing list.
// Every row carries its source URL so the page can attribute it and a
// reader can check it.
//
// Hand-compiled on purpose at this size. Scraping the per-country lists
// would need name-to-place matching across thousands of towns, and that
// matching is exactly where this dataset would quietly go wrong; twelve
// cities entered carefully beat five hundred entered by regex.
//
// Years are mostly absent from the source. Null means "the source did not
// say", never "unknown year" - the page omits rather than guesses.
//
// Run: npx tsx scripts/load-sister-cities.ts
import { adminClient } from "./lib/admin";

const WIKI = "https://en.wikipedia.org/wiki/";

type Partner = { name: string; iso: string; year?: number };

const DATA: {
  cityPlaceId: number;
  cityName: string;
  source: string;
  sourceUrl: string;
  partners: Partner[];
}[] = [
  {
    cityPlaceId: 25760,
    cityName: "New York City",
    source: "Wikipedia: List of sister cities of New York City",
    sourceUrl: `${WIKI}List_of_sister_cities_of_New_York_City`,
    // City-wide partnerships only. The borough-level ones (Brooklyn with
    // Anzio, Manhattan with Seocho, and so on) are real but belong to a
    // borough, and mixing the two scopes would misstate what the city
    // itself has agreed to.
    partners: [
      { name: "Athens", iso: "GR" },
      { name: "Beijing", iso: "CN" },
      { name: "Bridgetown", iso: "BB" },
      { name: "Budapest", iso: "HU" },
      { name: "Ho Chi Minh City", iso: "VN" },
      { name: "Jerusalem", iso: "IL" },
      { name: "Johannesburg", iso: "ZA" },
      { name: "London", iso: "GB" },
      { name: "Madrid", iso: "ES" },
      { name: "Santo Domingo", iso: "DO" },
      { name: "Tokyo", iso: "JP" },
    ],
  },
  {
    cityPlaceId: 24835,
    cityName: "Houston",
    source: "Wikipedia: List of twin towns and sister cities in Texas",
    sourceUrl: `${WIKI}List_of_twin_towns_and_sister_cities_in_Texas`,
    partners: [
      { name: "Abu Dhabi", iso: "AE" },
      { name: "Baku", iso: "AZ" },
      { name: "Basra", iso: "IQ" },
      { name: "Chiba", iso: "JP" },
      { name: "Guayaquil", iso: "EC" },
      { name: "Huelva", iso: "ES" },
      { name: "Istanbul", iso: "TR" },
      { name: "Karachi", iso: "PK" },
      { name: "Leipzig", iso: "DE" },
      { name: "Luanda", iso: "AO" },
      { name: "Nice", iso: "FR" },
      { name: "Perth", iso: "AU" },
      { name: "Shenzhen", iso: "CN" },
      { name: "Stavanger", iso: "NO" },
      { name: "Taipei", iso: "TW" },
      { name: "Tampico", iso: "MX" },
      { name: "Ulsan", iso: "KR" },
    ],
  },
  // Xiamen is deliberately absent. Its sister cities exist, but neither
  // Wikipedia's Xiamen article nor the China twin-towns list returned a
  // list I could read in full, and entering them from memory would put
  // unsourced claims on a page whose entire value is being checkable. The
  // city page is built to render without this block, which is the state
  // most non-US, non-European cities will be in for a long time.
];

async function main() {
  const admin = adminClient();

  for (const city of DATA) {
    // Link a partner to a places row where one exists, so the page can
    // offer a link - but never require it.
    const { data: matches } = await admin
      .from("places")
      .select("id, name, type, parent_id")
      .in(
        "name",
        city.partners.map((p) => p.name),
      )
      .eq("type", "city");
    const matchByName = new Map<string, number>();
    for (const m of matches ?? []) {
      // First match wins; ambiguous names (two Londons) are left to the
      // name-only path rather than guessed at.
      const key = (m.name as string).toLowerCase();
      if (!matchByName.has(key)) matchByName.set(key, m.id as number);
    }

    const rows = city.partners.map((p) => ({
      city_place_id: city.cityPlaceId,
      partner_name: p.name,
      partner_country_iso: p.iso,
      partner_place_id: matchByName.get(p.name.toLowerCase()) ?? null,
      since_year: p.year ?? null,
      source: city.source,
      source_url: city.sourceUrl,
    }));

    // Select-then-insert rather than upsert: the uniqueness guarantee is a
    // case-insensitive expression index (on lower(partner_name)), and
    // ON CONFLICT cannot target one of those. Weakening the index to make
    // upsert work would let "Nice" and "NICE" both exist.
    const { data: already } = await admin
      .from("city_sister_cities")
      .select("partner_name")
      .eq("city_place_id", city.cityPlaceId);
    const have = new Set((already ?? []).map((r) => (r.partner_name as string).toLowerCase()));
    const missing = rows.filter((r) => !have.has(r.partner_name.toLowerCase()));

    if (missing.length === 0) {
      console.log(`${city.cityName}: already has all ${rows.length} partners`);
      continue;
    }
    const { error } = await admin.from("city_sister_cities").insert(missing);
    if (error) {
      console.log(`FAIL ${city.cityName}: ${error.message}`);
      continue;
    }
    const linked = missing.filter((r) => r.partner_place_id).length;
    console.log(
      `${city.cityName}: added ${missing.length} partners (${linked} linked to a place, ${missing.length - linked} name-only)`,
    );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

// Languages spoken at home, per city, from ACS table B16001 - plus a
// hand-written map of which of our languages each census category
// actually covers.
//
// B16001 reports, for every category, how many people speak it at home
// and how many of those speak English less than "very well". The second
// number is the one a school district, a hospital interpreter office or a
// court acts on, so both are stored.
//
// The categories are the hard part, and the reason half this file is a
// table written by hand. B16001 has 42 of them for the entire world, and
// the coarseness is wildly uneven:
//
//   - Vietnamese, Korean, Khmer and Navajo get a row each. For those the
//     census figure IS the language's figure.
//   - Cantonese, Hakka, Hokkien, Wu, Xiang, Gan, Jin and six more are all
//     inside "Chinese (incl. Mandarin, Cantonese)".
//   - Every indigenous language of North America except Navajo - Cherokee,
//     Lakota, Hopi, Choctaw, Zuni, Tlingit, Nahuatl, Zapotec, every one -
//     is "Other Native languages of North America".
//
// That last line is the single most important fact this loader records.
// The languages with the fewest speakers left are precisely the ones the
// census declines to count, so the only honest thing a page about Cherokee
// can say is that the number does not exist. is_exact carries that
// distinction into the database, and the page renders the two cases
// differently rather than printing a category total under a language's
// name and letting a reader assume it is the language.
//
// Sign languages are absent from B16001 entirely - it asks what language
// is spoken at home - so ASL and the others get no label and no figure,
// which the page also has to say out loud.
//
// Run: npm run load-language-census -- --dry-run     (prints, writes nothing)
//      npm run load-language-census -- --prod
import { adminClient } from "./lib/admin";
import { CENSUS_REPORTER_UA as UA, resolveCities } from "./lib/census-geo";

const SOURCE = "US Census Bureau, ACS table B16001 (via Census Reporter)";

/**
 * Census category -> our languages, written out by hand.
 *
 * `exact` means the category counts these and nothing else. Only ever one
 * language, by definition - if a second belonged here the category would
 * not be exact.
 *
 * `lumped` means the category counts these together with each other (and
 * usually with languages we do not hold). Their pages get the category
 * total clearly labelled as the category's, never as theirs.
 *
 * Names must match languages.name exactly; any that do not are reported
 * at the end of the run rather than silently skipped.
 */
const CATEGORIES: Record<string, { exact?: string[]; lumped?: string[] }> = {
  Spanish: { exact: ["Spanish"] },
  "French (incl. Cajun)": { exact: ["French"] },
  Haitian: { exact: ["Haitian Creole"] },
  Italian: { exact: ["Italian"] },
  Portuguese: { exact: ["Portuguese"] },
  German: { exact: ["German"] },
  "Yiddish, Pennsylvania Dutch or other West Germanic languages": {
    lumped: ["Dutch", "Afrikaans"],
  },
  Greek: { exact: ["Greek"] },
  Russian: { exact: ["Russian"] },
  Polish: { exact: ["Polish"] },
  "Serbo-Croatian": { exact: ["Serbo-Croatian"] },
  "Ukrainian or other Slavic languages": {
    lumped: ["Ukrainian", "Belarusian", "Czech"],
  },
  // The census bundles Dari in with Farsi; our row is Farsi alone.
  "Persian (incl. Farsi, Dari)": { lumped: ["Persian"] },
  Gujarati: { exact: ["Gujarati"] },
  Hindi: { exact: ["Hindi"] },
  Urdu: { exact: ["Urdu"] },
  Punjabi: { exact: ["Punjabi"] },
  Bengali: { lumped: ["Bengali", "Chittagonian", "Sylheti"] },
  "Nepali, Marathi, or other Indic languages": {
    lumped: [
      "Nepali", "Marathi", "Sinhalese", "Konkani", "Marwari", "Bhojpuri",
      "Awadhi", "Maithili", "Magahi", "Haryanvi", "Chhattisgarhi", "Sindhi",
      "Assamese", "Oriya", "Odia", "Dhundhari", "Khandeshi", "Kutchi",
      "Deccan", "Saraiki", "Kashmiri", "Dogri", "Bhili", "Gurung", "Romani",
    ],
  },
  "Other Indo-European languages": {
    lumped: [
      "Kurdish", "Pashto", "Balochi", "Romanian", "Swedish", "Welsh",
      "Hungarian", "Sami", "Esperanto",
    ],
  },
  Telugu: { exact: ["Telugu"] },
  Tamil: { exact: ["Tamil"] },
  "Malayalam, Kannada, or other Dravidian languages": {
    lumped: ["Malayalam", "Kannada", "Tulu", "Gondi", "Kurukh"],
  },
  // Thirteen of our languages, one census row.
  "Chinese (incl. Mandarin, Cantonese)": {
    lumped: [
      "Mandarin Chinese/Putonghua", "Cantonese", "Hakka",
      "Taiwanese/Hokkien/Min Nan", "Teochew", "Shanghainese/Wu",
      "Wenzhounese/Oujiang", "Hunanese/Xiang", "Jiangxinese/Gan", "Jin",
      "Min Bei", "Fuzhounese/Hokchiu/Min Dong", "Henghua/Pu-Xian Min",
      "Leizhounese/Leizhou Min", "Hainanese/Qiong Wen",
    ],
  },
  Japanese: { exact: ["Japanese"] },
  Korean: { exact: ["Korean"] },
  Hmong: { exact: ["Hmong"] },
  Vietnamese: { exact: ["Vietnamese"] },
  Khmer: { exact: ["Khmer"] },
  "Thai, Lao, or other Tai-Kadai languages": { lumped: ["Thai", "Zhuang"] },
  // The Turkic languages land here rather than under "Other
  // Indo-European languages", which is where it is tempting to put
  // Turkish: Turkish, Uzbek, Azerbaijani and Kazakh are Turkic, not
  // Indo-European, and the census files them by region.
  "Other languages of Asia": {
    lumped: [
      "Burmese", "Tibetan", "Uyghur", "Dzongkha", "Turkish", "Uzbek",
      "Azerbaijani", "Kazakh", "Iu Mien", "Manipuri/Meithei", "Bodo", "Santali",
    ],
  },
  "Tagalog (incl. Filipino)": { exact: ["Tagalog/Filipino"] },
  "Ilocano, Samoan, Hawaiian, or other Austronesian languages": {
    lumped: [
      "Ilokano", "Hawaiian", "Malay/Indonesian", "Javanese", "Sundanese",
      "Madurese", "Cebuano", "Hiligaynon", "Amis Formosan", "Malagasy",
    ],
  },
  Arabic: { exact: ["Arabic"] },
  // Two categories we hold no language for. Listed with nothing mapped to
  // them so the "categories missing from CATEGORIES" check at the end
  // keeps meaning "the table changed" rather than reporting the same two
  // known gaps on every run until nobody reads the warning. Adding either
  // language is all it would take to fill these in.
  Armenian: {},
  Hebrew: {},
  "Amharic, Somali, or other Afro-Asiatic languages": {
    lumped: ["Amharic", "Somali", "Oromo", "Berber", "Hausa"],
  },
  "Yoruba, Twi, Igbo, or other languages of Western Africa": {
    lumped: ["Yoruba", "Igbo", "Fula", "Akan", "Ewe", "Mossi"],
  },
  "Swahili or other languages of Central, Eastern, and Southern Africa": {
    lumped: ["Swahili", "Chewa", "Kirundi", "Kinyarwanda", "Shona", "Zulu", "Xhosa", "Lugbara"],
  },
  Navajo: { exact: ["Navajo"] },
  // The whole point. Twenty-two of our languages; one census category
  // that names none of them.
  //
  // Scoped to languages indigenous to the US and Canada, which is what
  // the Bureau means by this category: its coarser tables list "Native
  // North American languages, including the American Indian and Alaska
  // Native languages" and "indigenous languages of Central and South
  // America" as two separate things.
  //
  // So Nahuatl, Mixtec, Zapotec, Maya and Quechua are deliberately NOT
  // here, even though they were in the first draft of this map. They
  // land in the Bureau's residual "Other and unspecified languages"
  // bucket, which is skipped below because it is shared with everything
  // else the Bureau declines to name and so means nothing about any one
  // language. Leaving them unmapped makes their pages say the census has
  // no category for them - which is true, and is a sharper statement
  // than a number: there are hundreds of thousands of Mixtec and Zapotec
  // speakers in California and the census does not count them.
  //
  // Mapping them here instead would have printed Oklahoma's and Alaska's
  // figures under the heading "Nahuatl", which is the exact failure
  // is_exact exists to prevent.
  "Other Native languages of North America": {
    lumped: [
      "Cherokee language", "Dakota", "Lakota", "Ojibwe/Chippewa",
      "Muscogee/Creek", "Choctaw", "Zuni", "Hopi", "Crow", "Cheyenne",
      "Apache", "Keres", "Tewa", "Tiwa", "Shoshone/Goshute",
      "Oodham/Papago-Pima", "Tlingit", "Aleut/Unangan", "Yupik",
      "Inuit/Inuktitut/Greenlandic", "Ohlone/Costanoan", "Lenape/Delaware",
    ],
  },
};

// Not languages. "Speak only English" is the comparison baseline rather
// than a category, and the residual bucket is where the Bureau puts
// anything it cannot or will not name.
const SKIP = new Set(["Total", "Speak only English", "Other and unspecified languages"]);

const LIMITED = 'Speak English less than "very well"';

type Column = { indent: number; name: string };
type Body = {
  release: { name: string };
  tables: { B16001: { columns: Record<string, Column> } };
  data: Record<string, { B16001: { estimate: Record<string, number> } }>;
  // Present when several geographies are requested at once, which is how
  // the states are fetched. Keyed by geo id, and the only place the
  // state's NAME appears - the response data is keyed by id alone.
  geography?: Record<string, { name: string }>;
};

/** "Spanish:" -> "Spanish" */
const label = (name: string) => name.replace(/:\s*$/, "").trim();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Census Reporter is a free nonprofit API with no key and no published
// quota, which means the only polite rate limit is the one the caller
// imposes on itself. Eighty requests fired as fast as Node can issue them
// got this script temporarily cut off mid-run - and the failure mode was
// the dangerous kind: the first ten cities loaded, the rest came back
// empty, and nothing in the output distinguished "this city has no data"
// from "we were throttled". Hence both the delay and the retries, and
// hence the run reporting a non-zero exit if any city ends up missing.
const DELAY_MS = 1_500;

/**
 * One city's table, or null after exhausting retries.
 *
 * Treats an unparseable body the same as an HTTP error, because that is
 * exactly what throttling looks like here: 200-with-empty-body rather
 * than a status code.
 */
async function fetchTable(geoId: string): Promise<Body | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(5_000 * 2 ** (attempt - 1));
    let response: Response;
    try {
      response = await fetch(
        `https://api.censusreporter.org/1.0/data/show/latest?table_ids=B16001&geo_ids=${geoId}`,
        { headers: { "User-Agent": UA } },
      );
    } catch {
      continue;
    }
    const raw = await response.text();
    if (!raw.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    // A real "this geography does not have this table" answer, which is
    // final and must not be retried.
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      console.log(`  no data: ${(parsed as { error: string }).error}`);
      return null;
    }
    if (!response.ok) continue;
    return parsed as Body;
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const admin = adminClient({ readOnly: dryRun });

  // 1. The mapping, which needs no network and is worth checking first.
  const { data: ours, error: languageError } = await admin
    .from("languages")
    .select("id, name")
    .order("id");
  if (languageError) throw languageError;
  const idByName = new Map((ours ?? []).map((l) => [l.name as string, l.id as number]));

  const mappings: { language_id: number; census_label: string; is_exact: boolean }[] = [];
  const unknownNames: string[] = [];
  const mapped = new Set<string>();
  for (const [censusLabel, spec] of Object.entries(CATEGORIES)) {
    for (const [names, isExact] of [
      [spec.exact ?? [], true],
      [spec.lumped ?? [], false],
    ] as [string[], boolean][]) {
      for (const name of names) {
        const id = idByName.get(name);
        if (id === undefined) {
          unknownNames.push(name);
          continue;
        }
        mappings.push({ language_id: id, census_label: censusLabel, is_exact: isExact });
        mapped.add(name);
      }
    }
  }

  const unmapped = (ours ?? []).map((l) => l.name as string).filter((n) => !mapped.has(n));
  console.log(`${mappings.length} language-to-category mappings`);
  if (unknownNames.length) {
    console.log(`\n! named in CATEGORIES but not in languages: ${unknownNames.join(", ")}`);
  }
  // Expected to be non-empty, and worth printing every run: these are the
  // pages that will carry no census figure at all. Sign languages belong
  // here permanently; anything else is a gap in the map above.
  console.log(`\n${unmapped.length} languages with no census category: ${unmapped.join(", ")}`);

  if (!dryRun) {
    // Replaced wholesale, not upserted. This table is derived entirely
    // from CATEGORIES above, so an upsert would make additions take
    // effect and REMOVALS silently not - which is precisely what
    // happened when Nahuatl and Quechua were taken out of the Native
    // North American category: the rows stayed behind and the pages kept
    // quoting Oklahoma's figures.
    const { error: clearError } = await admin
      .from("language_census_labels")
      .delete()
      .gte("language_id", 0);
    if (clearError) throw clearError;
    const { error } = await admin.from("language_census_labels").insert(mappings);
    if (error) throw error;
  }

  // 2. The figures.
  //
  // States first, and in a single request: Census Reporter accepts
  // "040|01000US" for "every state in the US", which returns all 51
  // geographies at once. One request instead of fifty is both faster and
  // the polite thing to do to a free API.
  //
  // States are not a consolation prize for the cities that lack B16001.
  // For an indigenous or heritage language they are the better unit -
  // Cherokee is an Oklahoma and North Carolina story, Navajo an Arizona
  // and New Mexico one - and no city page would ever have shown them.
  let rowCount = 0;
  const seenLabels = new Set<string>();
  const failed: string[] = [];

  /**
   * Turn one geography's estimates into rows.
   *
   * A category is an indent-1 column; its "speaks English less than very
   * well" figure is the indent-2 column beneath it, before the next
   * indent-1.
   */
  function rowsFor(
    placeId: number,
    columns: Record<string, Column>,
    estimates: Record<string, number>,
    period: string,
  ) {
    const ordered = Object.keys(columns).sort();
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const column = ordered[i];
      if (columns[column].indent !== 1) continue;
      const name = label(columns[column].name);
      if (SKIP.has(name)) continue;
      seenLabels.add(name);

      let limited: number | null = null;
      for (let j = i + 1; j < ordered.length && columns[ordered[j]].indent === 2; j++) {
        if (label(columns[ordered[j]].name) === LIMITED) {
          const value = estimates[ordered[j]];
          limited = Number.isFinite(value) ? Math.round(value) : null;
        }
      }

      const speakers = estimates[column];
      if (!Number.isFinite(speakers)) continue;
      // Zero is a real answer and worth knowing - "nobody here speaks
      // this" is information - but it is not worth 42 rows per place.
      if (Math.round(speakers) === 0) continue;

      rows.push({
        place_id: placeId,
        census_label: name,
        speakers: Math.round(speakers),
        limited_english: limited,
        source: SOURCE,
        period,
      });
    }
    return rows;
  }

  async function write(placeId: number, rows: Record<string, unknown>[], period: string) {
    // Replace this release's rows rather than accumulating, so a re-run
    // corrects rather than duplicates.
    await admin
      .from("place_language_stats")
      .delete()
      .eq("place_id", placeId)
      .eq("period", period);
    return admin.from("place_language_stats").insert(rows);
  }

  const { data: us } = await admin
    .from("places")
    .select("id")
    .eq("type", "country")
    .eq("iso_code", "US")
    .single();
  const { data: statePlaces } = await admin
    .from("places")
    .select("id, name")
    .eq("parent_id", us!.id)
    .eq("type", "region");
  const statePlaceByName = new Map(
    (statePlaces ?? []).map((s) => [(s.name as string).toLowerCase(), s.id as number]),
  );

  const stateBody = await fetchTable("040|01000US");
  if (!stateBody) {
    console.log("FAIL states: could not fetch B16001 for the states");
    failed.push("<all states>");
  } else {
    const columns = stateBody.tables.B16001.columns;
    const period = stateBody.release.name;
    let loadedStates = 0;
    const unmatchedStates: string[] = [];
    for (const [geoId, geo] of Object.entries(stateBody.geography ?? {})) {
      // The response includes the United States itself alongside the 50
      // states; a national total is not a place anybody lives in for the
      // purposes of this page.
      if (geoId === "01000US") continue;
      const placeId = statePlaceByName.get(geo.name.toLowerCase());
      if (!placeId) {
        unmatchedStates.push(geo.name);
        continue;
      }
      const estimates = stateBody.data[geoId]?.B16001?.estimate;
      if (!estimates) continue;
      const rows = rowsFor(placeId, columns, estimates, period);
      if (rows.length === 0) continue;
      if (!dryRun) {
        const { error } = await write(placeId, rows, period);
        if (error) {
          console.log(`FAIL ${geo.name}: ${error.message}`);
          failed.push(geo.name);
          continue;
        }
      }
      rowCount += rows.length;
      loadedStates++;
    }
    console.log(`\nstates: ${loadedStates} loaded (${period})`);
    if (unmatchedStates.length) {
      console.log(`  no matching place row: ${unmatchedStates.join(", ")}`);
    }
  }

  // Then the cities, one request each. Only about fourteen of them have
  // B16001 at all; the rest answer with a definitive "no release had this
  // table", which is recorded rather than retried.
  const cities = await resolveCities(admin);
  const cityless: string[] = [];
  let loadedCities = 0;

  for (const [index, city] of cities.entries()) {
    if (index > 0) await sleep(DELAY_MS);
    const body = await fetchTable(city.geoId);
    if (!body) {
      // Distinguished from `failed`: this is the Bureau not publishing
      // the table for this city, not something going wrong here.
      cityless.push(city.name);
      continue;
    }
    const estimates = body.data[city.geoId]?.B16001?.estimate;
    if (!estimates) {
      cityless.push(city.name);
      continue;
    }
    const period = body.release.name;
    const rows = rowsFor(city.placeId, body.tables.B16001.columns, estimates, period);
    if (dryRun) {
      const top = [...rows]
        .sort((a, b) => (b.speakers as number) - (a.speakers as number))
        .slice(0, 3)
        .map((r) => `${r.census_label} ${(r.speakers as number).toLocaleString()}`);
      console.log(`  ${city.name} (${period}): ${rows.length} categories — ${top.join(", ")}`);
    } else {
      const { error } = await write(city.placeId, rows, period);
      if (error) {
        console.log(`FAIL ${city.name}: ${error.message}`);
        failed.push(city.name);
        continue;
      }
    }
    rowCount += rows.length;
    loadedCities++;
  }

  console.log(`cities: ${loadedCities} loaded, ${cityless.length} not published by the Bureau`);
  if (cityless.length) console.log(`  ${cityless.join(", ")}`);
  console.log(`\n${rowCount} place-language rows`);

  // A category in the data that nothing maps to means CATEGORIES is out
  // of date with the table - the figures would load and no page would
  // ever show them.
  const unmappedLabels = [...seenLabels].filter((l) => !(l in CATEGORIES));
  if (unmappedLabels.length) {
    console.log(`! census categories missing from CATEGORIES: ${unmappedLabels.join(", ")}`);
  }
  if (dryRun) console.log("(dry run — nothing written)");

  // A partial load is the outcome worth shouting about: the pages for the
  // missing cities would look exactly like cities where nobody speaks
  // anything, and nothing on them would hint that a fetch had failed.
  if (failed.length) {
    console.log(`\n${failed.length} places did not load: ${failed.join(", ")}`);
    console.log("Re-run to fill them in; completed places are replaced, not duplicated.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

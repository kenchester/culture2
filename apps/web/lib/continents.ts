/**
 * ISO 3166-1 alpha-2 country code to continent.
 *
 * Added so a consular corps can be read: Houston's is 87 entries, and a
 * single alphabetical run from Albania to Vietnam is a wall rather than a
 * list.
 *
 * Grouping follows the UN M49 standard, which is worth knowing because it
 * puts several transcontinental countries where a reader might not expect:
 * Turkey, Cyprus, Georgia, Armenia and Azerbaijan are Asia; Russia is
 * Europe. M49 is used rather than a judgement call precisely because this
 * is the kind of choice that otherwise gets made inconsistently and then
 * argued about.
 *
 * Australia and New Zealand sit under Oceania.
 */

export const CONTINENTS = ["africa", "americas", "asia", "europe", "oceania"] as const;
export type Continent = (typeof CONTINENTS)[number];

const BY_CONTINENT: Record<Continent, string> = {
  africa:
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  americas:
    "AI AG AR AW BS BB BZ BM BO BQ BR CA KY CL CO CR CU CW DM DO EC SV FK GF GL GD GP GT GY HT HN JM MQ MX MS NI PA PY PE PR BL KN LC MF PM VC SX SR TT TC US UY VE VG VI",
  asia:
    "AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KP KR KW KG LA LB MO MY MV MN MM NP OM PK PS PH QA SA SG LK SY TW TJ TH TL TR TM AE UZ VN YE",
  europe:
    "AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA AX",
  oceania:
    "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF",
};

const LOOKUP = new Map<string, Continent>();
for (const continent of CONTINENTS) {
  for (const code of BY_CONTINENT[continent].split(" ")) {
    LOOKUP.set(code, continent);
  }
}

/** Null for a code this map doesn't cover, so callers can group it last. */
export function continentOf(iso: string): Continent | null {
  return LOOKUP.get(iso.toUpperCase()) ?? null;
}

/**
 * Groups items by continent, in CONTINENTS order, dropping empty groups.
 * Anything unmapped is returned under `other`.
 */
export function groupByContinent<T>(
  items: T[],
  isoOf: (item: T) => string,
): { continent: Continent | "other"; items: T[] }[] {
  const buckets = new Map<Continent | "other", T[]>();
  for (const item of items) {
    const key = continentOf(isoOf(item)) ?? "other";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return [...CONTINENTS, "other" as const]
    .filter((key) => buckets.has(key))
    .map((key) => ({ continent: key, items: buckets.get(key)! }));
}

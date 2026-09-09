export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "fr",
  "ja",
  "de",
  "zh",
  "it",
  "ar",
  "ko",
  "ru",
  "pt",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  ja: "日本語",
  de: "Deutsch",
  zh: "简体中文",
  it: "Italiano",
  ar: "العربية",
  ko: "한국어",
  ru: "Русский",
  pt: "Português",
};

// Azure Translator language codes, only where they differ from our locale codes.
export const LOCALE_TO_AZURE_CODE: Partial<Record<Locale, string>> = {
  zh: "zh-Hans",
};

export function toAzureCode(locale: Locale): string {
  return LOCALE_TO_AZURE_CODE[locale] ?? locale;
}

// Same mapping, for a *source* language that isn't necessarily one of our
// UI locales - a transcript or a signed-language summary can be in any
// language in the database, not just the 11 the interface is offered in.
export function toAzureSourceCode(isoCode: string): string {
  return (LOCALE_TO_AZURE_CODE as Record<string, string>)[isoCode] ?? isoCode;
}

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

export const DEFAULT_LOCALE: Locale = "en";

/**
 * The cookie the switcher writes. It means exactly one thing - "this person
 * chose this language" - and detection must never write it, or that meaning
 * is lost. See lib/supabase/proxy.ts.
 */
export const CHOSEN_LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Request-scoped carrier for a detected (guessed) locale. The proxy sets it
 * on the inbound request so the first render is already correct; it is
 * never sent to the browser, and never outlives the request. Anything a
 * client sends under this name is cleared before use.
 */
export const DETECTED_LOCALE_COOKIE = "x-detected-locale";

/**
 * ISO 3166-1 alpha-2 country code -> the locale we ship that the country's
 * MAJORITY actually reads. Absent means "no signal" - localeFromCountry
 * returns null and the caller falls through, rather than us asserting a
 * language for a country we can't serve.
 *
 * Two rules govern what's in here:
 *
 * 1. Majority, not merely official. Macau has Portuguese as a co-official
 *    language but under 1% of residents speak it; it read MO -> "pt" here
 *    until this rule was applied, which would have served Portuguese to a
 *    Cantonese-speaking population. Removed.
 *
 * 2. Script matters, so the Traditional/Simplified split applies here just
 *    as it does to Accept-Language. We publish Simplified only, so TW, HK
 *    and MO are all absent - Simplified is a visibly wrong answer for a
 *    Traditional reader, not a partial one.
 *
 * Genuinely mixed countries (BE, CH, CA) are handled by REGION_TO_LOCALE
 * below instead of guessing nationally.
 *
 * Note that every "en" entry is behaviourally redundant with DEFAULT_LOCALE
 * - they're kept because they record a deliberate judgement ("English is
 * genuinely the working language here") rather than an oversight.
 */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // English
  US: "en", GB: "en", IE: "en", AU: "en", NZ: "en", CA: "en", ZA: "en",
  IN: "en", PK: "en", PH: "en", SG: "en",
  NG: "en", KE: "en", UG: "en", TZ: "en", ZM: "en", ZW: "en", GH: "en",
  SL: "en", LR: "en", GM: "en", MW: "en", BW: "en", NA: "en", SS: "en",
  MU: "en", SC: "en", SZ: "en", LS: "en",
  JM: "en", TT: "en", BS: "en", BB: "en", BZ: "en", GY: "en",
  AG: "en", DM: "en", GD: "en", KN: "en", LC: "en", VC: "en",
  FJ: "en", PG: "en", SB: "en", VU: "en", KI: "en", TV: "en", NR: "en",
  FM: "en", MH: "en", PW: "en", WS: "en", TO: "en", CK: "en",
  MT: "en",

  // Spanish
  ES: "es", MX: "es", GT: "es", HN: "es", SV: "es", NI: "es", CR: "es",
  PA: "es", CU: "es", DO: "es", CO: "es", VE: "es", EC: "es", PE: "es",
  BO: "es", PY: "es", CL: "es", AR: "es", UY: "es", GQ: "es", PR: "es",

  // French
  FR: "fr", LU: "fr", MC: "fr",
  SN: "fr", ML: "fr", BF: "fr", NE: "fr", CI: "fr", GN: "fr", TG: "fr",
  BJ: "fr", CF: "fr", TD: "fr", CG: "fr", CD: "fr", GA: "fr", CM: "fr",
  MG: "fr", BI: "fr", HT: "fr", PF: "fr", NC: "fr",

  // Japanese
  JP: "ja",

  // German
  DE: "de", AT: "de", CH: "de", LI: "de",

  // Simplified Chinese
  CN: "zh",

  // Italian
  IT: "it", SM: "it", VA: "it",

  // Arabic
  SA: "ar", EG: "ar", AE: "ar", MA: "ar", DZ: "ar", TN: "ar", LY: "ar",
  IQ: "ar", JO: "ar", LB: "ar", KW: "ar", QA: "ar", BH: "ar", OM: "ar",
  YE: "ar", SY: "ar", SD: "ar", PS: "ar", MR: "ar", SO: "ar", DJ: "ar",
  KM: "ar", EH: "ar",

  // Korean
  KR: "ko", KP: "ko",

  // Russian
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru",

  // Portuguese
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt",
  TL: "pt",
};

/**
 * Sub-national overrides for countries where a single national answer would
 * be confidently wrong for a large minority. Keyed by ISO 3166-2 subdivision
 * code, which is what x-vercel-ip-country-region carries.
 *
 * - CA: English is the national majority (~75%), so CA stays "en" above;
 *   Quebec is the one subdivision where that's clearly wrong.
 * - CH: German is a ~62% plurality nationally, but the Romandy cantons and
 *   Italian-speaking Ticino are not German-reading. Carving those out leaves
 *   a remainder that is overwhelmingly German, so CH -> "de" is safe once
 *   they're excluded. (CH-FR is Fribourg, a French-majority canton - the
 *   code collides with France's country code but is unambiguous here.)
 * - BE: Dutch is the national majority and we don't publish Dutch, so BE is
 *   absent from COUNTRY_TO_LOCALE entirely. Only Wallonia and Brussels,
 *   both French-reading, get an answer; Flanders correctly gets none.
 */
const REGION_TO_LOCALE: Record<string, Record<string, Locale>> = {
  CA: { QC: "fr" },
  CH: { GE: "fr", VD: "fr", NE: "fr", JU: "fr", VS: "fr", FR: "fr", TI: "it" },
  BE: { WAL: "fr", BRU: "fr" },
};

/**
 * Geolocation signal. Returns null for "no signal" - a missing header, an
 * unmapped country, or a country we deliberately refuse to guess at - so
 * the caller falls through to the next signal instead of stopping at the
 * default here.
 */
export function localeFromCountry(
  country: string | null | undefined,
  region?: string | null | undefined,
): Locale | null {
  if (!country) return null;
  const code = country.toUpperCase();

  const subdivision = region?.trim().toUpperCase();
  if (subdivision) {
    const override = REGION_TO_LOCALE[code]?.[subdivision];
    if (override) return override;
  }

  return COUNTRY_TO_LOCALE[code] ?? null;
}

// The Chinese we ship is Simplified (LOCALE_LABELS.zh is 简体中文), so only
// the Simplified-writing tags map onto it. zh-TW / zh-HK / zh-MO / zh-Hant
// are Traditional and deliberately do NOT match - serving Simplified to a
// Traditional reader is its own kind of wrong, and falling through to the
// next language they listed is better. This matches the existing choice in
// COUNTRY_TO_LOCALE, which maps CN to zh but leaves TW out entirely.
const SIMPLIFIED_CHINESE_TAGS = new Set(["zh", "zh-hans", "zh-cn", "zh-sg", "zh-my"]);

/** One BCP-47 tag -> a supported locale, or null if we don't offer it. */
function localeFromTag(tag: string): Locale | null {
  const lower = tag.toLowerCase();
  // "*" means "anything else is fine" - it states no preference, so it
  // tells us nothing and must not beat the IP fallback.
  if (!lower || lower === "*") return null;

  if (lower === "zh" || lower.startsWith("zh-")) {
    return SIMPLIFIED_CHINESE_TAGS.has(lower) || lower.startsWith("zh-hans") ? "zh" : null;
  }

  // Region and script subtags don't change which translation we serve:
  // pt-BR and pt-PT both get "pt", en-GB and en-US both get "en".
  const primary = lower.split("-")[0];
  return isLocale(primary) ? primary : null;
}

/**
 * Parses an Accept-Language header into the supported locales it asks for,
 * most-preferred first, de-duplicated.
 *
 * Handles the q-value grammar properly: "zh-CN,zh;q=0.9,en;q=0.8" means
 * Simplified Chinese, then Chinese, then English. A tag with no q is 1.0
 * (the strongest preference), and q=0 means "explicitly not this" and is
 * dropped rather than ranked last. Equal q values keep header order, which
 * is what the spec intends.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale[] {
  if (!header) return [];

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [rawTag, ...params] = part.split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.toLowerCase().startsWith("q="));
      const parsed = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return {
        tag: rawTag.trim(),
        // A malformed q is treated as "unspecified" (1.0) rather than
        // discarding an otherwise usable preference.
        q: Number.isFinite(parsed) ? parsed : 1,
        index,
      };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  const locales: Locale[] = [];
  for (const { tag } of ranked) {
    const locale = localeFromTag(tag);
    if (locale && !locales.includes(locale)) locales.push(locale);
  }
  return locales;
}

/**
 * Stated-preference signal. Null when the header is absent or names only
 * languages we don't publish, so the caller can fall through to geography.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  return parseAcceptLanguage(header)[0] ?? null;
}

/**
 * Picks the interface language for a visitor who has NOT made an explicit
 * choice. The caller is responsible for checking the stored preference
 * first - that always wins and never reaches this function.
 *
 * Order is Accept-Language, then geography, then the default.
 *
 * Accept-Language outranks geography because the two answer different
 * questions. The header is a stated preference - what this person wants to
 * read. The IP country is a fact about the network - where the request
 * happened to leave from. They agree most of the time and diverge in
 * exactly the cases that matter: a Chinese student in the US, an American
 * on holiday in Paris, anyone whose corporate VPN exits in Frankfurt. In
 * all three the header is right and the location is wrong.
 *
 * The cost of that ordering, stated plainly: a browser left on its factory
 * default reports the language the device shipped with, and nothing in the
 * request distinguishes that from a deliberate choice. So someone abroad
 * with a default-English laptop gets English where geography would have
 * given them the local language. The trade cuts both ways - we're choosing
 * to believe a stated preference that is sometimes only an unexamined
 * default, over a location that is sometimes only where the VPN exits. It
 * favours the person who has expressed themselves at the expense of the
 * person who hasn't, and the language switcher is the remedy for whoever
 * lands on the wrong side of it.
 */
export function resolveLocale(
  acceptLanguage: string | null | undefined,
  country: string | null | undefined,
  region?: string | null | undefined,
): Locale {
  return (
    localeFromAcceptLanguage(acceptLanguage) ??
    localeFromCountry(country, region) ??
    DEFAULT_LOCALE
  );
}

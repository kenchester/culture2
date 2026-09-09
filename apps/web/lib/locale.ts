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

/**
 * ISO 3166-1 alpha-2 country code -> best-match supported locale, based on
 * each country's official/primary language. Countries whose official
 * language isn't one of SUPPORTED_LOCALES are intentionally absent here and
 * fall back to "en" via detectLocaleFromCountry, per product requirements.
 * Countries with more than one official language pick whichever is both
 * primary/most-used AND on our list (e.g. Switzerland -> German, its
 * largest-plurality national language, even though French/Italian are also
 * official there).
 */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // English
  US: "en", GB: "en", IE: "en", AU: "en", NZ: "en", CA: "en", ZA: "en",
  IN: "en", PK: "en", PH: "en", SG: "en", HK: "en",
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
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
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
  TL: "pt", MO: "pt",
};

export function detectLocaleFromCountry(country: string | null | undefined): Locale {
  if (!country) return "en";
  return COUNTRY_TO_LOCALE[country.toUpperCase()] ?? "en";
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
 * Picks the initial interface language for a visitor who hasn't chosen one.
 *
 * Accept-Language wins, because it's a stated preference ("what I want to
 * read") while the IP country is only a fact about the network ("where this
 * request came from"). Those disagree in exactly the cases that matter: a
 * Chinese student in the US, an American on holiday in Paris, anyone on a
 * corporate VPN that exits in Frankfurt.
 *
 * The country is the fallback for the case Accept-Language can't cover -
 * no header at all, or one that asks only for languages we don't publish.
 *
 * Known limitation, not solvable here: a device whose language settings
 * were never touched still sends its shipped default (usually en-US), and
 * that is indistinguishable from someone who genuinely wants English. Such
 * a visitor gets English even in, say, Mexico. The language switcher
 * remains the fix for them, and their choice is respected permanently.
 */
export function detectLocale(
  acceptLanguage: string | null | undefined,
  country: string | null | undefined,
): Locale {
  return parseAcceptLanguage(acceptLanguage)[0] ?? detectLocaleFromCountry(country);
}

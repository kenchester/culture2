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

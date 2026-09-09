// Run with: npm run test
//
// Covers the two detection signals in isolation. The end-to-end wiring
// (proxy -> first render) is not unit-testable here and is exercised with
// curl against a running server instead - see the verification notes in
// lib/supabase/proxy.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCALE,
  localeFromAcceptLanguage,
  localeFromCountry,
  parseAcceptLanguage,
  resolveLocale,
} from "./locale";

test("parseAcceptLanguage: sorts by weight, descending", () => {
  assert.deepEqual(parseAcceptLanguage("en;q=0.5,de;q=0.9"), ["de", "en"]);
  assert.deepEqual(parseAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8"), ["zh", "en"]);
});

test("parseAcceptLanguage: absent weight is 1.0, the strongest", () => {
  assert.deepEqual(parseAcceptLanguage("de,fr;q=0.9"), ["de", "fr"]);
  assert.deepEqual(parseAcceptLanguage("fr;q=0.9,de"), ["de", "fr"]);
});

test("parseAcceptLanguage: equal weights keep the sender's order", () => {
  assert.deepEqual(parseAcceptLanguage("fr;q=0.5,de;q=0.5"), ["fr", "de"]);
  assert.deepEqual(parseAcceptLanguage("de;q=0.5,fr;q=0.5"), ["de", "fr"]);
});

test("parseAcceptLanguage: q=0 means not acceptable, so it is dropped", () => {
  assert.deepEqual(parseAcceptLanguage("en;q=0,de"), ["de"]);
  // Dropped entirely, not merely ranked last:
  assert.deepEqual(parseAcceptLanguage("en;q=0"), []);
  assert.equal(localeFromAcceptLanguage("en;q=0"), null);
});

test("parseAcceptLanguage: '*' carries no information", () => {
  assert.deepEqual(parseAcceptLanguage("*"), []);
  assert.equal(localeFromAcceptLanguage("*"), null);
  assert.deepEqual(parseAcceptLanguage("*;q=0.1,de;q=0.05"), ["de"]);
});

test("parseAcceptLanguage: uncovered languages fall through to a covered one", () => {
  assert.deepEqual(parseAcceptLanguage("sv,nb,fr;q=0.3"), ["fr"]);
  assert.deepEqual(parseAcceptLanguage("sv,nb"), []);
});

test("parseAcceptLanguage: region subtags collapse, script subtags do not", () => {
  assert.deepEqual(parseAcceptLanguage("pt-BR"), ["pt"]);
  assert.deepEqual(parseAcceptLanguage("pt-PT"), ["pt"]);
  assert.deepEqual(parseAcceptLanguage("en-GB"), ["en"]);
});

test("parseAcceptLanguage: Traditional Chinese must NOT match Simplified", () => {
  for (const tag of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-TW"]) {
    assert.deepEqual(parseAcceptLanguage(tag), [], `${tag} must not match`);
  }
  // ...and falls through to the next language the visitor listed.
  assert.deepEqual(parseAcceptLanguage("zh-TW,en;q=0.5"), ["en"]);
  // Simplified variants do match.
  for (const tag of ["zh", "zh-CN", "zh-SG", "zh-Hans", "zh-Hans-CN", "ZH-HANS-CN"]) {
    assert.deepEqual(parseAcceptLanguage(tag), ["zh"], `${tag} must match`);
  }
});

test("parseAcceptLanguage: tolerates whitespace and odd casing", () => {
  assert.deepEqual(parseAcceptLanguage("  de , fr ; q=0.9 "), ["de", "fr"]);
  assert.deepEqual(parseAcceptLanguage("DE,FR;Q=0.9"), ["de", "fr"]);
});

test("parseAcceptLanguage: malformed input never throws", () => {
  assert.deepEqual(parseAcceptLanguage(null), []);
  assert.deepEqual(parseAcceptLanguage(undefined), []);
  assert.deepEqual(parseAcceptLanguage(""), []);
  assert.deepEqual(parseAcceptLanguage(",,,"), []);
  assert.deepEqual(parseAcceptLanguage(";;;"), []);
  assert.deepEqual(parseAcceptLanguage("de;q=bogus"), ["de"]);
  assert.deepEqual(parseAcceptLanguage("de;;q=;;"), ["de"]);
  assert.deepEqual(parseAcceptLanguage("!!!"), []);
});

test("parseAcceptLanguage: de-duplicates", () => {
  assert.deepEqual(parseAcceptLanguage("en-US,en-GB,en;q=0.9"), ["en"]);
});

test("localeFromCountry: no header is no signal, not the default", () => {
  assert.equal(localeFromCountry(null), null);
  assert.equal(localeFromCountry(undefined), null);
  assert.equal(localeFromCountry(""), null);
});

test("localeFromCountry: unmapped country is no signal", () => {
  assert.equal(localeFromCountry("SE"), null); // Swedish: not shipped
  assert.equal(localeFromCountry("NL"), null); // Dutch: not shipped
  assert.equal(localeFromCountry("ZZ"), null); // not a country
});

test("localeFromCountry: Traditional-script regions are not mapped", () => {
  for (const cc of ["TW", "HK", "MO"]) {
    assert.equal(localeFromCountry(cc), null, `${cc} must not map`);
  }
  assert.equal(localeFromCountry("CN"), "zh");
});

test("localeFromCountry: mapped countries", () => {
  assert.equal(localeFromCountry("MX"), "es");
  assert.equal(localeFromCountry("JP"), "ja");
  assert.equal(localeFromCountry("br"), "pt"); // case-insensitive
});

test("localeFromCountry: mixed countries use the sub-national override", () => {
  assert.equal(localeFromCountry("CA"), "en");
  assert.equal(localeFromCountry("CA", "QC"), "fr");
  assert.equal(localeFromCountry("CA", "ON"), "en");

  assert.equal(localeFromCountry("CH"), "de");
  assert.equal(localeFromCountry("CH", "GE"), "fr");
  assert.equal(localeFromCountry("CH", "TI"), "it");
  assert.equal(localeFromCountry("CH", "ZH"), "de");

  // Dutch-majority Belgium gets no national answer at all.
  assert.equal(localeFromCountry("BE"), null);
  assert.equal(localeFromCountry("BE", "WAL"), "fr");
  assert.equal(localeFromCountry("BE", "VLG"), null);
});

test("resolveLocale: stated preference beats location", () => {
  // A Chinese student in the US.
  assert.equal(resolveLocale("zh-CN,zh;q=0.9,en;q=0.8", "US"), "zh");
  // An American on holiday in Paris.
  assert.equal(resolveLocale("en-US,en;q=0.9", "FR"), "en");
  // A corporate VPN exiting Frankfurt.
  assert.equal(resolveLocale("en-GB,en;q=0.9", "DE"), "en");
});

test("resolveLocale: location is used when the browser language is uncovered", () => {
  assert.equal(resolveLocale("sv,nb", "FR"), "fr");
  assert.equal(resolveLocale("zh-TW", "JP"), "ja");
  assert.equal(resolveLocale(null, "MX"), "es");
  assert.equal(resolveLocale("", "MX"), "es");
  assert.equal(resolveLocale("*", "JP"), "ja");
});

test("resolveLocale: neither signal present falls back to the default", () => {
  assert.equal(resolveLocale(null, null), DEFAULT_LOCALE);
  assert.equal(resolveLocale("sv", "SE"), DEFAULT_LOCALE);
  assert.equal(resolveLocale("zh-TW", "TW"), DEFAULT_LOCALE);
});

test("resolveLocale: the documented cost of preferring the header", () => {
  // A factory-default device in Mexico reports en-US, indistinguishable
  // from a deliberate choice, so it gets English rather than Spanish.
  assert.equal(resolveLocale("en-US,en;q=0.9", "MX"), "en");
  // Geography would have said otherwise:
  assert.equal(localeFromCountry("MX"), "es");
});

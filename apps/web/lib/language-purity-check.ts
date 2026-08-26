import nspell from "nspell";
import enDictionary from "dictionary-en";
import esDictionary from "dictionary-es";
import frDictionary from "dictionary-fr";

// Organization-gated networks (Acme University's 4 language networks) need
// posts to stay mostly in the target language, with real leeway for
// proper nouns, building names, and other untranslatable words - "Babbio
// Center" shouldn't cost a Spanish post anything just because "Babbio"
// isn't a Spanish word.
//
// This is per-WORD dictionary classification, not Azure's sentence-level
// language detection (lib/azure-translator.ts) - too coarse for a "% of
// words" measure, and a live API call per post would be slow/costly on
// the synchronous post-submit path. Two zero-cost/offline building blocks:
//
// 1. Intl.Segmenter (built into Node/V8) for tokenization - critically,
//    this correctly word-segments Mandarin Chinese (no whitespace between
//    words) via ICU's dictionary-based segmentation, which a hand-rolled
//    whitespace tokenizer could never do.
// 2. nspell + Hunspell-format dictionaries (English/Spanish/French only)
//    for "is this actually a word" classification. Arabic-script and
//    Han-script content is unambiguous by Unicode script alone relative
//    to a Latin-script target (or vice versa) - there's no "is this
//    secretly a real Chinese word" ambiguity the way there is between
//    Spanish/French/English, which all share Latin script, so those two
//    dictionaries are never needed.

type TargetScript = "arabic" | "han" | "latin";

function targetScriptFor(isoCode: string): TargetScript {
  if (isoCode === "ar") return "arabic";
  if (isoCode === "zh") return "han";
  return "latin";
}

const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const HAN_SCRIPT = /\p{Script=Han}/u;
const LATIN_SCRIPT = /\p{Script=Latin}/u;

type LatinCode = "en" | "es" | "fr";

// Loaded once per warm server instance (Vercel Fluid Compute reuses
// function instances across requests), not per-request - parsing a
// Hunspell affix file on every post would be wasteful.
const spellers = new Map<LatinCode, ReturnType<typeof nspell>>();

function speller(code: LatinCode) {
  let s = spellers.get(code);
  if (!s) {
    const dictionary = code === "es" ? esDictionary : code === "fr" ? frDictionary : enDictionary;
    s = nspell(dictionary);
    spellers.set(code, s);
  }
  return s;
}

function isKnownLatinWord(word: string, code: LatinCode): boolean {
  return speller(code).correct(word);
}

export type LanguagePurityResult = {
  blocked: boolean;
  offRatio: number;
};

const BLOCK_THRESHOLD = 0.25;

export function checkLanguagePurity(text: string, targetIsoCode: string): LanguagePurityResult {
  const targetScript = targetScriptFor(targetIsoCode);
  const segmenter = new Intl.Segmenter(targetIsoCode || "en", { granularity: "word" });
  const words = Array.from(segmenter.segment(text))
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

  let classifiedCount = 0;
  let offCount = 0;

  const otherLatinCode: LatinCode = targetIsoCode === "es" ? "fr" : "es";

  for (const word of words) {
    const isArabic = ARABIC_SCRIPT.test(word);
    const isHan = HAN_SCRIPT.test(word);
    const isLatin = LATIN_SCRIPT.test(word);

    if (targetScript === "arabic") {
      if (isArabic) {
        classifiedCount += 1;
      } else if (isLatin) {
        const lower = word.toLowerCase();
        if (isKnownLatinWord(lower, "en") || isKnownLatinWord(lower, "es") || isKnownLatinWord(lower, "fr")) {
          classifiedCount += 1;
          offCount += 1;
        }
        // else: not a real word in any known language - excluded (proper noun/typo).
      } else if (isHan) {
        classifiedCount += 1;
        offCount += 1;
      }
      continue;
    }

    if (targetScript === "han") {
      if (isHan) {
        classifiedCount += 1;
      } else if (isLatin) {
        const lower = word.toLowerCase();
        if (isKnownLatinWord(lower, "en") || isKnownLatinWord(lower, "es") || isKnownLatinWord(lower, "fr")) {
          classifiedCount += 1;
          offCount += 1;
        }
      } else if (isArabic) {
        classifiedCount += 1;
        offCount += 1;
      }
      continue;
    }

    // Latin-script target (Spanish/French).
    if (isLatin) {
      const lower = word.toLowerCase();
      const targetCode = targetIsoCode as LatinCode;
      if (isKnownLatinWord(lower, targetCode)) {
        classifiedCount += 1;
      } else if (isKnownLatinWord(lower, "en") || isKnownLatinWord(lower, otherLatinCode)) {
        classifiedCount += 1;
        offCount += 1;
      }
      // else: not a real word anywhere - excluded (proper noun/typo).
    } else if (isArabic || isHan) {
      // No genuine Spanish/French vocabulary is written in Arabic or Han
      // script - unambiguous off-language content, no dictionary needed.
      classifiedCount += 1;
      offCount += 1;
    }
  }

  const offRatio = classifiedCount === 0 ? 0 : offCount / classifiedCount;
  return { blocked: classifiedCount > 0 && offRatio > BLOCK_THRESHOLD, offRatio };
}

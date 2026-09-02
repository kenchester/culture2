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
//
// A Mandarin ("zh") target has one more wrinkle on top of that: students
// legitimately write in romanized Pinyin, not just Han characters, so
// Latin-script text there also gets checked against PINYIN_SYLLABLES (a
// closed finite table, unlike an open dictionary) before falling back to
// the en/es/fr dictionaries - see isPinyinWord below.

type TargetScript = "arabic" | "han" | "latin";

function targetScriptFor(isoCode: string): TargetScript {
  if (isoCode === "ar") return "arabic";
  if (isoCode === "zh") return "han";
  return "latin";
}

const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const HAN_SCRIPT = /\p{Script=Han}/u;
const LATIN_SCRIPT = /\p{Script=Latin}/u;

// Standard Hanyu Pinyin (the romanization taught in Mainland China AND, as
// of 2009, Taiwan's own official standard) is a genuinely CLOSED set of
// syllables, unlike an open vocabulary like English - Mandarin's phonology
// only permits a fixed initial+final inventory, so this is a complete
// finite table, not a heuristic word list. A visitor typing pinyin into a
// Mandarin network's demo composer (or a real post, for real networks)
// shouldn't get flagged as "off-language" just because the romanization is
// Latin-script - and several everyday syllables (de/le/you/hen/an/man...)
// happen to collide with real English/French/Spanish dictionary words, so
// without this they'd actively get penalized rather than just ignored.
//
// Deliberately toneless: stripPinyinMarks below strips tone digits (1-5)
// and diacritics (nǐ hǎo -> ni hao) before matching, so neither is
// required. Scoped to "zh" (Mandarin) only - Taiwan's alternate romanization
// systems (Tongyong Pinyin, Wade-Giles) and a future Cantonese network's
// romanization (Jyutping/Yale) are a different, much less certain table to
// get right and are left for whenever those networks actually exist,
// rather than guessed at now.
const PINYIN_SYLLABLES = new Set<string>([
  // Zero initial (plain vowels + the y/w orthographic spellings of
  // i/u/ü-initial syllables).
  "a", "o", "e", "ai", "ei", "ao", "ou", "an", "en", "ang", "eng", "er",
  "yi", "ya", "ye", "yao", "you", "yan", "yin", "yang", "ying", "yong",
  "wu", "wa", "wo", "wai", "wei", "wan", "wen", "wang", "weng",
  "yu", "yue", "yuan", "yun",
  // b
  "ba", "bo", "bai", "bei", "bao", "ban", "ben", "bang", "beng",
  "bi", "bie", "biao", "bian", "bin", "bing", "bu",
  // p
  "pa", "po", "pai", "pei", "pao", "pou", "pan", "pen", "pang", "peng",
  "pi", "pie", "piao", "pian", "pin", "ping", "pu",
  // m
  "ma", "mo", "me", "mai", "mei", "mao", "mou", "man", "men", "mang", "meng",
  "mi", "mie", "miao", "miu", "mian", "min", "ming", "mu",
  // f
  "fa", "fo", "fei", "fou", "fan", "fen", "fang", "feng", "fu",
  // d
  "da", "de", "dai", "dei", "dao", "dou", "dan", "dang", "deng", "dong",
  "di", "die", "diao", "diu", "dian", "ding", "du", "duo", "dui", "duan", "dun",
  // t
  "ta", "te", "tai", "tao", "tou", "tan", "tang", "teng", "tong",
  "ti", "tie", "tiao", "tian", "ting", "tu", "tuo", "tui", "tuan", "tun",
  // n (plus v-typed ü variants: nv/nve for nü/nüe)
  "na", "ne", "nai", "nei", "nao", "nou", "nan", "nang", "neng", "nong",
  "ni", "nie", "niao", "niu", "nian", "nin", "niang", "ning",
  "nu", "nuo", "nuan", "nun", "nu:", "nü", "nüe", "nue", "nv", "nve",
  // l (plus v-typed ü variants: lv/lve for lü/lüe)
  "la", "le", "lai", "lei", "lao", "lou", "lan", "lang", "leng", "long",
  "li", "lia", "lie", "liao", "liu", "lian", "lin", "liang", "ling",
  "lu", "luo", "luan", "lun", "lü", "lüe", "lue", "lv", "lve",
  // g
  "ga", "ge", "gai", "gei", "gao", "gou", "gan", "gen", "gang", "geng", "gong",
  "gu", "gua", "guo", "guai", "gui", "guan", "gun", "guang",
  // k
  "ka", "ke", "kai", "kao", "kou", "kan", "ken", "kang", "keng", "kong",
  "ku", "kua", "kuo", "kuai", "kui", "kuan", "kun", "kuang",
  // h
  "ha", "he", "hai", "hei", "hao", "hou", "han", "hen", "hang", "heng", "hong",
  "hu", "hua", "huo", "huai", "hui", "huan", "hun", "huang",
  // j
  "ji", "jia", "jie", "jiao", "jiu", "jian", "jin", "jiang", "jing", "jiong",
  "ju", "jue", "juan", "jun",
  // q
  "qi", "qia", "qie", "qiao", "qiu", "qian", "qin", "qiang", "qing", "qiong",
  "qu", "que", "quan", "qun",
  // x
  "xi", "xia", "xie", "xiao", "xiu", "xian", "xin", "xiang", "xing", "xiong",
  "xu", "xue", "xuan", "xun",
  // zh
  "zha", "zhe", "zhi", "zhai", "zhei", "zhao", "zhou", "zhan", "zhen",
  "zhang", "zheng", "zhong", "zhu", "zhua", "zhuo", "zhuai", "zhui", "zhuan",
  "zhun", "zhuang",
  // ch
  "cha", "che", "chi", "chai", "chao", "chou", "chan", "chen", "chang",
  "cheng", "chong", "chu", "chua", "chuo", "chuai", "chui", "chuan", "chun",
  "chuang",
  // sh
  "sha", "she", "shi", "shai", "shei", "shao", "shou", "shan", "shen",
  "shang", "sheng", "shu", "shua", "shuo", "shuai", "shui", "shuan", "shun",
  "shuang",
  // r
  "re", "ri", "rao", "rou", "ran", "ren", "rang", "reng", "rong",
  "ru", "rua", "ruo", "rui", "ruan", "run",
  // z
  "za", "ze", "zi", "zai", "zei", "zao", "zou", "zan", "zen", "zang", "zeng",
  "zong", "zu", "zuo", "zui", "zuan", "zun",
  // c
  "ca", "ce", "ci", "cai", "cao", "cou", "can", "cen", "cang", "ceng", "cong",
  "cu", "cuo", "cui", "cuan", "cun",
  // s
  "sa", "se", "si", "sai", "sao", "sou", "san", "sen", "sang", "seng", "song",
  "su", "suo", "sui", "suan", "sun",
]);

// Tone digits (nǐ hǎo -> ni3 hao3) and diacritics (nǐ hǎo directly) are both
// optional per the request - strip both down to a bare toneless syllable
// before matching.
function stripPinyinMarks(word: string): string {
  return word
    .replace(/[0-9]/g, "")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
}

// Multi-syllable pinyin is conventionally written either space-separated
// ("ni hao") or run together as one orthographic word ("nihao", "xuesheng",
// "zhongguo") - Intl.Segmenter already splits on whitespace, so this only
// needs to handle the run-together case, by checking whether the whole
// token can be fully tiled by back-to-back valid syllables (classic
// bounded word-break DP; syllables run at most 6 letters, e.g. "shuang").
function isPinyinDecomposable(s: string): boolean {
  if (s.length === 0) return false;
  const reachable = new Array(s.length + 1).fill(false);
  reachable[0] = true;
  for (let i = 0; i < s.length; i++) {
    if (!reachable[i]) continue;
    for (let len = 1; len <= 6 && i + len <= s.length; len++) {
      if (!reachable[i + len] && PINYIN_SYLLABLES.has(s.slice(i, i + len))) {
        reachable[i + len] = true;
      }
    }
  }
  return reachable[s.length];
}

function isPinyinWord(word: string): boolean {
  return isPinyinDecomposable(stripPinyinMarks(word));
}

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
        if (isPinyinWord(word)) {
          // Romanized Mandarin - excluded, same as a proper noun, not
          // counted as off-language at all.
        } else {
          const lower = word.toLowerCase();
          if (isKnownLatinWord(lower, "en") || isKnownLatinWord(lower, "es") || isKnownLatinWord(lower, "fr")) {
            classifiedCount += 1;
            offCount += 1;
          }
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

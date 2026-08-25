// A single CJK character is often already a complete, specific search term
// (e.g. a single Chinese character can meaningfully narrow toward "United
// States") - unlike a single Latin letter, which is too broad to be worth a
// request. Requiring 2+ characters for everyone meant a search never fired
// at all for anyone typing in Chinese, Japanese, or Korean until they'd
// typed a second character. Covers Hiragana, Katakana, CJK Unified
// Ideographs (+ Extension A), CJK Compatibility Ideographs, and Hangul
// Syllables.
const CJK_PATTERN = new RegExp(
  "[぀-ヿ㐀-䶿一-鿿豈-﫿가-힣]",
);

export function isSearchableQuery(query: string): boolean {
  return CJK_PATTERN.test(query) ? query.length >= 1 : query.length >= 2;
}

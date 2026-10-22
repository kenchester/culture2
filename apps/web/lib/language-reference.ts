/**
 * Reading a language's status and its census coverage.
 *
 * Both are small, both are easy to get subtly wrong on a page, and both
 * have exactly one right answer - so they live here with a test rather
 * than inline in the page where a later edit could quietly invert them.
 */

/**
 * Glottolog's AES scale, least to most endangered.
 *
 * Order matters: it drives the sort on the index page and the "how bad is
 * this" judgement below. `extinct` is last and is deliberately INCLUDED
 * in the scale rather than treated as a separate state - a language with
 * no remaining speakers is the end of this axis, not off it, and several
 * revitalisation projects exist precisely for languages sitting here.
 */
export const ENDANGERMENT_SCALE = [
  "not_endangered",
  "threatened",
  "shifting",
  "moribund",
  "nearly_extinct",
  "extinct",
] as const;

export type Endangerment = (typeof ENDANGERMENT_SCALE)[number];

export function isEndangerment(value: string | null): value is Endangerment {
  return value !== null && (ENDANGERMENT_SCALE as readonly string[]).includes(value);
}

/** Position on the scale, or -1 for an unknown or absent status. */
export function endangermentRank(value: string | null): number {
  return isEndangerment(value) ? ENDANGERMENT_SCALE.indexOf(value) : -1;
}

/**
 * Is this language losing speakers?
 *
 * Everything from `threatened` down. The cut is at `threatened` rather
 * than at `shifting` because that is where Glottolog itself places the
 * boundary (EGIDS 6b, UNESCO "vulnerable") - the first level at which
 * transmission to children is no longer assumed.
 */
export function isAtRisk(value: string | null): boolean {
  const rank = endangermentRank(value);
  return rank > 0;
}

export type CensusLabel = { census_label: string; is_exact: boolean };

/**
 * Which census category to quote for a language, and how to quote it.
 *
 * A language can map to at most one category in practice, but the shape
 * allows several and this picks deliberately rather than by array order:
 * an exact category always wins, because a figure that IS the language's
 * figure is strictly better than a bundle containing it.
 *
 * Returning `exact: false` is not a failure case to be hidden. It is the
 * normal case for most of the languages these pages exist for, and the
 * page is required to say so - "436,000 people in Houston speak a Chinese
 * language at home, and the census does not record how many of those
 * speak Hakka" is true and useful; printing 436,000 beside the word
 * Hakka is neither.
 */
export function censusCoverage(labels: CensusLabel[]): CensusLabel | null {
  if (labels.length === 0) return null;
  return labels.find((l) => l.is_exact) ?? labels[0];
}

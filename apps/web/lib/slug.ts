/**
 * Readable URLs without a slug column, a uniqueness constraint, or a
 * migration.
 *
 * Every slugged route keeps the numeric id as the last segment of the
 * slug - `/cities/detroit-michigan-25420` - so the id is still the
 * identifier and the words are decoration. That buys three things a
 * stored slug does not: no collision handling (ids are already unique),
 * no backfill, and old numeric links keep resolving forever, which
 * matters because permalinks have been shared.
 *
 * Both forms serve the same page. The slugged one is canonical, declared
 * through metadata, so search engines are told which to keep rather than
 * being bounced through a redirect.
 */

/** Strips accents so "Hlavní město Praha" becomes "hlavni-mesto-praha". */
function deburr(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Turns a title into a URL fragment. Non-Latin scripts reduce to nothing
 * useful, so callers must tolerate an empty string - that is the signal
 * to emit the bare id rather than a dangling hyphen.
 */
export function slugify(value: string, maxLength = 60): string {
  const slug = deburr(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    // A truncation can leave a trailing hyphen mid-word.
    .replace(/-+$/g, "");
  return slug;
}

/** `detroit-michigan-25420`, or just `25420` when the name has no Latin characters. */
export function slugWithId(name: string | null | undefined, id: number): string {
  const slug = slugify(name ?? "");
  return slug ? `${slug}-${id}` : String(id);
}

/**
 * Reads the id back out of either form. Returns null rather than NaN so a
 * caller can notFound() on genuine rubbish instead of querying for it.
 */
export function idFromSlug(param: string): number | null {
  const match = /(\d+)$/.exec(param);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * A corridor is an unordered pair, so the two directions have to resolve
 * to one URL. Sorting by id gives a canonical key without needing to
 * decide which end is "first".
 */
export function corridorIds(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

export function corridorSlug(
  first: { id: number; name?: string | null },
  second: { id: number; name?: string | null },
): string {
  const [lowId, highId] = corridorIds(first.id, second.id);
  const low = lowId === first.id ? first : second;
  const high = highId === first.id ? first : second;
  const words = [slugify(low.name ?? ""), slugify(high.name ?? "")].filter(Boolean).join("-and-");
  return words ? `${words}-${lowId}-${highId}` : `${lowId}-${highId}`;
}

/** Reads both ids back out of a corridor param, already in canonical order. */
export function corridorIdsFromSlug(param: string): [number, number] | null {
  const match = /(\d+)-(\d+)$/.exec(param);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a <= 0 || b <= 0) return null;
  return corridorIds(a, b);
}
